/**
 * Network stack: the hosted zone of the environment, its certificates and,
 * where the environment carries alarms, the topic they notify and, in
 * production, the cost budgets of the account.
 *
 * The hosted zone already exists, created by hand once per environment, because
 * its name servers are drawn when it is created and recreating it would break
 * the delegation. This stack references it by id, from cdk.json, instead of
 * looking it up, so `cdk synth` works without AWS credentials.
 *
 * An installation on the default endpoints of AWS has no zone (#342), so this
 * stack declares no certificate, no record and no sending identity for it, and
 * every host below is a name AWS gave.
 */

import { CfnWaitConditionHandle, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';
import type { EnvironmentConfig } from '../config/environments.js';
import { AlarmTopic, mandatoryAlarm } from '../constructs/alarms.js';
import { CostBudgets } from '../constructs/budgets.js';

export interface NetworkStackProps extends StackProps {
  readonly environment: EnvironmentConfig;
  /**
   * Where the certificates of CloudFront and of the sign-in page are declared
   * when the region is not us-east-1, whose rule they follow (#342). This
   * stack, otherwise.
   */
  readonly edge?: Construct;
}

export class NetworkStack extends Stack {
  readonly hostedZone?: route53.IPublicHostedZone;
  /** The address every message of the user pool leaves from (RN-ACC-017). */
  readonly senderAddress: string;
  readonly sendingIdentity?: ses.EmailIdentity;
  readonly mcpCertificate?: acm.ICertificate;
  readonly apiCertificate?: acm.ICertificate;
  /**
   * CloudFront requires its certificate in us-east-1. That is its rule, not a
   * choice; the rest of the infrastructure stays in the main region. The
   * project's own installation is in us-east-1, so this stack holds it;
   * another region declares it in `edge`.
   */
  readonly siteCertificate?: acm.ICertificate;
  /** The sign-in page lives on our own domain, not on the provider's. */
  readonly authCertificate?: acm.ICertificate;
  /**
   * Where the parts of an upload are sent (#241, RN-PRT-027): a host of the
   * product, so a client that allows domains one by one is asked for one it
   * can recognise. CloudFront fronts it, hence us-east-1 like the site's.
   */
  readonly uploadsCertificate?: acm.ICertificate;
  /**
   * Where a kept file and an export are read from (#255): a host of the
   * product a person sees in the tab and in the downloads, and still an origin
   * apart from the product's own.
   */
  readonly filesCertificate?: acm.ICertificate;
  readonly mcpDomainName: string;
  readonly apiDomainName: string;
  readonly siteDomainName: string;
  readonly authDomainName: string;
  readonly uploadsDomainName: string;
  readonly filesDomainName: string;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const zoneName = props.environment.hostedZoneName;
    const hosts = props.environment.hosts;
    const edge = props.edge ?? this;
    this.mcpDomainName = hosts?.mcp ?? `mcp.${zoneName}`;
    this.apiDomainName = hosts?.api ?? `api.${zoneName}`;
    this.siteDomainName = hosts?.site ?? `${zoneName}`;
    this.authDomainName = `auth.${zoneName}`;
    this.uploadsDomainName = hosts?.uploads ?? `uploads.${zoneName}`;
    this.filesDomainName = hosts?.files ?? `files.${zoneName}`;
    this.senderAddress = props.environment.senderAddress ?? `no-reply@${this.siteDomainName}`;

    if (zoneName) {
      const zone = route53.PublicHostedZone.fromPublicHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: props.environment.hostedZoneId ?? '',
        zoneName,
      });

      /**
       * The domain the messages of the pool leave from (RN-ACC-017), verified by
       * the DKIM records the CDK publishes in the zone, with a MAIL FROM of its own
       * so the envelope is the domain's too. It lives in this stack, the first a
       * delivery deploys, because Cognito sends only from a verified identity and a
       * new one verifies minutes after its records exist: the delivery waits for it
       * before the identity stack, the way it waits for DNS.
       */
      this.sendingIdentity = new ses.EmailIdentity(this, 'SendingIdentity', {
        identity: ses.Identity.publicHostedZone(zone),
        mailFromDomain: `mail.${zoneName}`,
      });

      /**
       * The zones below this one, delegated here, in code. The name
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
          zone,
          recordName: delegation.recordName,
          values: [...delegation.nameServers],
          ttl: Duration.days(2),
          deleteExisting: true,
        });
      });

      // One certificate per distribution, with SANs covering its hosts. Public
      // ACM certificates cost nothing, and they renew themselves, which is why
      // none of them is ever handled by hand.
      this.mcpCertificate = new acm.Certificate(this, 'McpCertificate', {
        domainName: this.mcpDomainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      /**
       * Cognito wants this one in us-east-1, the same rule CloudFront has, and
       * `edge` is there.
       */
      this.authCertificate = new acm.Certificate(edge, 'AuthCertificate', {
        domainName: this.authDomainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      this.apiCertificate = new acm.Certificate(this, 'ApiCertificate', {
        domainName: this.apiDomainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      this.uploadsCertificate = new acm.Certificate(edge, 'UploadsCertificate', {
        domainName: this.uploadsDomainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      this.filesCertificate = new acm.Certificate(edge, 'FilesCertificate', {
        domainName: this.filesDomainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      this.siteCertificate = new acm.Certificate(edge, 'SiteCertificate', {
        domainName: zoneName,
        subjectAlternativeNames: [`www.${zoneName}`],
        validation: acm.CertificateValidation.fromDns(zone),
      });
      this.hostedZone = zone;
    }

    /**
     * Where every alarm of the environment goes (#267). It lives here because
     * this is the first stack a delivery deploys, so the topic exists before any
     * alarm names it, and every alarm names it by the ARN its fixed name gives,
     * which ties no stack to this one. It exists wherever there is an address,
     * production always, even while a delivery carries no alarms (ADR-021): a
     * topic costs nothing, and one created again would ask for its subscription
     * to be confirmed again.
     */
    if (props.environment.alarmEmail) {
      new AlarmTopic(this, 'Alarms', { environment: props.environment });

      /**
       * Throttles of the whole account, in place of one alarm per function
       * (#318): no function reserves concurrency, so a throttle anywhere is the
       * account at its limit, and that is one fact, not twelve.
       */
      mandatoryAlarm(this, 'AccountThrottles', {
        alarmDescription: 'Lambda: throttled invocations in the account',
        metric: new Metric({
          namespace: 'AWS/Lambda',
          metricName: 'Throttles',
          statistic: 'Sum',
          period: Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
    }

    // With no zone and no address there is nothing here, and CloudFormation
    // refuses a template with no resource, while a delivery names this stack.
    if (!zoneName && !props.environment.alarmEmail) new CfnWaitConditionHandle(this, 'Empty');

    /**
     * The budgets of the account (#279), which production owns: declared once,
     * here, so a delivery of production creates them, and staging, which shares
     * the account, declares none of its own.
     */
    if (props.environment.name === 'production') {
      new CostBudgets(this, 'Budgets', { environment: props.environment });
    }
  }
}
