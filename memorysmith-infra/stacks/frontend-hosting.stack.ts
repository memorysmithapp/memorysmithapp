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
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
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

    // The deployment only happens when the SPA has been built, so `cdk synth`
    // works on a clean checkout.
    if (existsSync(frontendDist)) {
      /**
       * Two deployments, because the two kinds of file want opposite things.
       *
       * An asset carries a content hash in its name, so a new build is a new
       * name and the old one can be cached forever. The entry document does
       * NOT: its name stays put across builds, so caching it would pin every
       * visitor to the version they happened to load first.
       */
      new BucketDeployment(this, 'SiteAssets', {
        sources: [Source.asset(frontendDist, { exclude: ['index.html'] })],
        destinationBucket: bucket,
        cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
        prune: false,
        memoryLimit: 512,
      });

      new BucketDeployment(this, 'SiteEntry', {
        sources: [Source.asset(frontendDist, { exclude: ['assets/*'] })],
        destinationBucket: bucket,
        cacheControl: [CacheControl.fromString('no-cache, must-revalidate')],
        distribution,
        distributionPaths: ['/*'],
        prune: false,
        memoryLimit: 512,
      });
    }

    void Duration;
  }
}
