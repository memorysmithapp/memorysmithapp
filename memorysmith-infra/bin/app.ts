/**
 * CDK app entrypoint. Which stacks are instantiated here is the release lever
 * described in architecture-guide.md, section 24: the modular monolith
 * instantiates this list, and moving to per-service deployables later means
 * changing THIS file, not the stacks.
 *
 * Everything runs in one region. CloudFront requires its certificate in
 * us-east-1 by its own rule, which is why the network stack lives there.
 */

import { App, Tags } from 'aws-cdk-lib';
import { NetworkStack } from '../stacks/network.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { DataStack } from '../stacks/data.stack.js';
import { ApiStack } from '../stacks/api.stack.js';
import { ProjectionsStack } from '../stacks/projections.stack.js';
import { AgentStack } from '../stacks/agent.stack.js';
import { FrontendHostingStack } from '../stacks/frontend-hosting.stack.js';

const app = new App();
const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
};

/** A sandbox may drop its data on destroy; a real environment never does. */
const retainData = app.node.tryGetContext('retainData') !== 'false';

const network = new NetworkStack(app, 'MemorysmithNetwork', { env });

// Data comes before Identity: the pre-token-generation trigger reads the links
// of the user from mv-access, which is what turns the active subscription into
// a signed claim (§8.5).
const data = new DataStack(app, 'MemorysmithData', { env, retainData });

const identity = new IdentityStack(app, 'MemorysmithIdentity', {
  env,
  mcpOrigin: `https://${network.mcpDomainName}`,
  accessTable: data.accessTable.table,
  authDomainName: network.authDomainName,
  authCertificate: network.authCertificate,
  hostedZone: network.hostedZone,
});

const api = new ApiStack(app, 'MemorysmithApi', {
  env,
  data,
  hostedZone: network.hostedZone,
  certificate: network.apiCertificate,
  apiDomainName: network.apiDomainName,
  cognitoIssuer: identity.issuer,
  frontendOrigin: `https://${network.siteDomainName}`,
});

new ProjectionsStack(app, 'MemorysmithProjections', { env, data });

new AgentStack(app, 'MemorysmithAgent', {
  env,
  hostedZone: network.hostedZone,
  certificate: network.mcpCertificate,
  mcpDomainName: network.mcpDomainName,
  userPool: identity.userPool,
  hostedUiOrigin: identity.hostedUiOrigin,
  proxyClient: identity.proxyClient,
  internalApiOrigin: api.apiOrigin,
});

new FrontendHostingStack(app, 'MemorysmithFrontend', {
  env,
  hostedZone: network.hostedZone,
  certificate: network.siteCertificate,
  domainName: network.siteDomainName,
});

Tags.of(app).add('app:project', 'memorysmith');
Tags.of(app).add('app:version', '0.1.0');
