/**
 * The alarms reach somebody wherever a delivery turns them on, and do not
 * exist where it does not, the default in both environments (#267, ADR-021).
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

describe('the alarms of production, turned on', () => {
  const app = appFor('production', { alarmEmail: ADDRESS, alarms: 'true' });
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
    const app = appFor('production', { alarmEmail: ADDRESS, alarms: true });
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

describe('the alarms of production, by default', () => {
  const { network, all } = stacksOf(appFor('production', { alarmEmail: ADDRESS }));

  it('do not exist', () => {
    expect(alarmsOf(all)).toEqual([]);
  });

  it('keep their topic and its confirmed subscription, which cost nothing', () => {
    Template.fromStack(network).hasResourceProperties('AWS::SNS::Topic', {
      TopicName: alarmTopicName({ name: 'production' }),
    });
  });
});

describe('the alarms of staging', () => {
  it('do not exist by default, and neither does a topic for them', () => {
    // An address passed by mistake changes nothing: staging carries no alarms.
    const { all } = stacksOf(appFor('staging', { alarmEmail: ADDRESS }));
    expect(alarmsOf(all)).toEqual([]);
    for (const stack of all) Template.fromStack(stack).resourceCountIs('AWS::SNS::Topic', 0);
  });

  it('exist when a delivery turns them on, each notifying the topic of staging', () => {
    const { all } = stacksOf(appFor('staging', { alarmEmail: ADDRESS, alarms: true }));
    const alarms = alarmsOf(all);
    expect(alarms.length).toBeGreaterThan(20);
    const arn = `:sns:us-east-1:111111111111:${alarmTopicName({ name: 'staging' })}`;
    expect(
      alarms.filter(([, alarm]) => !JSON.stringify(alarm.Properties.AlarmActions).includes(arn)),
    ).toEqual([]);
  });

  it('cannot be turned on without an address to notify', () => {
    expect(() => environmentOf(appFor('staging', { alarms: true }).node)).toThrow(
      /carries alarms, and no address to notify/,
    );
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

describe('what a delivery chooses', () => {
  it('is never in cdk.json, and neither is an address', () => {
    const text = readText('memorysmithapp-infra/cdk.json');
    expect(text).not.toMatch(/"(alarms|dashboards|tracing)"/);
    expect(text).not.toMatch(/alarmEmail|@[a-z0-9-]+\.[a-z]/i);
  });

  it('is refused when cdk.json declares it', () => {
    const app = new App({
      context: {
        environment: 'staging',
        environments: { staging: { ...ENVIRONMENTS.staging, alarms: true } },
      },
    });
    expect(() => environmentOf(app.node)).toThrow(/which a delivery chooses/);
  });

  it('is off unless the context turns it on, and only true or false', () => {
    const chosen = environmentOf(appFor('staging').node);
    expect([chosen.alarms, chosen.dashboards, chosen.tracing]).toEqual([false, false, false]);
    expect(environmentOf(appFor('staging', { tracing: 'true' }).node).tracing).toBe(true);
    expect(() => environmentOf(appFor('staging', { dashboards: 'yes' }).node)).toThrow(
      /true or false/,
    );
  });
});
