/**
 * Network stack: the memorysmith.app hosted zone reference and the regional
 * ACM certificate for the MCP host (architecture-guide.md, section 17).
 *
 * The hosted zone already exists (created when the domain was delegated); this
 * stack references it by id from cdk.json context instead of looking it up, so
 * `cdk synth` works without AWS credentials.
 */

import { Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export class NetworkStack extends Stack {
  readonly hostedZone: route53.IHostedZone;
  readonly mcpCertificate: acm.ICertificate;
  readonly apiCertificate: acm.ICertificate;
  /**
   * CloudFront requires its certificate in us-east-1. That is its rule, not a
   * choice; the rest of the infrastructure stays in the main region. This
   * stack is deployed in us-east-1, so the same certificate serves both.
   */
  readonly siteCertificate: acm.ICertificate;
  /** The sign-in page lives on our own domain, not on the provider's. */
  readonly authCertificate: acm.ICertificate;
  readonly mcpDomainName: string;
  readonly apiDomainName: string;
  readonly siteDomainName: string;
  readonly authDomainName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const zoneName = this.node.tryGetContext('hostedZoneName') as string;
    const zoneId = this.node.tryGetContext('hostedZoneId') as string;
    this.mcpDomainName = `mcp.${zoneName}`;
    this.apiDomainName = `api.${zoneName}`;
    this.siteDomainName = zoneName;
    this.authDomainName = `auth.${zoneName}`;

    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: zoneId,
      zoneName,
    });

    // One certificate per distribution, with SANs covering its hosts
    // (section 17). Public ACM certificates cost nothing, and they renew
    // themselves, which is why none of them is ever handled by hand.
    this.mcpCertificate = new acm.Certificate(this, 'McpCertificate', {
      domainName: this.mcpDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    /**
     * Cognito wants this one in us-east-1, the same rule CloudFront has, and
     * this stack already lives there.
     */
    this.authCertificate = new acm.Certificate(this, 'AuthCertificate', {
      domainName: this.authDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    this.apiCertificate = new acm.Certificate(this, 'ApiCertificate', {
      domainName: this.apiDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    this.siteCertificate = new acm.Certificate(this, 'SiteCertificate', {
      domainName: zoneName,
      subjectAlternativeNames: [`www.${zoneName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
