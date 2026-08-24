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
  readonly mcpDomainName: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const zoneName = this.node.tryGetContext('hostedZoneName') as string;
    const zoneId = this.node.tryGetContext('hostedZoneId') as string;
    this.mcpDomainName = `mcp.${zoneName}`;

    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: zoneId,
      zoneName,
    });

    this.mcpCertificate = new acm.Certificate(this, 'McpCertificate', {
      domainName: this.mcpDomainName,
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });
  }
}
