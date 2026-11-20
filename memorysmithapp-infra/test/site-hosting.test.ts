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

      // It serves with the certificate of the apex alone (#509) ...
      const certificates = Template.fromStack(network).findResources(
        'AWS::CertificateManager::Certificate',
      );
      const apex = Object.entries(certificates).find(([id]) =>
        id.startsWith('SiteApexCertificate'),
      );
      const named = Object.entries(certificates).find(([id]) => id.startsWith('SiteCertificate'));
      expect(apex?.[1].Properties.SubjectAlternativeNames).toBeUndefined();
      expect(JSON.stringify(template.toJSON())).toContain(apex?.[0]);
      expect(JSON.stringify(template.toJSON())).not.toContain(named?.[0]);
      // ... while the network stack still exports the one that named www, until #510.
      const outputs = Object.values(Template.fromStack(network).toJSON().Outputs ?? {}) as Array<{
        Value?: unknown;
        Export?: unknown;
      }>;
      expect(
        outputs.some(
          (output) =>
            output.Export && JSON.stringify(output.Value) === JSON.stringify({ Ref: named?.[0] }),
        ),
      ).toBe(true);
    });
  }
});
