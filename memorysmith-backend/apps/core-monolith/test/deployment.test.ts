/**
 * The API says which environment it serves and which version it runs
 * (architecture-guide.md, 23.3). After a deploy, the only proof that the new
 * artefact was the one answering used to be reading the minified bundle by hand.
 */

import { describe, expect, it } from 'vitest';
import { healthSchema } from '@memorysmith/contracts';
import { buildTestApp } from './wiring.js';

const STAGING = {
  environment: 'staging',
  version: '0.6.0-rc.12+a1b2c3d',
  commit: 'a1b2c3d',
} as const;

describe('what the API says about itself', () => {
  it('answers the environment, the version and the commit at /health', async () => {
    const { app } = buildTestApp(STAGING);

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(healthSchema.parse(await response.json())).toEqual({ status: 'ok', ...STAGING });
  });

  it('carries both on every response, a refusal included', async () => {
    const { app } = buildTestApp(STAGING);

    for (const response of [
      await app.request('/health'),
      await app.request('/knowledge/notebooks'),
      await app.request('/access/session', { headers: { authorization: 'Bearer nobody' } }),
    ]) {
      expect(response.headers.get('x-memorysmith-environment')).toBe('staging');
      expect(response.headers.get('x-memorysmith-version')).toBe('0.6.0-rc.12+a1b2c3d');
    }
  });
});
