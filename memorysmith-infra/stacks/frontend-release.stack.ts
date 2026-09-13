/**
 * The release of the interface: the bundle and `/config.json`, published into
 * the bucket of the hosting stack (architecture-guide.md, sections 17 and 23.3).
 *
 * It is a stack of its own because the two halves of the interface want
 * opposite places in the order of a deploy. The distribution and its records go
 * FIRST, before identity, because Cognito refuses a sign-in domain whose parent
 * resolves no A record. The release goes LAST, because `/config.json` names the
 * API and the app client, which only exist once their stacks do. The bundle is
 * built once, before any stack, and depends on neither.
 */

import { Stack, type StackProps } from 'aws-cdk-lib';
import type { IDistribution } from 'aws-cdk-lib/aws-cloudfront';
import type { IBucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDist = join(here, '..', '..', 'memorysmith-frontend', 'dist');

/** What the interface reads at runtime, and nothing else. */
export interface InterfaceConfig {
  readonly apiOrigin: string;
  readonly cognitoDomain: string;
  readonly cognitoClientId: string;
  readonly environment: string;
  readonly version: string;
}

export interface FrontendReleaseStackProps extends StackProps {
  readonly bucket: IBucket;
  readonly distribution: IDistribution;
  readonly config: InterfaceConfig;
}

export class FrontendReleaseStack extends Stack {
  constructor(scope: Construct, id: string, props: FrontendReleaseStackProps) {
    super(scope, id, props);

    // The bundle is published only when it has been built, so `cdk synth` works
    // on a clean checkout. The configuration is published either way.
    const built = existsSync(frontendDist);

    if (built) {
      /**
       * Two deployments, because the two kinds of file want opposite things.
       *
       * An asset carries a content hash in its name, so a new build is a new
       * name and the old one can be cached forever. The entry document and the
       * configuration do NOT: their names stay put across releases, so caching
       * them would pin every visitor to the release they happened to load first.
       */
      new BucketDeployment(this, 'SiteAssets', {
        sources: [Source.asset(frontendDist, { exclude: ['index.html', 'config.json'] })],
        destinationBucket: props.bucket,
        cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
        prune: false,
        memoryLimit: 512,
      });
    }

    new BucketDeployment(this, 'SiteEntry', {
      sources: [
        ...(built ? [Source.asset(frontendDist, { exclude: ['assets/*', 'config.json'] })] : []),
        Source.jsonData('config.json', props.config),
      ],
      destinationBucket: props.bucket,
      cacheControl: [CacheControl.fromString('no-cache, must-revalidate')],
      distribution: props.distribution,
      distributionPaths: ['/*'],
      prune: false,
      memoryLimit: 512,
    });
  }
}
