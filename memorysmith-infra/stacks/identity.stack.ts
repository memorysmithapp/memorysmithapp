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
import { readFileSync } from 'node:fs';

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

    /**
     * Managed login, not the classic hosted UI. The classic page accepts a
     * fixed list of CSS properties that has no border radius for the card and
     * no font family at all, so dressing it stops at colour. Managed login is
     * the branding surface that carries a logo, a radius and the palette, and
     * it is the only way this page can look like the product.
     */
    this.userPoolDomain = this.userPool.addDomain('HostedDomain', {
      cognitoDomain: { domainPrefix },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
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
     * The sign-in page, dressed as the product.
     *
     * The settings document was NOT written by hand: it is the one Cognito
     * generates for a new branding, with the palette, the radius and the logo
     * patched into it. The schema is large and validated on deploy, so
     * starting from what the service itself produces is the difference
     * between a change and a guessing game.
     *
     * The symbol comes from the frontend, which owns the brand assets, so
     * there is one copy of it and not two that drift.
     */
    const brandAsset = (file: string): Buffer =>
      readFileSync(join(here, '..', '..', 'memorysmith-frontend', 'public', file));

    const symbol = (file: string): string => brandAsset(file).toString('base64');

    /**
     * The same symbol, on a square canvas. A favicon must be 1:1 and the
     * symbol is 320x231, so the art is centred in a square viewBox instead of
     * being stretched. Derived here rather than committed as a second file:
     * one symbol, one source, and no copy to drift.
     */
    const squareSymbol = (file: string): string => {
      const svg = brandAsset(file).toString('utf8');
      const box = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
      if (!box) throw new Error(`${file} has no viewBox to square`);

      const [x, y, width, height] = box.slice(1).map(Number) as [number, number, number, number];
      const side = Math.max(width, height);
      const squared = `viewBox="${x - (side - width) / 2} ${y - (side - height) / 2} ${side} ${side}"`;

      return Buffer.from(
        svg
          .replace(box[0], squared)
          .replace(/width="[\d.]+"/, `width="${side}"`)
          .replace(/height="[\d.]+"/, `height="${side}"`),
      ).toString('base64');
    };

    new cognito.CfnManagedLoginBranding(this, 'ManagedLoginBranding', {
      userPoolId: this.userPool.userPoolId,
      clientId: this.webClient.userPoolClientId,
      useCognitoProvidedValues: false,
      settings: JSON.parse(
        readFileSync(join(here, '..', 'branding', 'managed-login.json'), 'utf8'),
      ) as unknown,
      assets: [
        {
          category: 'FORM_LOGO',
          colorMode: 'LIGHT',
          extension: 'SVG',
          bytes: symbol('symbol.svg'),
        },
        {
          category: 'FORM_LOGO',
          colorMode: 'DARK',
          extension: 'SVG',
          bytes: symbol('symbol-dark.svg'),
        },
        /**
         * The same file the product uses as its own favicon, so the tab of the
         * sign-in page and the tab of the product carry one mark and not two.
         * It is supplied per colour mode, and not as DYNAMIC: the page asks
         * for the light or the dark variant by name, and a DYNAMIC asset is
         * accepted on deploy and then never requested.
         */
        {
          category: 'FAVICON_SVG',
          colorMode: 'LIGHT',
          extension: 'SVG',
          bytes: squareSymbol('symbol.svg'),
        },
        {
          category: 'FAVICON_SVG',
          colorMode: 'DARK',
          extension: 'SVG',
          bytes: squareSymbol('symbol-dark.svg'),
        },
      ],
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });
    new CfnOutput(this, 'CognitoDomain', {
      value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`,
    });
  }
}
