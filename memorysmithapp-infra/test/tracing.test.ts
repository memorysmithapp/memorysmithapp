/**
 * Every function is traced when a delivery turns tracing on (#271, ADR-021):
 * a function without tracing is the one place a trace breaks without anybody
 * seeing why, so this reads every function of every stack, in both
 * environments. By default none is, and none sends anything.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { appFor, stacksOf } from './stacks.js';

type FunctionResource = {
  Properties: {
    Description?: string;
    TracingConfig?: { Mode?: string };
    Environment?: { Variables?: Record<string, unknown> };
  };
};

const functionsOf = (environment: 'production' | 'staging', tracing: boolean) => {
  const { all } = stacksOf(appFor(environment, { alarmEmail: 'operator@example.com', tracing }));
  const functions = all.flatMap((stack) =>
    Object.values(
      Template.fromStack(stack).findResources('AWS::Lambda::Function') as Record<
        string,
        FunctionResource
      >,
    ).filter((resource) => resource.Properties.Description),
  );
  expect(functions.length).toBeGreaterThanOrEqual(12);
  return functions;
};

describe.each(['production', 'staging'] as const)('the functions of %s', (environment) => {
  it('are all traced through X-Ray when a delivery turns tracing on', () => {
    const untraced = functionsOf(environment, true)
      .filter(
        (resource) =>
          resource.Properties.TracingConfig?.Mode !== 'Active' ||
          resource.Properties.Environment?.Variables?.['POWERTOOLS_TRACE_ENABLED'] !== 'true',
      )
      .map((resource) => resource.Properties.Description);
    expect(untraced).toEqual([]);
  });

  it('send no trace by default', () => {
    const traced = functionsOf(environment, false)
      .filter(
        (resource) =>
          resource.Properties.TracingConfig?.Mode === 'Active' ||
          resource.Properties.Environment?.Variables?.['POWERTOOLS_TRACE_ENABLED'] !== 'false',
      )
      .map((resource) => resource.Properties.Description);
    expect(traced).toEqual([]);
  });
});
