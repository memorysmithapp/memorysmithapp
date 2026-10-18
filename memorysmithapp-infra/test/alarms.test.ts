/**
 * The alarms reach somebody in production, and do not exist in staging (#267).
 *
 * Seventy alarms had been created with no action at all, half of them in an
 * environment nobody watches, and nothing could see it before the bill did.
 * These cases synthesise every stack that holds a function or a dead-letter
 * queue, in both environments, and read what each alarm would do.
 */

import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Alarm, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { describe, expect, it } from 'vitest';
import { environmentOf } from '../config/environments.js';
import { alarmTopicName, guardAlarms } from '../constructs/alarms.js';
import { readText } from '../commands/lib/repository.js';
import { ENVIRONMENTS, appFor, stacksOf } from './stacks.js';

const ADDRESS = 'operator@example.com';

type AlarmResource = { Properties: { AlarmActions?: unknown[] } };

function alarmsOf(stacks: readonly Stack[]): Array<[string, AlarmResource]> {
  return stacks.flatMap((stack) =>
    Object.entries(
      Template.fromStack(stack).findResources('AWS::CloudWatch::Alarm') as Record<
        string,
        AlarmResource
      >,
    ).map(([logicalId, alarm]): [string, AlarmResource] => [
      `${stack.stackName}/${logicalId}`,
      alarm,
    ]),
  );
}

describe('the alarms of production', () => {
  const app = appFor('production', { alarmEmail: ADDRESS });
  const { network, all } = stacksOf(app);
  const alarms = alarmsOf(all);

  it('exist: the mandatory ones of every function and of every dead-letter queue', () => {
    expect(alarms.length).toBeGreaterThan(20);
    const names = alarms.map(([name]) => name).join(' ');
    for (const queue of ['Relay', 'Purge', 'Transfer', 'Print', 'Projection']) {
      expect(names).toContain(`${queue}DeadLetterDepth`);
    }
  });

  /**
   * The set, as #318 trimmed it: an alarm on errors for every function, p99
   * only where somebody waits, and the throttles of the account once.
   */
  it('watch errors everywhere, p99 only on the request path, and throttles once', () => {
    const names = alarms.map(([name]) => name);
    const errors = names.filter((name) => /Errors/.test(name));
    const durations = names.filter((name) => /Duration/.test(name));
    const throttles = names.filter((name) => /Throttles/.test(name));
    expect(errors.length).toBeGreaterThanOrEqual(12);
    expect(durations).toHaveLength(3);
    for (const waited of ['CoreApi', 'AgentFunction', 'PreTokenGeneration']) {
      expect(durations.join(' ')).toContain(waited);
    }
    expect(throttles).toHaveLength(1);
    expect(throttles[0]).toContain('AccountThrottles');
  });

  it('notify one topic, with the address of the operator subscribed to it', () => {
    const template = Template.fromStack(network);
    template.resourceCountIs('AWS::SNS::Topic', 1);
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: alarmTopicName({ name: 'production' }),
    });
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: ADDRESS,
    });
  });

  it('every one of them has that topic as its action', () => {
    const arn = `:sns:us-east-1:111111111111:${alarmTopicName({ name: 'production' })}`;
    const mute = alarms
      .filter(([, alarm]) => {
        const actions = alarm.Properties.AlarmActions ?? [];
        return actions.length !== 1 || !JSON.stringify(actions).includes(arn);
      })
      .map(([name]) => name);
    expect(mute).toEqual([]);
  });

  it('refuse an alarm created by hand without an action', () => {
    const app = appFor('production', { alarmEmail: ADDRESS });
    const environment = environmentOf(app.node);
    const stack = new Stack(app, 'Loose', {
      env: { account: environment.account, region: environment.region },
    });
    new Alarm(stack, 'Mute', {
      metric: new Metric({ namespace: 'MemorySmith', metricName: 'Anything' }),
      threshold: 1,
      evaluationPeriods: 1,
    });
    guardAlarms(app, environment);
    expect(() => app.synth()).toThrow(/has no action/);
  });

  it('cannot be synthesised without an address to notify', () => {
    expect(() => environmentOf(appFor('production').node)).toThrow(/no address to notify/);
    expect(() =>
      environmentOf(appFor('production', { alarmEmail: 'not an address' }).node),
    ).toThrow(/no address to notify/);
  });
});

describe('the alarms of staging', () => {
  it('do not exist, and neither does a topic for them', () => {
    // An address passed by mistake changes nothing: staging carries no alarms.
    const { all } = stacksOf(appFor('staging', { alarmEmail: ADDRESS }));
    expect(alarmsOf(all)).toEqual([]);
    for (const stack of all) Template.fromStack(stack).resourceCountIs('AWS::SNS::Topic', 0);
  });

  it('refuse an alarm created by hand', () => {
    const app = appFor('staging');
    const environment = environmentOf(app.node);
    const stack = new Stack(app, 'Loose', {
      env: { account: environment.account, region: environment.region },
    });
    new Alarm(stack, 'Stray', {
      metric: new Metric({ namespace: 'MemorySmith', metricName: 'Anything' }),
      threshold: 1,
      evaluationPeriods: 1,
    });
    guardAlarms(app, environment);
    expect(() => app.synth()).toThrow(/carries no alarms/);
  });
});

describe('the choice of an environment', () => {
  it('is production with alarms and staging without, and no address is ever in cdk.json', () => {
    const text = readText('memorysmithapp-infra/cdk.json');
    const declared = (
      JSON.parse(text) as { context: { environments: Record<string, { alarms?: unknown }> } }
    ).context.environments;
    expect(declared['production']?.alarms).toBe(true);
    expect(declared['staging']?.alarms).toBe(false);
    expect(text).not.toMatch(/alarmEmail|@[a-z0-9-]+\.[a-z]/i);
  });

  it('is declared in cdk.json, never assumed', () => {
    const { alarms: _omitted, ...staging } = ENVIRONMENTS.staging;
    const app = new App({
      context: { environment: 'staging', environments: { staging } },
    });
    expect(() => environmentOf(app.node)).toThrow(/whether it carries alarms/);
  });
});
