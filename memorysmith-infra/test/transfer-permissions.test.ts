/**
 * What may be deleted under `imports/`, and by whom.
 *
 * An import discards the upload it came from once it ends, whichever way it
 * ended (RN-PRT-014). That permission was written for the API, because the
 * import used to run there; when the work moved into the transfer worker the
 * permission stayed behind, and the delete it could not do REPLACED the verdict
 * of the import: a notebook was written whole and the job said it failed (#148).
 *
 * Nothing compared the two, for the same reason nothing compared the
 * environment of a handler to its stack: the work is backend source and the
 * policy is a CDK property. This reads the template and names the principal.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf, stackId, type EnvironmentConfig } from '../config/environments.js';
import { DataStack } from '../stacks/data.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { ApiStack } from '../stacks/api.stack.js';

const ENVIRONMENTS = {
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
  },
};

/** Where an import leaves the file it was given, under any subscription. */
const UPLOADS = 's/*/imports/*';

const TRANSFER_WORKER = 'Builds the archive of an export, and records how far it got.';

function apiTemplate(): Template {
  // No bundling: this case reads a template, and a Lambda bundle is not one.
  const app = new App({
    context: { environment: 'staging', environments: ENVIRONMENTS, 'aws:cdk:bundling-stacks': [] },
  });
  const environment: EnvironmentConfig = environmentOf(app.node);
  const env = { account: environment.account, region: environment.region };

  const network = new NetworkStack(app, stackId(environment, 'Network'), { env, environment });
  const data = new DataStack(app, stackId(environment, 'Data'), {
    env,
    environment,
    siteOrigin: `https://${network.siteDomainName}`,
  });
  const identity = new IdentityStack(app, stackId(environment, 'Identity'), {
    env,
    environment,
    accessTable: data.accessTable.table,
    mcpOrigin: `https://${network.mcpDomainName}`,
    siteDomainName: network.siteDomainName,
    authDomainName: network.authDomainName,
    authCertificate: network.authCertificate,
    hostedZone: network.hostedZone,
    senderAddress: network.senderAddress,
  });
  const api = new ApiStack(app, stackId(environment, 'Api'), {
    env,
    environment,
    data,
    hostedZone: network.hostedZone,
    certificate: network.apiCertificate,
    apiDomainName: network.apiDomainName,
    userPool: identity.userPool,
    cognitoIssuer: identity.issuer,
    connectorClientId: identity.proxyClient.userPoolClientId,
    frontendOrigin: `https://${network.siteDomainName}`,
  });
  return Template.fromStack(api);
}

/** The role of every function of the stack, keyed by the description it declares. */
function rolesByDescription(template: Template): Map<string, string> {
  const found = new Map<string, string>();
  for (const resource of Object.values(template.findResources('AWS::Lambda::Function'))) {
    const properties = resource.Properties as {
      Description?: string;
      Role?: { 'Fn::GetAtt'?: string[] };
    };
    const role = properties.Role?.['Fn::GetAtt']?.[0];
    if (properties.Description && role) found.set(properties.Description, role);
  }
  return found;
}

interface Allowed {
  readonly actions: string[];
  /** The resource as the template writes it: an import, a join, a literal. */
  readonly resource: string;
}

/** Everything one role is allowed to do, statement by statement. */
function allowedOf(template: Template, role: string): Allowed[] {
  const found: Allowed[] = [];
  for (const policy of Object.values(template.findResources('AWS::IAM::Policy'))) {
    const properties = policy.Properties as {
      Roles?: Array<{ Ref?: string }>;
      PolicyDocument?: { Statement?: unknown[] };
    };
    if (!(properties.Roles ?? []).some((each) => each.Ref === role)) continue;
    for (const statement of properties.PolicyDocument?.Statement ?? []) {
      const each = statement as { Effect?: string; Action?: string | string[]; Resource?: unknown };
      if (each.Effect !== 'Allow') continue;
      found.push({
        actions: typeof each.Action === 'string' ? [each.Action] : (each.Action ?? []),
        resource: JSON.stringify(each.Resource ?? ''),
      });
    }
  }
  return found;
}

const deletesUnderUploads = (allowed: Allowed[]): Allowed[] =>
  allowed.filter(
    (each) =>
      each.resource.includes(UPLOADS) && each.actions.some((action) => action.startsWith('s3:')),
  );

describe('the upload an import discards', () => {
  const template = apiTemplate();
  const roles = rolesByDescription(template);

  it('is deletable by the worker that runs the import', () => {
    const role = roles.get(TRANSFER_WORKER);
    expect(role, `no function is described as "${TRANSFER_WORKER}"`).toBeDefined();

    const statements = deletesUnderUploads(allowedOf(template, role ?? ''));
    expect(statements.flatMap((each) => each.actions)).toEqual(['s3:DeleteObject']);
  });

  it('is named by no other principal of the stack', () => {
    // The API presigns the upload and inspects it; it stopped discarding it
    // when the import moved into the worker.
    for (const [description, role] of roles) {
      if (description === TRANSFER_WORKER) continue;
      expect(
        deletesUnderUploads(allowedOf(template, role)),
        `${description} names the uploads of an import`,
      ).toEqual([]);
    }
  });

  it('is the only thing the worker may delete, and never a revision of one', () => {
    // A delete of a VERSION destroys bytes, and exactly one principal in this
    // system may do that (rule 8, RN-KNW-047). The worker is not it: its delete
    // leaves a marker the lifecycle rule of the tag collects.
    const deletes = allowedOf(template, roles.get(TRANSFER_WORKER) ?? '').filter((each) =>
      each.actions.some((action) => action.startsWith('s3:Delete')),
    );
    expect(deletes.flatMap((each) => each.actions)).toEqual(['s3:DeleteObject']);
    expect(deletes.every((each) => each.resource.includes(UPLOADS))).toBe(true);
  });
});
