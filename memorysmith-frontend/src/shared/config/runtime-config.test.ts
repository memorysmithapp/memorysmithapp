/**
 * The configuration an environment publishes beside the bundle
 * (architecture-guide.md, 23.3). One build serves any environment, so a
 * missing field has to stop the page at the door, naming the field, rather than
 * reach a screen as an empty origin.
 */

import { describe, expect, it } from 'vitest';
import { loadRuntimeConfig, parseRuntimeConfig, runtimeConfig } from './runtime-config';

const STAGING = {
  apiOrigin: 'https://api.stg.memorysmith.app/',
  connectorOrigin: 'https://mcp.stg.memorysmith.app/',
  cognitoDomain: 'https://auth.stg.memorysmith.app',
  cognitoClientId: 'client-id',
  environment: 'staging',
  version: '0.6.0-rc.12+a1b2c3d',
};

describe('the runtime configuration', () => {
  it('reads every field, without a trailing slash on the origins', () => {
    expect(parseRuntimeConfig(STAGING)).toEqual({
      ...STAGING,
      apiOrigin: 'https://api.stg.memorysmith.app',
      connectorOrigin: 'https://mcp.stg.memorysmith.app',
    });
  });

  it('names the field that is missing', () => {
    const { cognitoClientId: _missing, ...rest } = STAGING;
    expect(() => parseRuntimeConfig(rest)).toThrow('"cognitoClientId"');
  });

  it('refuses an environment that does not exist', () => {
    expect(() => parseRuntimeConfig({ ...STAGING, environment: 'prod' })).toThrow('"prod"');
  });

  it('refuses what is not an object', () => {
    expect(() => parseRuntimeConfig('config')).toThrow('not an object');
  });

  it('is read from /config.json, never from the cache, and kept once loaded', async () => {
    const asked: Array<{ url: string; init: RequestInit | undefined }> = [];
    const config = await loadRuntimeConfig((async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      asked.push({ url: String(url), init });
      return new Response(JSON.stringify(STAGING), { status: 200 });
    }) as typeof fetch);

    expect(asked).toEqual([{ url: '/config.json', init: { cache: 'no-store' } }]);
    expect(config.environment).toBe('staging');
    expect(runtimeConfig()).toBe(config);
  });

  it('says so when the environment publishes no configuration', async () => {
    await expect(
      loadRuntimeConfig((async () => new Response('', { status: 404 })) as typeof fetch),
    ).rejects.toThrow('404');
  });
});
