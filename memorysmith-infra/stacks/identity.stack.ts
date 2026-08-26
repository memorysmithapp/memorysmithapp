/**
 * Identity stack for the CIMD spike: Cognito user pool, hosted-UI domain, the
 * single pre-registered app client used by the authorization proxy, a test
 * user, and a STUB pre-token-generation trigger that injects a fixed
 * subscription_id (architecture-guide.md, sections 8.5 and 13.3).
 *
 * The real trigger, which reads the active_subscription attribute and the
 * user-subscription link, replaces the stub in delivery 5.
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';

export interface IdentityStackProps extends StackProps {
  /** Public origin of the MCP service, e.g. https://mcp.memorysmith.app */
  mcpOrigin: string;
}

export class IdentityStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolDomain: cognito.UserPoolDomain;
  readonly proxyClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);

    // Spike-only stub: fixed subscription claims on every token. Delivery 5
    // replaces it with the trigger that resolves the user's active link.
    const preTokenGeneration = new lambda.Function(this, 'PreTokenGenerationStub', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      timeout: Duration.seconds(5),
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const claims = {
            subscription_id: '01SPIKE0000000000000000000',
            subscription_status: 'active',
          };
          event.response = {
            claimsAndScopeOverrideDetails: {
              idTokenGeneration: { claimsToAddOrOverride: claims },
              accessTokenGeneration: { claimsToAddOrOverride: claims },
            },
          };
          return event;
        };
      `),
    });

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'memorysmith-users',
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
    });
    // Access-token claim customization requires the V2_0 trigger event.
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG,
      preTokenGeneration,
      cognito.LambdaVersion.V2_0,
    );

    const domainPrefix = this.node.tryGetContext('cognitoDomainPrefix') as string;
    this.userPoolDomain = this.userPool.addDomain('HostedDomain', {
      cognitoDomain: { domainPrefix },
    });

    this.proxyClient = this.userPool.addClient('CimdProxyClient', {
      userPoolClientName: 'cimd-proxy',
      generateSecret: false,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`${props.mcpOrigin}/callback`],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    const testUserEmail = this.node.tryGetContext('testUserEmail') as string;
    new cognito.CfnUserPoolUser(this, 'TestUser', {
      userPoolId: this.userPool.userPoolId,
      username: testUserEmail,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [
        { name: 'email', value: testUserEmail },
        { name: 'email_verified', value: 'true' },
      ],
    });
  }
}
