/**
 * The SPA on S3 behind CloudFront with Origin Access Control. The bucket, the
 * distribution and its record, and nothing that is published into them: that
 * is the release stack, which goes last.
 *
 * The bucket is private: only the distribution reads it. The application
 * answers on the apex alone: `www` belongs to the organization's website,
 * served from its own repository (#508), and CloudFront refuses one name on
 * two distributions. The record is created here, in code, like every other
 * record of the zone.
 */

import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import {
  AllowedMethods,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  HttpVersion,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { Construct } from 'constructs';

export interface FrontendHostingStackProps extends StackProps {
  /** Absent on the default endpoints of AWS: the distribution answers on its own host. */
  readonly hostedZone?: IHostedZone | undefined;
  /** CloudFront requires its certificate in us-east-1, by its own rule. */
  readonly certificate?: ICertificate | undefined;
  readonly domainName: string;
}

export class FrontendHostingStack extends Stack {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'SiteBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    // Where a functional run publishes the document that names it to the connector.
    new CfnOutput(this, 'SiteBucketName', { value: bucket.bucketName });

    /**
     * A single-page app answers every path with index.html, with the router
     * taking it from there. Rewriting at the edge keeps a deep link working on
     * a hard refresh without turning the bucket into a website endpoint.
     */
    const rewrite = new CloudFrontFunction(this, 'SpaRewrite', {
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) request.uri = '/index.html';
  return request;
}
`),
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
        functionAssociations: [{ function: rewrite, eventType: FunctionEventType.VIEWER_REQUEST }],
      },
      defaultRootObject: 'index.html',
      ...(props.certificate
        ? {
            domainNames: [props.domainName],
            certificate: props.certificate,
          }
        : {}),
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    const zone = props.hostedZone;
    if (zone) {
      new ARecord(this, 'ApexRecord', {
        zone,
        recordName: props.domainName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });
    } else {
      // What the next synthesis of the delivery reads back as this host (#342).
      new CfnOutput(this, 'SiteHost', { value: distribution.distributionDomainName });
    }

    this.bucket = bucket;
    this.distribution = distribution;
  }
}
