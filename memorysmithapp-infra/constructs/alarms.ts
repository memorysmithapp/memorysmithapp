/**
 * The alarms of an environment and where they go (#267).
 *
 * An alarm exists to reach a person. Production carries the mandatory alarms
 * and every one of them notifies one SNS topic, which the operator's address is
 * subscribed to; staging carries none, because it is disposable and is proved
 * by the smoke and the functional suite, never watched.
 *
 * Three pieces keep that true without anybody remembering it:
 *
 * - `AlarmTopic`, the destination, declared once per environment in the network
 *   stack, the first a delivery deploys, under a name the environment fixes;
 * - `mandatoryAlarm`, the only way an alarm is created here: it creates nothing
 *   where the environment carries no alarms, and attaches the topic where it
 *   does, so `ServiceLambda` hands every function a destination exactly as it
 *   hands it an alarm;
 * - `AlarmPolicy`, an aspect over the whole app, which fails the synthesis on an
 *   alarm in an environment without alarms and on an alarm without an action,
 *   so an `Alarm` created by hand is refused rather than shipped mute.
 */

import { Aspects, Stack, type IAspect } from 'aws-cdk-lib';
import { Alarm, CfnAlarm, type AlarmProps } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Topic, type ITopic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct, type IConstruct } from 'constructs';
import { environmentOf, physicalName, type EnvironmentConfig } from '../config/environments.js';

/** The name of the topic of an environment, which every alarm addresses by its ARN. */
export function alarmTopicName(environment: Pick<EnvironmentConfig, 'name'>): string {
  return physicalName(environment, 'memorysmith-alarms');
}

/**
 * The destination of the alarms of an environment, with its address
 * subscribed. AWS sends that address a confirmation, and until it is confirmed
 * the topic delivers nothing.
 */
export class AlarmTopic extends Construct {
  readonly topic: Topic;

  constructor(scope: Construct, id: string, props: { readonly environment: EnvironmentConfig }) {
    super(scope, id);
    const address = props.environment.alarmEmail;
    if (!props.environment.alarms || !address) {
      throw new Error(`The ${props.environment.name} environment has no alarms to send anywhere.`);
    }
    this.topic = new Topic(this, 'Topic', {
      topicName: alarmTopicName(props.environment),
      displayName: 'MemorySmith alarms',
    });
    this.topic.addSubscription(new EmailSubscription(address));
  }
}

/**
 * The topic as an action of the stack `scope` is in, addressed by its ARN, so a
 * stack that raises an alarm takes no reference on the network stack. One per
 * stack, however many alarms it holds.
 */
function destinationOf(scope: Construct, environment: EnvironmentConfig): ITopic {
  const stack = Stack.of(scope);
  const id = 'AlarmDestination';
  return (
    (stack.node.tryFindChild(id) as ITopic | undefined) ??
    Topic.fromTopicArn(
      stack,
      id,
      stack.formatArn({ service: 'sns', resource: alarmTopicName(environment) }),
    )
  );
}

/**
 * An alarm of the environment: created only where the environment carries alarms,
 * and always with the topic as its action. Returns nothing where it created
 * nothing.
 */
export function mandatoryAlarm(scope: Construct, id: string, props: AlarmProps): Alarm | undefined {
  const environment = environmentOf(scope.node);
  if (!environment.alarms) return undefined;
  const alarm = new Alarm(scope, id, props);
  alarm.addAlarmAction(new SnsAction(destinationOf(scope, environment)));
  return alarm;
}

/** Refuses, at synthesis, an alarm that would reach nobody or should not exist. */
export class AlarmPolicy implements IAspect {
  constructor(private readonly environment: EnvironmentConfig) {}

  visit(node: IConstruct): void {
    if (!(node instanceof CfnAlarm)) return;
    if (!this.environment.alarms) {
      throw new Error(
        `${node.node.path}: the ${this.environment.name} environment carries no alarms (#267). Create alarms through mandatoryAlarm.`,
      );
    }
    const actions: unknown = Stack.of(node).resolve(node.alarmActions);
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new Error(
        `${node.node.path}: an alarm of ${this.environment.name} has no action, so it would reach nobody (#267). Create alarms through mandatoryAlarm.`,
      );
    }
  }
}

/** Holds every alarm of `scope` and below it to the policy of the environment. */
export function guardAlarms(scope: IConstruct, environment: EnvironmentConfig): void {
  Aspects.of(scope).add(new AlarmPolicy(environment));
}
