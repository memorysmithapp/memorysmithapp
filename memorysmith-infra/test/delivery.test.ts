/**
 * What closes a deploy: the smoke that asks every surface which version it
 * serves, and the tag and release the production pipeline writes afterwards
 * (architecture-guide.md, section 20).
 */

import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appJwt, publishRelease } from '../commands/lib/github-release.js';
import { smokeProblems, type SurfaceAnswers } from '../commands/lib/smoke.js';

const EXPECTED = { environment: 'staging', version: '0.6.0-rc.12+a1b2c3d' };

const serving: SurfaceAnswers = {
  api: {
    status: 200,
    body: { status: 'ok', ...EXPECTED, commit: 'a1b2c3d' },
    version: EXPECTED.version,
  },
  site: { status: 200, body: { ...EXPECTED, apiOrigin: 'https://api.stg.memorysmith.app' } },
  mcp: {
    status: 401,
    challenge:
      'Bearer resource_metadata="https://mcp.stg.memorysmith.app/.well-known/oauth-protected-resource"',
    version: EXPECTED.version,
  },
};

describe('the smoke of a deploy', () => {
  it('passes when every surface serves the version that was deployed', () => {
    expect(smokeProblems(EXPECTED, serving)).toEqual([]);
  });

  it('fails on a site still serving the previous release, which is what answering 200 hid', () => {
    const stale = { ...serving, site: { status: 200, body: { ...EXPECTED, version: '0.5.7' } } };
    expect(smokeProblems(EXPECTED, stale)).toEqual([
      'The site serves the version 0.5.7, and this deploy is 0.6.0-rc.12+a1b2c3d.',
    ]);
  });

  it('fails on an API that is up but is not this deploy', () => {
    const other = {
      ...serving,
      api: {
        status: 200,
        body: { status: 'ok', environment: 'production', version: '0.5.7' },
        version: '0.5.7',
      },
    };
    expect(smokeProblems(EXPECTED, other)).toHaveLength(3);
  });

  it('fails on an MCP endpoint that answers without the challenge an agent client needs', () => {
    const silent = { ...serving, mcp: { status: 404, challenge: null, version: null } };
    expect(smokeProblems(EXPECTED, silent)).toEqual([
      'The MCP endpoint answered 404 without the resource_metadata challenge.',
      'The MCP endpoint serves in its headers the version nothing, and this deploy is 0.6.0-rc.12+a1b2c3d.',
    ]);
  });
});

describe('the JWT the release App authenticates with', () => {
  it('is signed with its key, names the App, and lives under ten minutes', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const now = Date.UTC(2026, 8, 20, 12);
    const jwt = appJwt(
      '123456',
      privateKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
      now,
    );

    const [header, payload, signature] = jwt.split('.');
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature ?? '', 'base64url'))).toBe(true);

    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()) as Record<
      string,
      number | string
    >;
    expect(claims['iss']).toBe('123456');
    expect(Number(claims['exp']) - Number(claims['iat'])).toBeLessThan(600);
    expect(Number(claims['iat'])).toBeLessThan(now / 1000);
  });
});

/** A GitHub that answers from a table, and records what it was asked. */
function github(answers: Record<string, { status: number; body?: unknown }>) {
  const asked: string[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace('https://api.github.com', '')}`;
    asked.push(key);
    const answer = answers[key] ?? { status: 404 };
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
  }) as typeof fetch;
  return { asked, fetchImpl };
}

const RELEASE = {
  token: 'installation-token',
  repository: 'memorysmithapp/memorysmithapp',
  version: '0.6.0',
  commit: 'c0ffee',
  notes: '### Changed\n\n- A note is named by `name:`.',
};

describe('the tag and the release of a version', () => {
  it('annotate the deployed commit, point the tag at it, and publish the notes', async () => {
    const { asked, fetchImpl } = github({
      'POST /repos/memorysmithapp/memorysmithapp/git/tags': {
        status: 201,
        body: { sha: 'annotation' },
      },
      'POST /repos/memorysmithapp/memorysmithapp/git/refs': { status: 201 },
      'POST /repos/memorysmithapp/memorysmithapp/releases': { status: 201 },
    });

    const outcome = await publishRelease({ ...RELEASE, fetchImpl });

    expect(outcome).toEqual({ tag: 'created', release: 'created' });
    expect(asked).toEqual([
      'GET /repos/memorysmithapp/memorysmithapp/git/ref/tags/v0.6.0',
      'POST /repos/memorysmithapp/memorysmithapp/git/tags',
      'POST /repos/memorysmithapp/memorysmithapp/git/refs',
      'GET /repos/memorysmithapp/memorysmithapp/releases/tags/v0.6.0',
      'POST /repos/memorysmithapp/memorysmithapp/releases',
    ]);
  });

  it('go on from a tag a retried execution already wrote on the same commit', async () => {
    const { fetchImpl } = github({
      'GET /repos/memorysmithapp/memorysmithapp/git/ref/tags/v0.6.0': {
        status: 200,
        body: { object: { type: 'tag', sha: 'annotation' } },
      },
      'GET /repos/memorysmithapp/memorysmithapp/git/tags/annotation': {
        status: 200,
        body: { object: { sha: 'c0ffee' } },
      },
      'GET /repos/memorysmithapp/memorysmithapp/releases/tags/v0.6.0': { status: 200 },
    });

    expect(await publishRelease({ ...RELEASE, fetchImpl })).toEqual({
      tag: 'existing',
      release: 'existing',
    });
  });

  it('refuse a tag that already names another commit', async () => {
    const { fetchImpl } = github({
      'GET /repos/memorysmithapp/memorysmithapp/git/ref/tags/v0.6.0': {
        status: 200,
        body: { object: { type: 'commit', sha: 'deadbeef' } },
      },
    });

    await expect(publishRelease({ ...RELEASE, fetchImpl })).rejects.toThrow(
      'already points at deadbeef',
    );
  });
});
