/**
 * The application answers on the apex of its zone alone (#508): `www` belongs
 * to the organization's website, served from its own repository.
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
    });
  }
});
