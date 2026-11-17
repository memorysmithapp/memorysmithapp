/**
 * publish-release closes the milestone of the version it released (#460).
 */

import { describe, expect, it } from 'vitest';
import { closeMilestone } from '../commands/lib/github-release.js';

type Route = (method: string, path: string, body: unknown) => { status: number; body: unknown };

/** A GitHub that answers from `route`, and the calls it received. */
function github(route: Route) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = url.replace('https://api.github.com', '');
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method: init.method ?? 'GET', path, body });
    const answer = route(init.method ?? 'GET', path, body);
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

const MILESTONES = [
  { number: 31, title: 'v0.19.0', state: 'open' },
  { number: 30, title: 'v0.18.0', state: 'closed' },
];

function run(fetchImpl: typeof fetch, version: string) {
  return closeMilestone({ token: 't', repository: 'o/r', version, fetchImpl });
}

describe('the milestone of a released version', () => {
  it('is closed when it holds no open issue', async () => {
    const gh = github((method, path) => {
      if (path.startsWith('/repos/o/r/milestones?')) return { status: 200, body: MILESTONES };
      if (path.startsWith('/repos/o/r/issues?milestone=31')) return { status: 200, body: [] };
      if (method === 'PATCH' && path === '/repos/o/r/milestones/31')
        return { status: 200, body: {} };
      return { status: 404, body: {} };
    });
    const outcome = await run(gh.fetchImpl, '0.19.0');
    expect(outcome).toEqual({ action: 'closed', reason: 'Closed the milestone v0.19.0.' });
    expect(gh.calls.at(-1)).toEqual({
      method: 'PATCH',
      path: '/repos/o/r/milestones/31',
      body: { state: 'closed' },
    });
  });

  it('stays open, naming each open issue and pull request, and the release does not fail', async () => {
    const gh = github((_method, path) => {
      if (path.startsWith('/repos/o/r/milestones?')) return { status: 200, body: MILESTONES };
      if (path.startsWith('/repos/o/r/issues?milestone=31')) {
        return {
          status: 200,
          body: [
            { number: 465, title: 'About: Grok' },
            { number: 478, title: 'chore: delete CODEOWNERS', pull_request: {} },
          ],
        };
      }
      return { status: 404, body: {} };
    });
    const outcome = await run(gh.fetchImpl, '0.19.0');
    expect(outcome.action).toBe('kept');
    expect(outcome.reason).toContain('issue #465 (About: Grok)');
    expect(outcome.reason).toContain('pull request #478 (chore: delete CODEOWNERS)');
    expect(gh.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('is not an error when no milestone has the version name, or it is closed already', async () => {
    const gh = github((_method, path) =>
      path.startsWith('/repos/o/r/milestones?')
        ? { status: 200, body: MILESTONES }
        : { status: 404, body: {} },
    );
    expect(await run(gh.fetchImpl, '9.9.9')).toEqual({
      action: 'none',
      reason: 'No milestone is named v9.9.9: there is none to close.',
    });
    expect((await run(gh.fetchImpl, '0.18.0')).reason).toBe(
      'The milestone v0.18.0 is closed already.',
    );
    expect(gh.calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('reads every page of milestones', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      number: i + 1,
      title: `v0.0.${i}`,
      state: 'closed',
    }));
    const gh = github((method, path) => {
      if (path.endsWith('&page=1')) return { status: 200, body: page1 };
      if (path.endsWith('&page=2')) return { status: 200, body: MILESTONES };
      if (path.startsWith('/repos/o/r/issues?milestone=31')) return { status: 200, body: [] };
      if (method === 'PATCH') return { status: 200, body: {} };
      return { status: 404, body: {} };
    });
    expect((await run(gh.fetchImpl, '0.19.0')).action).toBe('closed');
  });

  it('fails when GitHub refuses the write, so the job can be run again', async () => {
    const gh = github((method, path) => {
      if (path.startsWith('/repos/o/r/milestones?')) return { status: 200, body: MILESTONES };
      if (path.startsWith('/repos/o/r/issues?')) return { status: 200, body: [] };
      if (method === 'PATCH')
        return { status: 403, body: { message: 'Resource not accessible by integration' } };
      return { status: 404, body: {} };
    });
    await expect(run(gh.fetchImpl, '0.19.0')).rejects.toThrow(/403: Resource not accessible/);
  });
});
