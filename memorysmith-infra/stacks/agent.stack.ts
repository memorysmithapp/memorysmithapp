/**
 * Agent stack for the CIMD spike: the svc-agent Lambda (resource server +
 * authorization proxy + minimal MCP server) behind an HTTP API on
 * mcp.memorysmith.app (architecture-guide.md, sections 13 and 17).
 *
 * Transitional by design: when delivery 8 lands, the MCP host moves to the
 * modular-monolith deployable and this stack stops being instantiated.
 */

import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type * as acm from 'aws-cdk-lib/aws-certificatemanager';
import type * as cognito from 'aws-cdk-lib/aws-cognito';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { ServiceLambda } from '../constructs/service-lambda.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export interface AgentStackProps extends StackProps {
  hostedZone: route53.IHostedZone;
  certificate: acm.ICertificate;
  mcpDomainName: string;
  userPool: cognito.UserPool;
  userPoolDomain: cognito.UserPoolDomain;
  proxyClient: cognito.UserPoolClient;
  /**
   * Where the tools reach the other contexts. svc-agent forwards the caller's
   * own token, so the subscription that arrives at the core is the one fixed
   * at consent, and the client_id in that token is what becomes the agent
   * identity in the authorship (architecture-guide.md, sections 13.1, 14.1).
   */
  internalApiOrigin: string;
}

export class AgentStack extends Stack {
  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const publicOrigin = `https://${props.mcpDomainName}`;
    const cognitoDomain = `https://${props.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;
    const cognitoIssuer = `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`;

    // HMAC key that signs the state correlating the two OAuth legs. Rotating it
    // only invalidates in-flight authorization redirects (10-minute TTL).
    const stateSecret = new secretsmanager.Secret(this, 'StateSecret', {
      description: 'HMAC key for the CIMD proxy state parameter',
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });

    /**
     * Built through ServiceLambda like every other function, which is what
     * gives it Powertools, the mandatory alarms and a declared log group. It
     * also carries the createRequire banner: the AWS SDK is CommonJS inside,
     * and an ESM bundle without it dies at init with "Dynamic require of
     * node:https is not supported". The spike shipped without the banner and
     * this is where that showed up.
     */
    const service = new ServiceLambda(this, 'AgentFunction', {
      entry: join(here, '..', '..', 'memorysmith-backend', 'services', 'agent', 'src', 'lambda.ts'),
      description: 'MCP server and CIMD registration proxy.',
      timeout: Duration.seconds(15),
      environment: {
        PUBLIC_ORIGIN: publicOrigin,
        COGNITO_ISSUER: cognitoIssuer,
        COGNITO_DOMAIN: cognitoDomain,
        PROXY_CLIENT_ID: props.proxyClient.userPoolClientId,
        STATE_SECRET_ID: stateSecret.secretArn,
        INTERNAL_API_ORIGIN: props.internalApiOrigin,
      },
    });
    const fn = service.function;

    // The function reads the HMAC key itself. Injecting the value would store it
    // in plaintext on the function configuration and in the CloudFormation
    // template, where anyone with describe rights could read it.
    stateSecret.grantRead(fn);

    const domainName = new apigwv2.DomainName(this, 'McpDomain', {
      domainName: props.mcpDomainName,
      certificate: props.certificate,
    });

    const api = new apigwv2.HttpApi(this, 'McpApi', {
      apiName: 'memorysmith-mcp',
      defaultIntegration: new HttpLambdaIntegration('AgentIntegration', fn),
      defaultDomainMapping: { domainName },
    });

    new route53.ARecord(this, 'McpAliasRecord', {
      zone: props.hostedZone,
      recordName: props.mcpDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          domainName.regionalDomainName,
          domainName.regionalHostedZoneId,
        ),
      ),
    });

    new CfnOutput(this, 'McpEndpoint', { value: `${publicOrigin}/mcp` });
    new CfnOutput(this, 'ApiId', { value: api.apiId });
  }
}
