/**
 * Every function is traced (#271): a function without tracing is the one
 * place a trace breaks without anybody seeing why, so this reads every
 * function of every stack, in both environments.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { appFor, stacksOf } from './stacks.js';

type FunctionResource = { Properties: { Description?: string; TracingConfig?: { Mode?: string } } };

describe.each(['production', 'staging'] as const)('the functions of %s', (environment) => {
  it('are all traced through X-Ray', () => {
    const { all } = stacksOf(appFor(environment, { alarmEmail: 'operator@example.com' }));
    const functions = all.flatMap((stack) =>
      Object.values(
        Template.fromStack(stack).findResources('AWS::Lambda::Function') as Record<
          string,
          FunctionResource
        >,
      ).filter((resource) => resource.Properties.Description),
    );
    expect(functions.length).toBeGreaterThanOrEqual(12);
    const untraced = functions
      .filter((resource) => resource.Properties.TracingConfig?.Mode !== 'Active')
      .map((resource) => resource.Properties.Description);
    expect(untraced).toEqual([]);
  });
});
