/**
 * The tag and the GitHub Release of a version (architecture-guide.md, §20).
 *
 * **Written by whoever runs the command, with a token.** It used to be written
 * by a GitHub App of the organisation, because the only thing that wrote a
 * `v*` tag was the production pipeline — a process with no person inside it,
 * which therefore needed an identity of its own. Delivery came back to a
 * workstation, the pipeline was switched off and the App was removed, so the
 * tag is now written by the person running the release, and the guarantee it
 * used to carry moved to where it always did the work: this function.
 *
 * The tag is ANNOTATED, like every tag of this repository — an object in
 * `/git/tags` and only then a ref pointing at it — and the publication is
 * **idempotent**: an execution retried after the tag was written finds it,
 * refuses it if it points at another commit, and goes on to the release.
 */

const API = 'https://api.github.com';

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
