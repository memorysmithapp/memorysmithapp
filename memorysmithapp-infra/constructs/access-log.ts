/**
 * The access log of an HTTP API (architecture-guide.md, section 17): one JSON
 * line per request the gateway answered, a refusal before the function
 * included, to a log group declared here with the retention of every other
 * log of the product.
 *
 * It carries what the gateway knows and nothing of what the request carried:
 * the request id, which is also the correlation id the function logs when no
 * upstream hop handed one, the route, the status and the two latencies. Not
 * the path, whose segments a route may fill with what a person typed, not the
 * address of the caller and not a header.
 */

import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { CfnStage, HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';

/** The fields of an access line, as API Gateway fills them. */
export const ACCESS_LOG_FORMAT: Readonly<Record<string, string>> = {
  requestId: '$context.requestId',
  requestTime: '$context.requestTimeEpoch',
  httpMethod: '$context.httpMethod',
  routeKey: '$context.routeKey',
  status: '$context.status',
  responseLatency: '$context.responseLatency',
  integrationLatency: '$context.integrationLatency',
  integrationStatus: '$context.integrationStatus',
  errorMessage: '$context.error.message',
};

/** Declares the log group and points the default stage of the API at it. */
export function accessLogOf(scope: Construct, id: string, api: HttpApi): LogGroup {
  const logGroup = new LogGroup(scope, id, {
    retention: RetentionDays.ONE_MONTH,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  const stage = api.defaultStage?.node.defaultChild as CfnStage | undefined;
  if (!stage) {
    throw new Error(`${Stack.of(scope).stackName}: the API ${id} has no default stage to log`);
  }
  stage.accessLogSettings = {
    destinationArn: logGroup.logGroupArn,
    format: JSON.stringify(ACCESS_LOG_FORMAT),
  };
  return logGroup;
}
