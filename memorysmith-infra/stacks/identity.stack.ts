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
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { UserPoolDomainTarget } from 'aws-cdk-lib/aws-route53-targets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
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
  /** The sign-in page lives here, e.g. auth.memorysmith.app */
  authDomainName: string;
  authCertificate: ICertificate;
  hostedZone: IHostedZone;
}

export class IdentityStack extends Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolDomain: cognito.UserPoolDomain;
  /**
   * Where the sign-in page answers. Everything that builds an OAuth URL reads
   * this instead of assembling one, so the day the domain changes there is a
   * single place that knows.
   */
  readonly hostedUiOrigin: string;
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

    this.hostedUiOrigin = `https://${props.authDomainName}`;

    /**
     * Managed login, not the classic hosted UI. The classic page accepts a
     * fixed list of CSS properties that has no border radius for the card and
     * no font family at all, so dressing it stops at colour. Managed login is
     * the branding surface that carries a logo, a radius and the palette, and
     * it is the only way this page can look like the product.
     */
    /**
     * Our own domain, not the provider's. The sign-in page is the one screen
     * of the product served by someone else, and an address from another
     * company on it is the seam showing at the worst possible moment: the one
     * where the person is typing a password.
     *
     * A user pool holds ONE domain, so this replaced the prefix domain rather
     * than joining it. The issuer of the tokens does not move with it: it is
     * `cognito-idp.{region}.amazonaws.com/{poolId}` and stays put, so nothing
     * that validates a token is affected by the change.
     */
    this.userPoolDomain = this.userPool.addDomain('HostedDomain', {
      customDomain: { domainName: props.authDomainName, certificate: props.authCertificate },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    new ARecord(this, 'AuthRecord', {
      zone: props.hostedZone,
      recordName: props.authDomainName,
      target: RecordTarget.fromAlias(new UserPoolDomainTarget(this.userPoolDomain)),
    });
    void domainPrefix;

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

    /**
     * Vertical breathing room until the artwork fits a ratio the provider
     * accepts. A logo must be between 1:1 and 4:1, and the horizontal
     * signature is almost 6:1, so it is padded rather than cropped or
     * stretched: the extra space is transparent and reads as the clear space
     * the brand book already asks for around the signature (page 05).
     */
    const paddedToRatio = (file: string, maxRatio: number): string => {
      const svg = readFileSync(join(here, '..', 'branding', file), 'utf8');
      const box = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
      if (!box) throw new Error(`${file} has no viewBox to pad`);

      const [x, y, width, height] = box.slice(1).map(Number) as [number, number, number, number];
      const wanted = Math.max(height, width / maxRatio);
      if (wanted <= height) return Buffer.from(svg).toString('base64');

      const padded = `viewBox="${x} ${y - (wanted - height) / 2} ${width} ${wanted}"`;
      return Buffer.from(
        svg.replace(box[0], padded).replace(/height="[\d.]+"/, `height="${wanted}"`),
      ).toString('base64');
    };

    /**
     * The icons, exported from the brand book (page 08, "Ícone de app e
     * favicon") and committed as binaries. Everything else here is derived at
     * build time from the SVG, and this is the one thing that cannot be: ICO
     * is a raster format, and nothing in the toolchain rasterises a vector.
     * The four sizes inside each file are the ones the brand book names, plus
     * 256 for dense screens.
     */
    const icon = (file: string): string =>
      readFileSync(join(here, '..', 'branding', file)).toString('base64');

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
        /**
         * The full signature, symbol and logotype, exported from the brand
         * book (page 04) with the type already converted to curves. That last
         * part is why it can live here at all: Space Grotesk is loaded from a
         * font service at runtime and would never reach a page served by the
         * identity provider, so a logotype as live text would fall back to
         * some other typeface on the one screen where the brand is most
         * exposed. The tile background of the export was stripped: what lands
         * on the card has to be the signature, not a grey rectangle.
         */
        {
          category: 'FORM_LOGO',
          colorMode: 'LIGHT',
          extension: 'SVG',
          bytes: paddedToRatio('lockup-light.svg', 4),
        },
        {
          category: 'FORM_LOGO',
          colorMode: 'DARK',
          extension: 'SVG',
          bytes: paddedToRatio('lockup-dark.svg', 4),
        },
        /**
         * ONE favicon, transparent, for both colour modes. The symbol carries
         * its own colour and needs no plate behind it, so there is nothing for
         * a light and a dark version to differ about, and a single mark is
         * what a tab should show.
         *
         * It is still declared twice, once per colour mode, and that is the
         * provider's shape rather than ours: the page asks for the light or
         * the dark variant BY NAME, and a DYNAMIC asset is accepted on deploy
         * and then never requested. Both entries point at the same bytes.
         *
         * The .ico goes alongside the .svg because the page announces both and
         * a browser is free to prefer either; supplying only one leaves the
         * other pointing at the provider's default icon.
         */
        ...(['LIGHT', 'DARK'] as const).flatMap((colorMode) => [
          {
            category: 'FAVICON_SVG',
            colorMode,
            extension: 'SVG',
            bytes: squareSymbol('symbol.svg'),
          },
          {
            category: 'FAVICON_ICO',
            colorMode,
            extension: 'ICO',
            bytes: icon('favicon.ico'),
          },
        ]),
      ],
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'WebClientId', { value: this.webClient.userPoolClientId });
    new CfnOutput(this, 'CognitoDomain', { value: this.hostedUiOrigin });
  }
}
