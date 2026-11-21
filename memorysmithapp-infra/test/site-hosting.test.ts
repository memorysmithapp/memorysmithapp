/**
 * The application answers on the apex of its zone alone (#508): `www` belongs
 * to the organization's website, served from its own repository. Its
 * certificate names the apex alone (#509).
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { environmentOf } from '../config/environments.js';
import { FrontendHostingStack } from '../stacks/frontend-hosting.stack.js';
import { NetworkStack } from '../stacks/network.stack.js';
import { appFor } from './stacks.js';

describe('the hosting of the application (#508)', () => {
  for (const name of ['production', 'staging'] as const) {
    it(`answers ${name} on the apex alone, and leaves www to the website`, () => {
      const app = appFor(name, { alarmEmail: 'alarms@example.com' });
      const environment = environmentOf(app.node);
      const env = { account: environment.account, region: environment.region };
      const network = new NetworkStack(app, 'Network', { env, environment });
      const hosting = new FrontendHostingStack(app, 'Frontend', {
        env,
        hostedZone: network.hostedZone,
        certificate: network.siteCertificate,
        domainName: network.siteDomainName,
      });
      const template = Template.fromStack(hosting);

      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: { Aliases: [network.siteDomainName] },
      });
      const records = Object.values(template.findResources('AWS::Route53::RecordSet'));
      expect(records).toHaveLength(1);
      expect(JSON.stringify(template.toJSON())).not.toContain(`www.${network.siteDomainName}`);

      // It serves with the one certificate of the site, naming the apex alone
      // (#509), and the network stack exports no other certificate for it: the
      // one that also named www is gone (#510).
      const networkTemplate = Template.fromStack(network);
      const certificates = networkTemplate.findResources('AWS::CertificateManager::Certificate');
      const site = Object.entries(certificates).filter(([id]) => id.startsWith('Site'));
      expect(site.map(([id]) => id.replace(/[0-9A-F]{8}$/, ''))).toEqual(['SiteApexCertificate']);
      expect(site[0]?.[1].Properties.DomainName).toBe(network.siteDomainName);
      expect(site[0]?.[1].Properties.SubjectAlternativeNames).toBeUndefined();
      expect(JSON.stringify(template.toJSON())).toContain(site[0]?.[0]);
      expect(JSON.stringify(networkTemplate.toJSON())).not.toContain(
        `www.${network.siteDomainName}`,
      );
      const outputs = Object.values(networkTemplate.toJSON().Outputs ?? {}) as Array<{
        Value?: unknown;
        Export?: unknown;
      }>;
      const exported = outputs
        .filter((output) => output.Export)
        .map((output) => (output.Value as { Ref?: string } | undefined)?.Ref)
        .filter((ref) => ref !== undefined && ref in certificates);
      expect(exported).toEqual([site[0]?.[0]]);
    });
  }
});
