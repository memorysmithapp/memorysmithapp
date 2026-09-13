/**
 * The SPA on S3 behind CloudFront with Origin Access Control
 * (architecture-guide.md, section 17). The bucket, the distribution and the two
 * records, and nothing that is published into them: that is the release stack,
 * which goes last.
 *
 * The bucket is private: only the distribution reads it. `www` is a permanent
 * redirect to the apex, and both records are created here, in code, like every
 * other record of the zone.
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
  readonly hostedZone: IHostedZone;
  /** CloudFront requires its certificate in us-east-1, by its own rule. */
  readonly certificate: ICertificate;
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
    // Where a functional run publishes the document that names it to the connector (section 19).
    new CfnOutput(this, 'SiteBucketName', { value: bucket.bucketName });

    /**
     * Two jobs at the edge, both cheap enough to run on every request.
     *
     * `www` answers with a PERMANENT redirect to the apex (section 17), so the
     * site has one address and not two: two addresses split the cache, split
     * the cookies and turn every absolute link into a coin flip.
     *
     * And a single-page app answers every path with index.html, with the
     * router taking it from there. Rewriting here keeps a deep link working on
     * a hard refresh without turning the bucket into a website endpoint.
     */
    const rewrite = new CloudFrontFunction(this, 'SpaRewrite', {
      code: FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;

  if (host && host.indexOf('www.') === 0) {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://' + host.slice(4) + request.uri },
        'cache-control': { value: 'max-age=3600' },
      },
    };
  }

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
      domainNames: [props.domainName, `www.${props.domainName}`],
      certificate: props.certificate,
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    for (const [id, recordName] of [
      ['ApexRecord', props.domainName],
      ['WwwRecord', `www.${props.domainName}`],
    ] as const) {
      new ARecord(this, id, {
        zone: props.hostedZone,
        recordName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });
    }

    this.bucket = bucket;
    this.distribution = distribution;
  }
}
