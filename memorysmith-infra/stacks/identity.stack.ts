/**
 * Identity stack for the CIMD spike: Cognito user pool, hosted-UI domain, the
 * single pre-registered app client used by the authorization proxy, a test
 * user, and a STUB pre-token-generation trigger that injects a fixed
 * subscription_id (architecture-guide.md, sections 8.5 and 13.3).
 *
 * The real trigger, which reads the active_subscription attribute and the
 * user-subscription link, replaces the stub in delivery 5.
 */

import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { ITable } from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { ServiceLambda } from '../constructs/service-lambda.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export interface IdentityStackProps extends StackProps {
  /** mv-access, where the links of the user live (exception 1 of §8.3). */
  accessTable: ITable;
  /** Public origin of the MCP service, e.g. https://mcp.memorysmith.app */
  mcpOrigin: string;
}

export class IdentityStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolDomain: cognito.UserPoolDomain;
  readonly proxyClient: cognito.UserPoolClient;
  /** The app client the SPA authenticates with (authorization code + PKCE). */
  readonly webClient: cognito.UserPoolClient;
  /** The issuer every service validates tokens against (section 13.2). */
  readonly issuer: string;

  constructor(scope: Construct, id: string, props: IdentityStackProps) {
    super(scope, id, props);

    /**
     * Where the active subscription becomes a signed claim (section 8.5). It
     * reads the links of the user from mv-access and the status from the META
     * item, and a user with no link gets no claim at all, which is exactly
     * what a platform session is.
     */
    const preTokenGeneration = new ServiceLambda(this, 'PreTokenGeneration', {
      entry: join(
        here,
        '..',
        '..',
        'memorysmith-backend',
        'services',
        'access',
        'src',
        'adapters',
        'inbound',
        'pre-token-generation.ts',
      ),
      description: 'Injects subscription_id and subscription_status into every token.',
      timeout: Duration.seconds(5),
      environment: { ACCESS_TABLE: props.accessTable.tableName },
    }).function;

    // It reads the links and the subscription metadata, and nothing else.
    props.accessTable.grantReadData(preTokenGeneration);

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
    const zoneName = this.node.tryGetContext('hostedZoneName') as string;
    this.issuer = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPool.userPoolId}`;

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

    /**
     * The SPA has its own app client, separate from the CIMD proxy: they have
     * different redirect URIs, different lifetimes and different reasons to be
     * rotated. Sharing one would tie the browser session to the connector.
     */
    this.webClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'memorysmith-web',
      generateSecret: false,
      authFlows: {
        userSrp: true,
        // Lets an account administrator obtain a token without the hosted UI,
        // which is how the deployment is verified end to end. It is reachable
        // only through the admin API, and that needs IAM permission on the
        // pool, so it grants nothing to whoever holds only a password.
        adminUserPassword: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${zoneName}/auth/callback`, 'http://localhost:5173/auth/callback'],
        logoutUrls: [`https://${zoneName}/`, 'http://localhost:5173/'],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    /**
     * The platform group. A PLATFORM_ADMIN operates the platform and is NOT a
     * role inside any subscription (software-vision.md, section 4.6): the
     * group is what the authorizer reads, and a session that carries it still
     * has no subscription claim, so it reaches no content.
     */
    new cognito.CfnUserPoolGroup(this, 'PlatformAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'platform-admin',
      description: 'Operates the platform: approves, rejects and suspends subscriptions.',
    });

    const testUserEmail = this.node.tryGetContext('testUserEmail') as string;
    const testUser = new cognito.CfnUserPoolUser(this, 'TestUser', {
      userPoolId: this.userPool.userPoolId,
      username: testUserEmail,
      desiredDeliveryMediums: ['EMAIL'],
      userAttributes: [
        { name: 'email', value: testUserEmail },
        { name: 'email_verified', value: 'true' },
      ],
    });

    const membership = new cognito.CfnUserPoolUserToGroupAttachment(
      this,
      'TestUserIsPlatformAdmin',
      {
        userPoolId: this.userPool.userPoolId,
        groupName: 'platform-admin',
        username: testUserEmail,
      },
    );
    membership.addDependency(testUser);

    /**
     * The hosted sign-in page, dressed as the product.
     *
     * Cognito's classic hosted UI only accepts a FIXED list of classes and, in
     * each of them, a fixed list of properties. `font-family` is not on that
     * list, so Space Grotesk and Inter cannot reach this page: what carries
     * the brand here is colour, weight and radius. The palette is the one from
     * the brand book (CLAUDE.md), and the button is Azul cofre so that the
     * only action on the page reads as the same action the product uses.
     *
     * Two limits of this page are worth naming, because they are Cognito's
     * and not ours. The PAGE background is not in the customizable list: only
     * the card is, so the card is white and reads as a card against whatever
     * Cognito paints behind it, exactly like the card of the product's own
     * screens. And the logo would need a raster upload through the
     * SetUICustomization API, which CloudFormation does not carry, while the
     * symbol only exists as SVG. An empty logo area is honest; a broken image
     * would not be, and a banner sized for a logo that never arrives is just
     * a gap.
     */
    new cognito.CfnUserPoolUICustomizationAttachment(this, 'HostedUiBranding', {
      userPoolId: this.userPool.userPoolId,
      // ALL, and not a single client: whoever signs in, including through the
      // connector, should meet the same page.
      clientId: 'ALL',
      css: [
        '.background-customizable { background-color: #FFFFFF; }',
        '.banner-customizable { background-color: #FFFFFF; padding: 8px 0 0 0; }',
        '.label-customizable { color: #0E1526; font-size: 13px; font-weight: 500; }',
        '.textDescription-customizable { color: #0E1526; font-size: 14px; padding-top: 8px; padding-bottom: 16px; }',
        '.legalText-customizable { color: #5A6272; font-size: 12px; margin-top: 16px; }',
        '.inputField-customizable { background: #FFFFFF; border: 1px solid #D5D8D3; border-radius: 8px; color: #0E1526; font-size: 14px; padding: 10px 12px; width: 100%; }',
        '.inputField-customizable:focus { border-color: #0F56D7; outline: 0; }',
        '.submitButton-customizable { background-color: #0F56D7; border: 0; border-radius: 8px; color: #FFFFFF; font-size: 14px; font-weight: 600; margin: 16px 0 8px 0; width: 100%; }',
        '.submitButton-customizable:hover { background-color: #0C46AF; color: #FFFFFF; }',
        '.idpButton-customizable { background: #FFFFFF; border: 1px solid #D5D8D3; border-radius: 8px; color: #0E1526; font-size: 14px; font-weight: 500; padding: 10px 12px; width: 100%; }',
        '.idpButton-customizable:hover { background: #E4E7E2; color: #0E1526; }',
        '.errorMessage-customizable { background: #FFF1E8; border: 1px solid #FF8A2B; color: #0E1526; font-size: 13px; padding: 10px 12px; text-align: left; }',
        '.redirect-customizable { padding: 8px 0; text-align: center; }',
      ].join('\n'),
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });
    new CfnOutput(this, 'CognitoDomain', {
      value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`,
    });
  }
}
