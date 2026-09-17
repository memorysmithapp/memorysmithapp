/**
 * Every variable a handler REQUIRES is a variable its stack gives it.
 *
 * A handler reads its environment at module load and throws when one is
 * missing, which on Lambda is an INIT error: the function never runs, the
 * messages of its queue go to the dead-letter queue, and what asked for the
 * work waits for an answer that is never written. That is exactly what
 * happened when the import moved into the transfer worker and the worker
 * started needing `ACCESS_TABLE`, which the stack did not name: the whole
 * Functional stage failed on transfers that stayed `running` for ever.
 *
 * Nothing checked it, because the two halves are in two projects: the `required`
 * calls are backend source and the environment is a CDK property. This reads
 * both and compares them, the way `routes.json` keeps the manifest equal to the
 * app.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf, stackId, type EnvironmentConfig } from '../config/environments.js';
import { readText } from '../commands/lib/repository.js';
import { DataStack } from '../stacks/data.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { ApiStack } from '../stacks/api.stack.js';
import { ProjectionsStack } from '../stacks/projections.stack.js';

const ENVIRONMENTS = {
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
  },
};

/** Which source each deployed function runs, by the description it declares. */
const HANDLERS: ReadonlyArray<{ entry: string; description: string }> = [
  {
    entry: 'memorysmith-backend/apps/core-monolith/src/handler.ts',
    description: 'MemorySmith core API: access, knowledge, discovery and audit reads.',
  },
  {
    entry: 'memorysmith-backend/apps/core-monolith/src/relay.handler.ts',
    description: 'Drains the transactional outbox into the event bus.',
  },
  {
    entry: 'memorysmith-backend/apps/core-monolith/src/purge.handler.ts',
    description: 'Destroys the content and the items a deletion invalidated.',
  },
  {
    entry: 'memorysmith-backend/apps/core-monolith/src/transfer.handler.ts',
    description: 'Builds the archive of an export, and records how far it got.',
  },
  {
    entry: 'memorysmith-backend/services/audit/src/main/handler.ts',
    description: 'Appends every event of the bus to the audit trail. Append-only by IAM.',
  },
  {
    entry: 'memorysmith-backend/services/discovery/src/main/handler.ts',
    description: 'Maintains the link graph, the vector index and the curation facets.',
  },
];

/** The names a source insists on, as it insists on them. */
function requiredBy(entry: string): string[] {
  return [...readText(entry).matchAll(/required\('([A-Z0-9_]+)'\)/g)].map(
    (match) => match[1] ?? '',
  );
}

/** The environment of every function of a stack, keyed by its description. */
function environmentsOf(template: Template): Map<string, Record<string, string>> {
  const found = new Map<string, Record<string, string>>();
  for (const resource of Object.values(template.findResources('AWS::Lambda::Function'))) {
    const properties = resource.Properties as {
      Description?: string;
      Environment?: { Variables?: Record<string, string> };
    };
    if (properties.Description) {
      found.set(properties.Description, properties.Environment?.Variables ?? {});
    }
  }
  return found;
}

function deployed(): Map<string, Record<string, string>> {
  // No bundling: this case reads templates, and a Lambda bundle is not one.
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
  const projections = new ProjectionsStack(app, stackId(environment, 'Projections'), {
    env,
    environment,
    data,
  });

  return new Map([
    ...environmentsOf(Template.fromStack(api)),
    ...environmentsOf(Template.fromStack(projections)),
  ]);
}

describe('the environment of every deployed handler', () => {
  const functions = deployed();

  for (const handler of HANDLERS) {
    it(`gives ${handler.entry.split('/').slice(-3).join('/')} every variable it requires`, () => {
      const variables = functions.get(handler.description);
      expect(variables, `no function is described as "${handler.description}"`).toBeDefined();

      const missing = requiredBy(handler.entry).filter((name) => !(name in (variables ?? {})));
      expect(missing, `${handler.entry} requires variables its stack does not name`).toEqual([]);
    });
  }

  it('covers every function the stacks declare, and names no handler that is gone', () => {
    // A handler added without a line above would be checked by nothing.
    const entries = [
      ...readText('memorysmith-infra/stacks/api.stack.ts').matchAll(/entry: join\(([^)]*)\)/g),
      ...readText('memorysmith-infra/stacks/projections.stack.ts').matchAll(
        /entry: join\(([^)]*)\)/g,
      ),
    ].length;
    expect(entries).toBe(HANDLERS.length);
  });
});
