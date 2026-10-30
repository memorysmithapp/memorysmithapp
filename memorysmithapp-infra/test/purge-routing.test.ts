/**
 * Every event the purge handles is an event the bus sends it.
 *
 * The two halves live in two projects, and the purge tests hand events straight
 * to the worker, so an event the rule does not carry passes every one of them
 * and never happens in AWS. That is how `FileDeleted` went unrouted and a file
 * deleted on its own kept its bytes (#372). This reads both and compares them,
 * as `discovery-routing.test.ts` does for the projector.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { readText } from '../commands/lib/repository.js';
import { appFor, stacksOf } from './stacks.js';

/** The events the worker acts on, as its switch names them. */
function handled(): string[] {
  const source = readText(
    'memorysmithapp-backend/services/knowledge/src/adapters/inbound/content-purge.ts',
  );
  return [...source.matchAll(/case '([A-Za-z]+)':/g)].map((match) => match[1] ?? '').sort();
}

/** The events the rule in front of the purge queue lets through. */
function routed(): string[] {
  const { api } = stacksOf(appFor('staging'));
  const rules = Template.fromStack(api).findResources('AWS::Events::Rule', {
    Properties: { Description: 'Every deletion feeds the purge of what it invalidated.' },
  });
  const [rule] = Object.values(rules);
  const pattern = (rule?.Properties as { EventPattern?: Record<string, unknown> }).EventPattern;
  return [...((pattern?.['detail-type'] as string[] | undefined) ?? [])].sort();
}

describe('the events that reach the purge', () => {
  it('are every event its worker handles, and nothing it does not', () => {
    expect(routed()).toEqual(handled());
  });
});
