/**
 * An installation of somebody else (#342): what it refuses, the names it
 * produces, and what its stacks hold on each of the two DNS modes. The project's
 * own installation is held by the other suites, whose names these cases do not
 * touch.
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  bootstrapVerdict,
  delegationProblem,
  hostsFromOutputs,
  humanSteps,
  servicesMissingIn,
} from '../commands/lib/install.js';
import { stackIdOf } from '../commands/lib/teardown.js';
import {
  environmentOf,
  physicalName,
  stackId,
  trustOf,
  type EnvironmentConfig,
} from '../config/environments.js';
import { PENDING_HOSTS } from '../installation/index.js';
import { FrontendHostingStack } from '../stacks/frontend-hosting.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { InstallationDeliveryStack } from '../stacks/github-delivery.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { appFor } from './stacks.js';

const VARIABLES = {
  INSTALLATION: 'acme',
  AWS_ACCOUNT_ID: '222222222222',
  AWS_REGION: 'eu-west-1',
  DOMAIN_NAME: 'notes.acme.example',
  HOSTED_ZONE_ID: 'ZACME',
};

const reader = (context: Record<string, unknown> = {}) => ({
  tryGetContext: (key: string) => ({ environment: 'staging', ...context })[key],
});

const installed = (
  variables: Record<string, string> = VARIABLES,
  context: Record<string, unknown> = {},
): EnvironmentConfig => environmentOf(reader(context), variables);

describe('the variables of an installation', () => {
  it('never reads the environments of cdk.json', () => {
    const environment = environmentOf(
      reader({ environments: { staging: { account: '111111111111', region: 'us-east-1' } } }),
      VARIABLES,
    );
    expect(environment.account).toBe('222222222222');
    expect(environment.region).toBe('eu-west-1');
    expect(environment.installation).toBe('acme');
  });

  it.each([
    ['AWS_ACCOUNT_ID', 'names no AWS_ACCOUNT_ID'],
    ['AWS_REGION', 'names no AWS_REGION'],
  ])('refuses an installation with no %s, with no fallback', (name, message) => {
    const variables: Record<string, string> = { ...VARIABLES };
    delete variables[name];
    expect(() => installed(variables)).toThrow(message);
  });

  it('refuses a domain with no zone', () => {
    expect(() => installed({ ...VARIABLES, HOSTED_ZONE_ID: '' })).toThrow('go together');
  });

  it('refuses a name a sign-in domain would refuse', () => {
    expect(() => installed({ ...VARIABLES, INSTALLATION: 'my-aws' })).toThrow('INSTALLATION');
    expect(() => installed({ ...VARIABLES, INSTALLATION: 'Acme' })).toThrow('INSTALLATION');
  });

  it('asks a fork for its repository, and the command path for none', () => {
    expect(() => installed({ ...VARIABLES, REPOSITORY_HOST: 'github' })).toThrow('REPOSITORY');
    expect(installed().repositoryHost).toBe('none');
  });

  it('asks production for who the budgets notify', () => {
    expect(() => installed(VARIABLES, { environment: 'production' })).toThrow('ALARM_EMAIL');
  });

  it('reads a delegation written flat, and refuses one that is not', () => {
    const delegations = 'stg:ns-1.awsdns-01.org,ns-2.awsdns-02.com';
    expect(installed({ ...VARIABLES, DNS_DELEGATIONS: delegations }).delegations).toEqual([
      { recordName: 'stg', nameServers: ['ns-1.awsdns-01.org', 'ns-2.awsdns-02.com'] },
    ]);
    expect(() => installed({ ...VARIABLES, DNS_DELEGATIONS: 'stg' })).toThrow('DNS_DELEGATIONS');
  });

  it('keeps every variable it reads documented in .env.example', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const source = readFileSync(new URL('../installation/index.ts', import.meta.url), 'utf8');
    const named = [...source.matchAll(/(?:value|required)\('([A-Z_]+)'\)/g)].map((m) => m[1]);
    expect(named.length).toBeGreaterThan(5);
    for (const name of named) expect(example).toContain(`${name}`);
  });
});

describe('the names of an installation', () => {
  const environment = { name: 'staging', installation: 'acme-co' } as const;

  it('joins what AWS keeps unique, and leaves the project untouched', () => {
    expect(physicalName(environment, 'mv-access')).toBe('mv-access-acme-co-staging');
    expect(physicalName({ name: 'staging' }, 'mv-access')).toBe('mv-access-staging');
  });

  it('writes a stack id the commands agree with', () => {
    expect(stackId(environment, 'Data')).toBe('MemorysmithAcmeCoStagingData');
    expect(stackIdOf('staging', 'Data', 'acme-co')).toBe(stackId(environment, 'Data'));
    expect(stackId({ name: 'staging' }, 'Data')).toBe('MemorysmithStagingData');
  });
});

describe('who a delivery role trusts', () => {
  const fork = (host: string, name: string): EnvironmentConfig =>
    installed(
      { ...VARIABLES, REPOSITORY_HOST: host, REPOSITORY: 'acme/notes' },
      {
        environment: name,
        alarmEmail: 'ops@acme.example',
      },
    );

  it('on GitHub, the repository and its environment', () => {
    expect(trustOf(fork('github', 'production')).subject).toBe(
      'repo:acme/notes:environment:production',
    );
  });

  it('on GitLab, main for production and any branch for staging', () => {
    expect(trustOf(fork('gitlab', 'production')).subject).toBe(
      'project_path:acme/notes:ref_type:branch:ref:main',
    );
    expect(trustOf(fork('gitlab', 'staging')).subject).toBe(
      'project_path:acme/notes:ref_type:branch:ref:*',
    );
    expect(trustOf(fork('gitlab', 'staging')).audience).toBe('https://gitlab.com');
  });

  it('declares the role against the provider of the account, which it does not own', () => {
    const app = new App();
    const environment = installed(
      { ...VARIABLES, REPOSITORY_HOST: 'gitlab', REPOSITORY: 'acme/notes' },
      { oidcProviderArn: 'arn:aws:iam::222222222222:oidc-provider/gitlab.com' },
    );
    const stack = new InstallationDeliveryStack(app, 'Delivery', {
      env: { account: environment.account, region: environment.region },
      environment,
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::IAM::OIDCProvider', 0);
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'memorysmith-delivery-acme-staging',
    });
  });
});

describe('a domain of its own, outside us-east-1', () => {
  const environment = installed();
  const app = appFor('staging');
  const env = { account: environment.account, region: environment.region };
  const edge = new Stack(app, 'Edge', {
    env: { account: environment.account, region: 'us-east-1' },
    crossRegionReferences: true,
  });
  const network = new NetworkStack(app, 'Network', {
    env,
    environment,
    edge,
    crossRegionReferences: true,
  });

  const identity = new IdentityStack(app, 'Identity', {
    env,
    environment,
    accessTable: Table.fromTableName(network, 'Access', 'mv-access-acme-staging'),
    mcpOrigin: `https://${network.mcpDomainName}`,
    siteDomainName: network.siteDomainName,
    authDomainName: network.authDomainName,
    authCertificate: network.authCertificate,
    hostedZone: network.hostedZone,
    senderAddress: network.senderAddress,
  });

  it('declares the certificates AWS binds to us-east-1 there, and the others here', () => {
    Template.fromStack(edge).resourceCountIs('AWS::CertificateManager::Certificate', 4);
    Template.fromStack(network).resourceCountIs('AWS::CertificateManager::Certificate', 2);
  });

  it('holds nothing of memorysmith.app', () => {
    expect(JSON.stringify(Template.fromStack(network).toJSON())).not.toContain('memorysmith.app');
  });

  it('writes the invitation with its own site', () => {
    const template = JSON.stringify(Template.fromStack(identity).toJSON());
    expect(template).toContain('https://notes.acme.example');
    expect(template).not.toContain('memorysmith.app');
  });
});

describe('the default endpoints of AWS', () => {
  const variables = {
    INSTALLATION: 'acme',
    AWS_ACCOUNT_ID: '222222222222',
    AWS_REGION: 'sa-east-1',
  };
  const environment = installed(variables);
  const app = appFor('staging');
  const env = { account: environment.account, region: environment.region };
  const network = new NetworkStack(app, 'Network', { env, environment });

  const hosting = new FrontendHostingStack(app, 'Frontend', {
    env,
    domainName: network.siteDomainName,
  });

  it('declares no certificate and no sending identity', () => {
    const template = Template.fromStack(network);
    template.resourceCountIs('AWS::CertificateManager::Certificate', 0);
    template.resourceCountIs('AWS::SES::EmailIdentity', 0);
    expect(network.hostedZone).toBeUndefined();
  });

  it('holds placeholders until a delivery reads the hosts AWS gave', () => {
    expect(environment.hosts).toEqual(PENDING_HOSTS);
    const read = { ...PENDING_HOSTS, site: 'd111.cloudfront.net' };
    expect(installed(variables, { defaultHosts: JSON.stringify(read) }).hosts).toEqual(read);
  });

  it('answers its site on the distribution, and says which host that is', () => {
    const template = Template.fromStack(hosting);
    template.hasOutput('SiteHost', {});
    template.resourceCountIs('AWS::Route53::RecordSet', 0);
  });
});

describe('what install-account decides', () => {
  it('finds what a region lacks', () => {
    const regions = { 'cognito-idp': ['eu-west-1'] };
    expect(servicesMissingIn('eu-west-1', regions)).not.toContain('cognito-idp');
    expect(servicesMissingIn('eu-west-1', regions)).toContain('ses');
    expect(servicesMissingIn('eu-west-1', regions)).not.toContain('cloudfront');
  });

  it('bootstraps what has none, reuses what fits, and replaces nothing', () => {
    expect(bootstrapVerdict({ status: null, version: null })).toEqual({ kind: 'absent' });
    expect(bootstrapVerdict({ status: 'UPDATE_COMPLETE', version: 28 })).toEqual({
      kind: 'compatible',
    });
    expect(bootstrapVerdict({ status: 'CREATE_COMPLETE', version: 6 }).kind).toBe('incompatible');
    expect(bootstrapVerdict({ status: 'CREATE_COMPLETE', version: null }).kind).toBe(
      'incompatible',
    );
    expect(bootstrapVerdict({ status: 'ROLLBACK_COMPLETE', version: 28 }).kind).toBe(
      'incompatible',
    );
  });

  it('compares a delegation whatever the order and the final dot', () => {
    const zone = ['ns-1.awsdns-01.org', 'ns-2.awsdns-02.com'];
    expect(
      delegationProblem('a.example', zone, ['NS-2.awsdns-02.com.', 'ns-1.awsdns-01.org']),
    ).toBe(null);
    expect(delegationProblem('a.example', zone, [])).toContain('answers no name servers');
    expect(delegationProblem('a.example', zone, ['ns-9.example'])).toContain('is delegated to');
  });

  it('waits for every host before it writes them in', () => {
    expect(hostsFromOutputs({ SiteHost: 'a' })).toBeNull();
    expect(
      hostsFromOutputs({
        SiteHost: 'a',
        ApiHost: 'b',
        McpHost: 'c',
        UploadsHost: 'd',
        FilesHost: 'e',
      }),
    ).toEqual({ site: 'a', api: 'b', mcp: 'c', uploads: 'd', files: 'e' });
  });

  it('tells a person the steps of their path', () => {
    const steps = humanSteps(
      installed({ ...VARIABLES, REPOSITORY_HOST: 'gitlab', REPOSITORY: 'acme/notes' }),
      'arn:aws:iam::222222222222:role/x',
    ).join(' ');
    expect(steps).toContain('On GitLab');
    expect(steps).toContain('protect the branch main');
    expect(steps).toContain('AWS_STAGING_ROLE_ARN=arn:aws:iam::222222222222:role/x');
    expect(humanSteps(installed(), null).join(' ')).toContain('deliver --environment staging');
  });
});
