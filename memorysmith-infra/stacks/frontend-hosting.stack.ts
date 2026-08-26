/**
 * The SPA on S3 behind CloudFront with Origin Access Control
 * (architecture-guide.md, section 17).
 *
 * The bucket is private: only the distribution reads it. `www` is a permanent
 * redirect to the apex, and both records are created here, in code, like every
 * other record of the zone.
 */

import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
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
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { ARecord, RecordTarget, type IHostedZone } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import type { Construct } from 'constructs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(here, '..', '..', 'memorysmith-frontend', 'dist');

export interface FrontendHostingStackProps extends StackProps {
  readonly hostedZone: IHostedZone;
  /** CloudFront requires its certificate in us-east-1, by its own rule. */
  readonly certificate: ICertificate;
  readonly domainName: string;
}

export class FrontendHostingStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    const bucket = new Bucket(this, 'SiteBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    /**
     * A single-page app answers every path with index.html, and the router
     * takes it from there. Rewriting at the edge keeps a deep link working on
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

    // The deployment only happens when the SPA has been built, so `cdk synth`
    // works on a clean checkout.
    if (existsSync(frontendDist)) {
      new BucketDeployment(this, 'SiteDeployment', {
        sources: [Source.asset(frontendDist)],
        destinationBucket: bucket,
        distribution,
        distributionPaths: ['/*'],
        cacheControl: [{ toString: () => 'public, max-age=31536000, immutable' } as never],
        prune: true,
        memoryLimit: 512,
      });
    }

    void Duration;
  }
}
