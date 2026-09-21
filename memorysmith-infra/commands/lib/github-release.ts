/**
 * The tag and the GitHub Release of a version, written by the release App
 * (architecture-guide.md, section 20).
 *
 * The production pipeline is the only thing that writes a `v*` tag, and it
 * writes it after the deploy succeeded, so a version tag means "this is in
 * production" by construction. It authenticates as a GitHub App of the
 * organization with a single permission, Contents: write: the connection the
 * pipeline reads the repository through can read and nothing else.
 *
 * The tag is ANNOTATED, like every tag of this repository, and the publication
 * is idempotent: an execution retried after the tag was written finds it,
 * checks that it points at the same commit, and goes on to the release.
 */

import { createSign } from 'node:crypto';

const API = 'https://api.github.com';

const base64url = (value: string | Buffer): string => Buffer.from(value).toString('base64url');

/**
 * The JWT a GitHub App authenticates as itself with. It is backdated a minute
 * for clock drift, as GitHub recommends, and lives nine minutes, under the ten
 * GitHub allows.
 */
export function appJwt(appId: string, privateKeyPem: string, now: number = Date.now()): string {
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: issuedAt, exp: issuedAt + 540, iss: appId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKeyPem).toString('base64url')}`;
}

type Fetch = typeof fetch;

async function call(
  fetchImpl: Fetch,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      'user-agent': 'memorysmith-release',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body: parsed };
}

function expect2xx(result: { status: number; body: Record<string, unknown> }, what: string): void {
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${what} answered ${result.status}: ${String(result.body['message'] ?? '')}`);
  }
}

/** A token of the installation, which is what writes to the repository. */
export async function installationToken(
  jwt: string,
  installationId: string,
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const result = await call(
    fetchImpl,
    jwt,
    'POST',
    `/app/installations/${installationId}/access_tokens`,
  );
  expect2xx(result, 'Creating an installation token');
  const token = result.body['token'];
  if (typeof token !== 'string') throw new Error('GitHub answered no installation token.');
  return token;
}

/** The commit a tag points at, following an annotated tag to its object. */
async function taggedCommit(fetchImpl: Fetch, token: string, repository: string, tag: string) {
  const ref = await call(fetchImpl, token, 'GET', `/repos/${repository}/git/ref/tags/${tag}`);
  if (ref.status === 404) return null;
  expect2xx(ref, `Reading the tag ${tag}`);
  const object = ref.body['object'] as { type: string; sha: string };
  if (object.type !== 'tag') return object.sha;
  const annotated = await call(
    fetchImpl,
    token,
    'GET',
    `/repos/${repository}/git/tags/${object.sha}`,
  );
  expect2xx(annotated, `Reading the annotation of ${tag}`);
  return (annotated.body['object'] as { sha: string }).sha;
}

export async function publishRelease(input: {
  readonly token: string;
  readonly repository: string;
  readonly version: string;
  readonly commit: string;
  readonly notes: string;
  readonly fetchImpl?: Fetch;
}): Promise<{ tag: 'created' | 'existing'; release: 'created' | 'existing' }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const tag = `v${input.version}`;
  const { token, repository } = input;

  let tagOutcome: 'created' | 'existing' = 'existing';
  const existing = await taggedCommit(fetchImpl, token, repository, tag);
  if (existing === null) {
    const annotation = await call(fetchImpl, token, 'POST', `/repos/${repository}/git/tags`, {
      tag,
      message: tag,
      object: input.commit,
      type: 'commit',
    });
    expect2xx(annotation, `Annotating ${tag}`);
    const ref = await call(fetchImpl, token, 'POST', `/repos/${repository}/git/refs`, {
      ref: `refs/tags/${tag}`,
      sha: annotation.body['sha'],
    });
    expect2xx(ref, `Creating ${tag}`);
    tagOutcome = 'created';
  } else if (existing !== input.commit) {
    throw new Error(
      `${tag} already points at ${existing}, and this deploy is ${input.commit}. A version names one commit.`,
    );
  }

  const release = await call(fetchImpl, token, 'GET', `/repos/${repository}/releases/tags/${tag}`);
  if (release.status === 200) return { tag: tagOutcome, release: 'existing' };
  if (release.status !== 404) expect2xx(release, `Reading the release of ${tag}`);

  const created = await call(fetchImpl, token, 'POST', `/repos/${repository}/releases`, {
    tag_name: tag,
    name: tag,
    body: input.notes,
    draft: false,
    prerelease: false,
  });
  expect2xx(created, `Publishing the release of ${tag}`);
  return { tag: tagOutcome, release: 'created' };
}
