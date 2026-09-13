/**
 * The last stage of the production pipeline: the tag and the GitHub Release of
 * the version that was just deployed (architecture-guide.md, section 20).
 *
 * Its private key never leaves Secrets Manager of the production account, and
 * the pipeline hands this command only the identifiers:
 *
 *   GITHUB_REPOSITORY          owner/name
 *   GITHUB_APP_ID              the release App
 *   GITHUB_APP_INSTALLATION_ID its installation on the repository
 *   GITHUB_APP_KEY_SECRET_ID   the secret holding its private key, in PEM
 *   COMMIT                     the commit that was deployed
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { appJwt, installationToken, publishRelease } from './lib/github-release.js';
import { baseVersionOf, changelogSection } from './lib/release.js';
import { readText } from './lib/repository.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`publish-release needs ${name}.`);
    process.exit(1);
  }
  return value;
}

const repository = required('GITHUB_REPOSITORY');
const appId = required('GITHUB_APP_ID');
const installationId = required('GITHUB_APP_INSTALLATION_ID');
const secretId = required('GITHUB_APP_KEY_SECRET_ID');
const commit = required('COMMIT');

const version = baseVersionOf(readText('CLAUDE.md'));
const notes = version ? changelogSection(readText('CHANGELOG.md'), version) : null;
if (!version || !notes) {
  console.error('CLAUDE.md and CHANGELOG.md name no version with notes to publish.');
  process.exit(1);
}

const secret = await new SecretsManagerClient({}).send(
  new GetSecretValueCommand({ SecretId: secretId }),
);
if (!secret.SecretString) {
  console.error(`${secretId} holds no private key.`);
  process.exit(1);
}

const token = await installationToken(appJwt(appId, secret.SecretString), installationId);
const outcome = await publishRelease({ token, repository, version, commit, notes });
process.stdout.write(`v${version}: tag ${outcome.tag}, release ${outcome.release}.\n`);
