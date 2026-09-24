/**
 * CDK app entrypoint. Which stacks are instantiated here is the release lever
 * described in architecture-guide.md, section 24: the modular monolith
 * instantiates this list, and moving to per-service deployables later means
 * changing THIS file, not the stacks.
 *
 * One app, two environments (section 17): `-c environment=production|staging`
 * chooses which one a synth describes, and `config/environments.ts` reads what
 * differs between them from cdk.json.
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
import { FrontendReleaseStack } from '../stacks/frontend-release.stack.js';
import { GithubDeliveryStack } from '../stacks/github-delivery.stack.js';
import { deploymentOf, tagDelivery } from '../constructs/deployment.js';
import { environmentOf, stackId } from '../config/environments.js';

const app = new App();

const environment = environmentOf(app.node);
/** The environment, the version and the commit this deploy declares (section 23.3). */
const deployment = deploymentOf(app);

/**
 * The account comes from cdk.json and never from the credentials, so the CDK
 * refuses a deploy into any account but the one the environment names.
 * Production and staging name the same one, and what tells them apart is
 * `-c environment` and the names it produces (section 17).
 */
const env = { account: environment.account, region: environment.region };
const id = (name: string): string => stackId(environment, name);

/** A sandbox may drop its data on destroy; a real environment never does. */
const retainData = app.node.tryGetContext('retainData') !== 'false';

const network = new NetworkStack(app, id('Network'), { env, environment });

// Data comes before Identity: the pre-token-generation trigger reads the links
// of the user from mv-access, which is what turns the active subscription into
// a signed claim (§8.5).
const data = new DataStack(app, id('Data'), {
  env,
  environment,
  retainData,
  siteOrigin: `https://${network.siteDomainName}`,
});

const identity = new IdentityStack(app, id('Identity'), {
  env,
  environment,
  mcpOrigin: `https://${network.mcpDomainName}`,
  siteDomainName: network.siteDomainName,
  accessTable: data.accessTable.table,
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
});

const hosting = new FrontendHostingStack(app, id('Frontend'), {
  env,
  hostedZone: network.hostedZone,
  certificate: network.siteCertificate,
  domainName: network.siteDomainName,
});

// Last: what the interface reads at runtime names the API and the app client.
const release = new FrontendReleaseStack(app, id('FrontendRelease'), {
  env,
  bucket: hosting.bucket,
  distribution: hosting.distribution,
  config: {
    apiOrigin: api.apiOrigin,
    connectorOrigin: `https://${network.mcpDomainName}`,
    cognitoDomain: identity.hostedUiOrigin,
    cognitoClientId: identity.webClient.userPoolClientId,
    environment: deployment.environment,
    version: deployment.version,
  },
});

/**
 * What lets GitHub Actions deliver both environments: one OIDC provider and a
 * role per environment (section 20). It belongs to the account, not to an
 * environment, so only a synth of production, which owns the account, declares
 * it, and it is deployed by hand once, after `cdk bootstrap`:
 *
 *   cdk deploy MemorysmithGithubDelivery -c environment=production
 *
 * A delivery never names it, so no run can change what it may do.
 */
if (environment.name === 'production') {
  const named = (name: string) =>
    environmentOf({
      tryGetContext: (key) => (key === 'environment' ? name : app.node.tryGetContext(key)),
    });
  const github = new GithubDeliveryStack(app, 'MemorysmithGithubDelivery', {
    env,
    repository: environment.repository,
    subject: environment.repositorySubject,
    production: named('production'),
    staging: named('staging'),
  });
  Tags.of(github).add('app:project', 'memorysmith');
}

for (const stack of [network, data, identity, api, projections, agent, hosting, release]) {
  Tags.of(stack).add('app:project', 'memorysmith');
  Tags.of(stack).add('app:environment', environment.name);
}
// Derived, never written literally: a version repeated by hand is a version that
// drifts, and this tag had been asserting 0.2.0 through two releases. It goes on
// what a deploy delivers, and never on the roles of GitHub, which deliver every
// version.
tagDelivery([network, data, identity, api, projections, agent, hosting, release], deployment);
