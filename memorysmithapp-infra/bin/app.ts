/**
 * CDK app entrypoint. Which stacks are instantiated here is the release lever
 * of ADR-005: the modular monolith instantiates this list, and moving to
 * per-service deployables later means changing THIS file, not the stacks.
 *
 * One app, two environments: `-c environment=production|staging`
 * chooses which one a synth describes, and `config/environments.ts` reads what
 * differs between them from cdk.json.
 *
 * Everything runs in one region. CloudFront and the sign-in domain require
 * their certificates in us-east-1 by their own rule: the project's own
 * installation lives there, and one in another region declares those
 * certificates in a stack of their own, in us-east-1 (#342).
 */

import { App, Stack, Tags } from 'aws-cdk-lib';
import { NetworkStack } from '../stacks/network.stack.js';
import { IdentityStack } from '../stacks/identity.stack.js';
import { DataStack } from '../stacks/data.stack.js';
import { ApiStack } from '../stacks/api.stack.js';
import { ProjectionsStack } from '../stacks/projections.stack.js';
import { AgentStack } from '../stacks/agent.stack.js';
import { FrontendHostingStack } from '../stacks/frontend-hosting.stack.js';
import { FrontendReleaseStack } from '../stacks/frontend-release.stack.js';
import { GithubDeliveryStack, InstallationDeliveryStack } from '../stacks/github-delivery.stack.js';
import { ObservabilityStack } from '../stacks/observability.stack.js';
import { guardAlarms } from '../constructs/alarms.js';
import { deploymentOf, tagDelivery } from '../constructs/deployment.js';
import { environmentOf, stackId } from '../config/environments.js';
import { loadInstallationFile } from '../installation/index.js';

const app = new App();

loadInstallationFile(String(app.node.tryGetContext('environment') ?? 'production'));
const environment = environmentOf(app.node);
/** The environment, the version and the commit this deploy declares. */
const deployment = deploymentOf(app);

/**
 * The account comes from cdk.json and never from the credentials, so the CDK
 * refuses a deploy into any account but the one the environment names.
 * Production and staging name the same one, and what tells them apart is
 * `-c environment` and the names it produces.
 */
const env = { account: environment.account, region: environment.region };
const id = (name: string): string => stackId(environment, name);

/** The certificates that have to be in us-east-1, when the product is elsewhere. */
const outOfEdge = environment.region !== 'us-east-1' && environment.hostedZoneName !== null;
const edge = outOfEdge
  ? new Stack(app, stackId(environment, 'Edge'), {
      env: { account: environment.account, region: 'us-east-1' },
      crossRegionReferences: true,
    })
  : undefined;
/** What reads a certificate of that stack, across regions. */
const reference = outOfEdge ? { crossRegionReferences: true } : {};

/** A sandbox may drop its data on destroy; a real environment never does. */
const retainData = app.node.tryGetContext('retainData') !== 'false';

const network = new NetworkStack(app, id('Network'), {
  env,
  environment,
  ...reference,
  ...(edge ? { edge } : {}),
});

/** The zone, on an installation that has one. */
const zoned = network.hostedZone ? { hostedZone: network.hostedZone } : {};

// Data comes before Identity: the pre-token-generation trigger reads the links
// of the user from mv-access, which is what turns the active subscription into
// a signed claim (INV-02).
const data = new DataStack(app, id('Data'), {
  env,
  environment,
  retainData,
  siteOrigin: `https://${network.siteDomainName}`,
});

const identity = new IdentityStack(app, id('Identity'), {
  env,
  environment,
  ...reference,
  mcpOrigin: `https://${network.mcpDomainName}`,
  siteDomainName: network.siteDomainName,
  accessTable: data.accessTable.table,
  authDomainName: network.authDomainName,
  ...zoned,
  ...(network.authCertificate ? { authCertificate: network.authCertificate } : {}),
  senderAddress: network.senderAddress,
});

const api = new ApiStack(app, id('Api'), {
  env,
  environment,
  ...reference,
  data,
  ...zoned,
  ...(network.apiCertificate ? { certificate: network.apiCertificate } : {}),
  apiDomainName: network.apiDomainName,
  uploadsDomainName: network.uploadsDomainName,
  ...(network.uploadsCertificate ? { uploadsCertificate: network.uploadsCertificate } : {}),
  filesDomainName: network.filesDomainName,
  ...(network.filesCertificate ? { filesCertificate: network.filesCertificate } : {}),
  userPool: identity.userPool,
  cognitoIssuer: identity.issuer,
  connectorClientId: identity.proxyClient.userPoolClientId,
  webClientId: identity.webClient.userPoolClientId,
  frontendOrigin: `https://${network.siteDomainName}`,
  senderAddress: network.senderAddress,
});

const projections = new ProjectionsStack(app, id('Projections'), { env, environment, data });

const agent = new AgentStack(app, id('Agent'), {
  env,
  ...zoned,
  ...(network.mcpCertificate ? { certificate: network.mcpCertificate } : {}),
  mcpDomainName: network.mcpDomainName,
  userPool: identity.userPool,
  hostedUiOrigin: identity.hostedUiOrigin,
  proxyClient: identity.proxyClient,
  internalApiOrigin: api.apiOrigin,
  coreApi: api.httpApi,
  siteOrigin: `https://${network.siteDomainName}`,
});

const hosting = new FrontendHostingStack(app, id('Frontend'), {
  env,
  ...reference,
  ...zoned,
  ...(network.siteCertificate ? { certificate: network.siteCertificate } : {}),
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
    uploadsOrigin: api.uploadsOrigin,
    catalogOrigin: api.catalogOrigin,
    cognitoDomain: identity.hostedUiOrigin,
    cognitoClientId: identity.webClient.userPoolClientId,
    environment: deployment.environment,
    version: deployment.version,
  },
});

/**
 * What lets GitHub Actions deliver both environments: one OIDC provider and a
 * role per environment. It belongs to the account, not to an
 * environment, so only a synth of production, which owns the account, declares
 * it, and it is deployed by hand once, after `cdk bootstrap`:
 *
 *   cdk deploy MemorysmithGithubDelivery -c environment=production -c alarmEmail=<address>
 *
 * A delivery never names it, so no run can change what it may do.
 */
// Last of all: the dashboards and the daily count read what the stacks above
// declared, found in their construct trees (#270).
const observability = new ObservabilityStack(app, id('Observability'), {
  env,
  environment,
  data,
  sources: [identity, api, projections, agent],
});

if (environment.installation) {
  // One role per environment, deployed by `install` and never by a delivery.
  if (environment.oidcProviderArn) {
    const delivery = new InstallationDeliveryStack(app, stackId(environment, 'Delivery'), {
      env,
      environment,
    });
    Tags.of(delivery).add('app:project', 'memorysmith');
    Tags.of(delivery).add('app:installation', environment.installation);
  }
} else if (environment.name === 'production') {
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

const delivered = [
  network,
  data,
  identity,
  api,
  projections,
  agent,
  hosting,
  release,
  observability,
];
for (const stack of delivered) {
  Tags.of(stack).add('app:project', 'memorysmith');
  Tags.of(stack).add('app:environment', environment.name);
  if (environment.installation) Tags.of(stack).add('app:installation', environment.installation);
}
// Derived, never written literally: a version repeated by hand is a version that
// drifts, and this tag had been asserting 0.2.0 through two releases. It goes on
// what a deploy delivers, and never on the roles of GitHub, which deliver every
// version.
tagDelivery(delivered, deployment);

// Every alarm of the app is held to the environment at synthesis: in production
// it has the topic as its action, in staging it does not exist (#267).
guardAlarms(app, environment);
