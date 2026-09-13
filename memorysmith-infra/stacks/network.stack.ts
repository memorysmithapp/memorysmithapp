/**
 * Network stack: the hosted zone of the environment and its certificates
 * (architecture-guide.md, section 17).
 *
 * The hosted zone already exists, created by hand once per environment, because
 * its name servers are drawn when it is created and recreating it would break
 * the delegation. This stack references it by id, from cdk.json, instead of
 * looking it up, so `cdk synth` works without AWS credentials.
 */

import { Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments.js';

export interface NetworkStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
}

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

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const zoneName = props.environment.hostedZoneName;
    this.mcpDomainName = `mcp.${zoneName}`;
    this.apiDomainName = `api.${zoneName}`;
    this.siteDomainName = zoneName;
    this.authDomainName = `auth.${zoneName}`;

    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: props.environment.hostedZoneId,
      zoneName,
    });

    /**
     * The zones below this one, delegated here, in code (section 17). The name
     * servers are the ones Route 53 drew when that zone was created, written in
     * cdk.json.
     *
     * The record replaces one that already exists, because the delegation is
     * needed before this stack is ever deployed: staging has to run, and be
     * validated, before the merge that delivers production for the first time,
     * so the record is written by hand once, with these same values, when an
     * installation is brought up. `deleteExisting` is safe only because it is
     * set from the day the record joined the stack; turning it on for a record
     * already deployed would delete that record. The CDK marks it deprecated for
     * the other half of that danger: a first deploy that fails after deleting the
     * record by hand leaves no delegation until one is written again, which costs
     * staging and never production.
     */
    props.environment.delegations.forEach((delegation, index) => {
      new route53.NsRecord(this, `Delegation${index}`, {
        zone: this.hostedZone,
        recordName: delegation.recordName,
        values: [...delegation.nameServers],
        ttl: Duration.days(2),
        deleteExisting: true,
      });
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
