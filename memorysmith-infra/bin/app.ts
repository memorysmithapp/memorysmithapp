/**
 * CDK app entrypoint. Which stacks are instantiated here is the release lever
 * described in architecture-guide.md, section 24: the 0.1.0 modular monolith
 * instantiates a short list, and moving to per-service deployables later means
 * changing THIS file, not the stacks.
 *
 * Spike scope (delivery 1): network + identity + agent only.
 */

import { App, Tags } from 'aws-cdk-lib';
import { NetworkStack } from '../stacks/network.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { AgentStack } from '../stacks/agent.stack.js';

const app = new App();
const env = {
  account: process.env['CDK_DEFAULT_ACCOUNT'],
  region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
};

const network = new NetworkStack(app, 'MemorysmithNetwork', { env });

const identity = new IdentityStack(app, 'MemorysmithIdentity', {
  env,
  mcpOrigin: `https://${network.mcpDomainName}`,
});

new AgentStack(app, 'MemorysmithAgent', {
  env,
  hostedZone: network.hostedZone,
  certificate: network.mcpCertificate,
  mcpDomainName: network.mcpDomainName,
  userPool: identity.userPool,
  userPoolDomain: identity.userPoolDomain,
  proxyClient: identity.proxyClient,
});

Tags.of(app).add('app:project', 'memorysmith');
Tags.of(app).add('app:version', '0.1.0');
