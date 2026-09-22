/**
 * Every event the discovery projector handles is an event the bus sends it.
 *
 * The two halves live in two projects: the `case` of the dispatch is backend
 * source and the rule is a CDK property. The discovery tests hand events
 * straight to the projector, so an event the rule does not carry passes every
 * one of them and never happens in AWS — which is how `FileKept` and
 * `FileDeleted` went unrouted, and every file a notebook kept was counted as a
 * pending link (#185). This reads both and compares them, the way
 * `handler-environment.test.ts` compares variables.
 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf, stackId, type EnvironmentConfig } from '../config/environments.js';
import { readText } from '../commands/lib/repository.js';
import { DataStack } from '../stacks/data.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
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

/** The events the projector acts on, as its dispatch names them. */
function handled(): string[] {
  const source = readText('memorysmith-backend/services/discovery/src/adapters/dispatch.ts');
  return [...source.matchAll(/case '([A-Za-z]+)':/g)].map((match) => match[1] ?? '').sort();
}

/** The events the rule in front of the projection queue lets through. */
function routed(): string[] {
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
  const projections = new ProjectionsStack(app, stackId(environment, 'Projections'), {
    env,
    environment,
    data,
  });

  const rules = Object.values(Template.fromStack(projections).findResources('AWS::Events::Rule'));
  const knowledge = rules
    .map((rule) => rule.Properties as { EventPattern?: Record<string, unknown> })
    .map((properties) => properties.EventPattern ?? {})
    .find(
      (pattern) => (pattern['source'] as unknown[] | undefined)?.[0] === 'memorysmith.knowledge',
    );
  return [...((knowledge?.['detail-type'] as string[] | undefined) ?? [])].sort();
}

describe('the events that reach the discovery projector', () => {
  it('are every event its dispatch handles, and nothing it does not', () => {
    expect(routed()).toEqual(handled());
  });
});
