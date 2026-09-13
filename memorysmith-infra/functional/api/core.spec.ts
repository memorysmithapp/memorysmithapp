/**
 * What the API says about itself, and what answers before a token is read
 * (architecture-guide.md, sections 14 and 23.3).
 */

import { expect, test } from './fixtures.js';

test.describe('the API itself', () => {
  test('[route:GET /health] answers the environment, the version and the commit of the deploy', async ({
    anonymous,
    state,
  }) => {
    const answer = await anonymous.call<{
      status: string;
      environment: string;
      version: string;
      commit: string | null;
    }>('GET', '/health');

    expect(answer.status).toBe(200);
    expect(answer.body.status).toBe('ok');
    expect(answer.body.environment).toBe(state.environment);
    expect(answer.headers.get('x-memorysmith-environment')).toBe(state.environment);
    if (state.version) {
      expect(answer.body.version).toBe(state.version);
      expect(answer.headers.get('x-memorysmith-version')).toBe(state.version);
    }
  });

  test('[route:OPTIONS /*] answers the preflight a browser sends before any call carrying a token', async ({
    anonymous,
    state,
  }) => {
    // The defect this guards: a catch-all route of the gateway once swallowed
    // OPTIONS, and every call of the interface failed before it was made.
    const answer = await anonymous.call('OPTIONS', '/knowledge/notebooks', undefined, {
      origin: state.surfaces.site,
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'authorization,content-type',
    });

    expect(answer.status).toBeLessThan(300);
    expect(answer.headers.get('access-control-allow-origin')).toBe(state.surfaces.site);
    expect((answer.headers.get('access-control-allow-headers') ?? '').toLowerCase()).toContain(
      'authorization',
    );
  });

  test('[route:POST /access/connector-bindings] is refused to anything the proxy role did not sign', async ({
    owner,
  }) => {
    const answer = await owner.call('POST', '/access/connector-bindings', {
      jti: 'forged',
      clientId: 'https://example.com/client.json',
      clientName: 'Forged',
    });

    expect(answer.status).toBe(403);
  });

  test('refuses a call with no token as if nothing were there', async ({ anonymous }) => {
    const answer = await anonymous.call<{ code: string }>('GET', '/knowledge/notebooks');

    expect(answer.status).toBe(404);
    expect(answer.body.code).toBe('FORBIDDEN');
  });
});
