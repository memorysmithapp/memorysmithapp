/**
 * Every stack of an environment that holds a function, an API or an alarm,
 * synthesised as the app synthesises them, for the cases that read templates
 * (#267, #269).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App, type Stack } from 'aws-cdk-lib';
import { afterAll } from 'vitest';
import { environmentOf, stackId, type EnvironmentName } from '../config/environments.js';
import { guardAlarms } from '../constructs/alarms.js';
import { AgentStack } from '../stacks/agent.stack.js';
import { ApiStack } from '../stacks/api.stack.js';
import { DataStack } from '../stacks/data.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { ObservabilityStack } from '../stacks/observability.stack.js';
import { ProjectionsStack } from '../stacks/projections.stack.js';

export const ENVIRONMENTS = {
  production: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'memorysmith.app',
    hostedZoneId: 'ZPRODUCTION',
    alarms: true,
    delegations: [],
  },
  staging: {
    account: '111111111111',
    region: 'us-east-1',
    hostedZoneName: 'stg.memorysmith.app',
    hostedZoneId: 'ZSTAGING',
    alarms: false,
    delegations: [],
  },
};

/**
 * Where the apps of a file are synthesised, removed when the file ends. An app
 * left to choose stages its assets in a directory of its own that nothing
 * removes, and the browser layer of the renderer alone is tens of megabytes.
 */
const outdirs: string[] = [];
afterAll(() => {
  for (const outdir of outdirs.splice(0)) rmSync(outdir, { recursive: true, force: true });
});

export function appFor(name: EnvironmentName, context: Record<string, unknown> = {}): App {
  const outdir = mkdtempSync(join(tmpdir(), 'cdk.out-test-'));
  outdirs.push(outdir);
  // No bundling: these cases read templates, and a Lambda bundle is not one.
  return new App({
    outdir,
    context: {
      environment: name,
      environments: ENVIRONMENTS,
      'aws:cdk:bundling-stacks': [],
      ...context,
    },
  });
}

/** The stacks of an environment that hold an alarm, or the topic they notify. */
export function stacksOf(app: App) {
  const environment = environmentOf(app.node);
  const env = { account: environment.account, region: environment.region };
  const id = (name: string): string => stackId(environment, name);

  const network = new NetworkStack(app, id('Network'), { env, environment });
  const data = new DataStack(app, id('Data'), {
    env,
    environment,
    siteOrigin: `https://${network.siteDomainName}`,
  });
  const identity = new IdentityStack(app, id('Identity'), {
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
  const api = new ApiStack(app, id('Api'), {
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
  const projections = new ProjectionsStack(app, id('Projections'), { env, environment, data });
  const agent = new AgentStack(app, id('Agent'), {
    env,
    hostedZone: network.hostedZone,
    certificate: network.mcpCertificate,
    mcpDomainName: network.mcpDomainName,
    userPool: identity.userPool,
    hostedUiOrigin: identity.hostedUiOrigin,
    proxyClient: identity.proxyClient,
    internalApiOrigin: api.apiOrigin,
    coreApi: api.httpApi,
    siteOrigin: `https://${network.siteDomainName}`,
  });
  const observability = new ObservabilityStack(app, id('Observability'), {
    env,
    environment,
    data,
    sources: [identity, api, projections, agent],
  });
  guardAlarms(app, environment);
  return {
    network,
    api,
    agent,
    projections,
    observability,
    all: [network, data, identity, api, projections, agent, observability] as Stack[],
  };
}
