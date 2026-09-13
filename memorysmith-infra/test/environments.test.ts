/**
 * One app, two environments (architecture-guide.md, section 17). What these
 * cases protect is what cannot be seen before a deploy: which account a stack
 * is bound to, which names it creates, and what production declares on behalf
 * of staging.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import {
  environmentOf,
  physicalName,
  stackId,
  type EnvironmentConfig,
} from '../config/environments.js';
import { DataStack } from '../stacks/data.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';

const ENVIRONMENTS = {
  production: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'memorysmith.app',
    hostedZoneId: 'ZPRODUCTION',
    delegations: [
      {
        recordName: 'stg',
        nameServers: [
          'ns-1.awsdns-01.org',
          'ns-2.awsdns-02.co.uk',
          'ns-3.awsdns-03.com',
          'ns-4.awsdns-04.net',
        ],
      },
    ],
  },
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
  },
};

function appFor(environment: string): App {
  // No bundling: these cases read templates, and a Lambda bundle is not one.
  return new App({
    context: { environment, environments: ENVIRONMENTS, 'aws:cdk:bundling-stacks': [] },
  });
}

function stacksOf(app: App, environment: EnvironmentConfig) {
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
  });
  return { network, data, identity };
}

describe('the environment of a synth', () => {
  it('is production when none is named', () => {
    const app = new App({ context: { environments: ENVIRONMENTS } });
    expect(environmentOf(app.node).name).toBe('production');
  });

  it('refuses an environment that does not exist', () => {
    expect(() => environmentOf(appFor('prod').node)).toThrow('"prod"');
  });

  it('refuses an environment whose account is not written down yet', () => {
    const app = new App({
      context: {
        environment: 'staging',
        environments: { staging: { ...ENVIRONMENTS.staging, account: '' } },
      },
    });
    expect(() => environmentOf(app.node)).toThrow('"account"');
  });

  it('names every stack and every physical resource after the environment', () => {
    const staging = environmentOf(appFor('staging').node);
    expect(stackId(staging, 'Data')).toBe('MemorysmithStagingData');
    expect(physicalName(staging, 'mv-access')).toBe('mv-access-staging');
  });
});

describe('the stacks of an environment', () => {
  it('bind to the account of the environment, never to the credentials', () => {
    const app = appFor('staging');
    const { data } = stacksOf(app, environmentOf(app.node));
    expect(data.account).toBe('222222222222');
  });

  it('create tables, a bus and a pool whose names say the environment', () => {
    const app = appFor('staging');
    const { data, identity } = stacksOf(app, environmentOf(app.node));

    const tables = Template.fromStack(data).findResources('AWS::DynamoDB::Table');
    expect(
      Object.values(tables)
        .map((table) => table.Properties.TableName)
        .sort(),
    ).toEqual([
      'mv-access-staging',
      'mv-audit-staging',
      'mv-discovery-staging',
      'mv-knowledge-staging',
    ]);
    Template.fromStack(data).hasResourceProperties('AWS::Events::EventBus', {
      Name: 'mv-events-staging',
    });
    Template.fromStack(identity).hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'memorysmith-users-staging',
    });
  });

  it('let the content bucket be read from the site of the environment alone', () => {
    const app = appFor('staging');
    const { data } = stacksOf(app, environmentOf(app.node));
    Template.fromStack(data).hasResourceProperties('AWS::S3::Bucket', {
      CorsConfiguration: { CorsRules: [{ AllowedOrigins: ['https://stg.memorysmith.app'] }] },
    });
  });

  it('prefix the messages of the pool outside production', () => {
    for (const [name, prefix] of [
      ['staging', '[staging] '],
      ['production', ''],
    ] as const) {
      const app = appFor(name);
      const { identity } = stacksOf(app, environmentOf(app.node));
      const pool = Object.values(
        Template.fromStack(identity).findResources('AWS::Cognito::UserPool'),
      )[0];
      expect(pool?.Properties.AdminCreateUserConfig.InviteMessageTemplate.EmailSubject).toBe(
        `${prefix}Your MemorySmith.app account`,
      );
      expect(pool?.Properties.VerificationMessageTemplate.EmailSubject).toBe(
        `${prefix}Your MemorySmith code`,
      );
    }
  });

  it('delegate the zone of staging from the zone of production, in code', () => {
    const app = appFor('production');
    const { network } = stacksOf(app, environmentOf(app.node));
    Template.fromStack(network).hasResourceProperties('AWS::Route53::RecordSet', {
      Name: 'stg.memorysmith.app.',
      Type: 'NS',
      ResourceRecords: ENVIRONMENTS.production.delegations[0]?.nameServers,
    });
  });
});
