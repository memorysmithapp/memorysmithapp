/**
 * The host a kept file and an export are read from (#255). What makes it safe
 * is four lines of a template no compiler reads: the host the API is told to
 * answer on, a distribution that forwards everything but Host — so S3 checks
 * the very request it signed —, one that only reads, and the headers that
 * keep something somebody uploaded from running when it is opened on its own.
 */

import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf, stackId, type EnvironmentConfig } from '../config/environments.js';
import { DataStack } from '../stacks/data.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { ApiStack } from '../stacks/api.stack.js';

const ENVIRONMENTS = {
  staging: {
    account: '222222222222',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    delegations: [],
  },
};

/** The managed origin request policy `AllViewerExceptHostHeader`. */
const ALL_VIEWER_EXCEPT_HOST_HEADER = 'b689b0a8-53d0-40ab-baf2-68738e2966ac';

function template(): Template {
  // No bundling: this case reads a template, and a Lambda bundle is not one.
  const app = new App({
    context: { environment: 'staging', environments: ENVIRONMENTS, 'aws:cdk:bundling-stacks': [] },
  });
  const environment: EnvironmentConfig = environmentOf(app.node);
  const env = { account: environment.account, region: environment.region };

  const network = new NetworkStack(app, stackId(environment, 'Network'), { env, environment });
  const data = new DataStack(app, stackId(environment, 'Data'), {
    env,
    environment,
    siteOrigin: `https://${network.siteDomainName}`,
  });
  const identity = new IdentityStack(app, stackId(environment, 'Identity'), {
    env,
    environment,
    accessTable: data.accessTable.table,
    mcpOrigin: `https://${network.mcpDomainName}`,
    siteDomainName: network.siteDomainName,
    authDomainName: network.authDomainName,
    authCertificate: network.authCertificate,
    hostedZone: network.hostedZone,
    senderAddress: network.senderAddress,
  });
  const api = new ApiStack(app, stackId(environment, 'Api'), {
    env,
    environment,
    data,
    hostedZone: network.hostedZone,
    certificate: network.apiCertificate,
    apiDomainName: network.apiDomainName,
    uploadsDomainName: network.uploadsDomainName,
    uploadsCertificate: network.uploadsCertificate,
    filesDomainName: network.filesDomainName,
    filesCertificate: network.filesCertificate,
    userPool: identity.userPool,
    cognitoIssuer: identity.issuer,
    connectorClientId: identity.proxyClient.userPoolClientId,
    webClientId: identity.webClient.userPoolClientId,
    frontendOrigin: `https://${network.siteDomainName}`,
  });
  return Template.fromStack(api);
}

interface DistributionConfig {
  Aliases?: string[];
  DefaultCacheBehavior: {
    AllowedMethods: string[];
    OriginRequestPolicyId?: string;
    ResponseHeadersPolicyId?: { Ref?: string };
  };
}

function distributionOn(api: Template, host: string): DistributionConfig {
  const found = Object.values(api.findResources('AWS::CloudFront::Distribution'))
    .map(
      (resource) =>
        (resource.Properties as { DistributionConfig: DistributionConfig }).DistributionConfig,
    )
    .find((config) => config.Aliases?.includes(host));
  if (!found) throw new Error(`No distribution answers ${host}`);
  return found;
}

describe('the files host', () => {
  const api = template();

  it('is where the API answers a link to a file or an export', () => {
    api.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({ FILES_ORIGIN: 'https://files.stg.memorysmith.app' }),
      },
    });
  });

  it('hands S3 the request it signed, and only reads', () => {
    const behaviour = distributionOn(api, 'files.stg.memorysmith.app').DefaultCacheBehavior;

    expect(behaviour.OriginRequestPolicyId).toBe(ALL_VIEWER_EXCEPT_HOST_HEADER);
    expect([...behaviour.AllowedMethods].sort()).toEqual(['GET', 'HEAD', 'OPTIONS']);
  });

  it('serves what it reads with nosniff and in a sandbox that runs no script', () => {
    const behaviour = distributionOn(api, 'files.stg.memorysmith.app').DefaultCacheBehavior;
    const policyId = behaviour.ResponseHeadersPolicyId?.Ref;
    expect(policyId).toBeDefined();

    const policy = api.toJSON().Resources[policyId as string] as {
      Properties: {
        ResponseHeadersPolicyConfig: {
          SecurityHeadersConfig: {
            ContentTypeOptions: { Override: boolean };
            ContentSecurityPolicy: { ContentSecurityPolicy: string; Override: boolean };
          };
        };
      };
    };
    const headers = policy.Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
    const csp = headers.ContentSecurityPolicy.ContentSecurityPolicy;

    expect(headers.ContentTypeOptions.Override).toBe(true);
    expect(headers.ContentSecurityPolicy.Override).toBe(true);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/(^|; )sandbox($|;)/);
    expect(csp).not.toContain('script-src');
  });

  it('leaves the uploads host as people allowed it', () => {
    const behaviour = distributionOn(api, 'uploads.stg.memorysmith.app').DefaultCacheBehavior;

    expect(behaviour.AllowedMethods).toContain('PUT');
    expect(behaviour.ResponseHeadersPolicyId).toBeUndefined();
  });
});
