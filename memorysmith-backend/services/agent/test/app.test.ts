import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { AgentConfig } from '../src/config.js';

const config: AgentConfig = {
  publicOrigin: 'https://mcp.memorysmith.app',
  cognitoIssuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TEST',
  cognitoDomain: 'https://memorysmith-auth.auth.us-east-1.amazoncognito.com',
  proxyClientId: 'proxy-client-id',
  stateSecretId: 'arn:aws:secretsmanager:us-east-1:000000000000:secret:test',
};

const resolveStateSecret = async (): Promise<string> => 'test-secret';

const app = createApp(config, resolveStateSecret);

describe('discovery (items 1 and 2 of 13.3)', () => {
  it('answers 401 with the resource_metadata challenge on an unauthenticated /mcp call', async () => {
    const response = await app.request('/mcp', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer resource_metadata="https://mcp.memorysmith.app/.well-known/oauth-protected-resource"',
    );
  });

  it('serves Protected Resource Metadata pointing at the proxy as authorization server', async () => {
    const response = await app.request('/.well-known/oauth-protected-resource');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['resource']).toBe('https://mcp.memorysmith.app/mcp');
    expect(body['authorization_servers']).toEqual(['https://mcp.memorysmith.app']);
  });

  it('serves the same PRM under the path-inserted well-known used by MCP clients', async () => {
    const response = await app.request('/.well-known/oauth-protected-resource/mcp');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['resource']).toBe('https://mcp.memorysmith.app/mcp');
  });

  it('serves RFC 8414 metadata advertising CIMD, PKCE S256 and no registration endpoint', async () => {
    const response = await app.request('/.well-known/oauth-authorization-server');
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['issuer']).toBe('https://mcp.memorysmith.app');
    expect(body['client_id_metadata_document_supported']).toBe(true);
    expect(body['code_challenge_methods_supported']).toEqual(['S256']);
    expect(body['token_endpoint_auth_methods_supported']).toEqual(['none']);
    expect(body['authorization_endpoint']).toBe('https://mcp.memorysmith.app/authorize');
    expect(body['token_endpoint']).toBe('https://mcp.memorysmith.app/token');
    expect(body).not.toHaveProperty('registration_endpoint');
  });
});

describe('authorize (item 3 of 13.3)', () => {
  it('refuses a request without PKCE', async () => {
    const response = await app.request(
      '/authorize?response_type=code&client_id=https://c.example.com/m.json&redirect_uri=https://a.example.com/cb',
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('invalid_request');
  });

  it('refuses a non-code response_type', async () => {
    const response = await app.request('/authorize?response_type=token');
    expect(response.status).toBe(400);
  });

  it('refuses a client_id that is not an HTTPS URL without redirecting', async () => {
    const response = await app.request(
      '/authorize?response_type=code&client_id=plain-id&redirect_uri=https://a.example.com/cb&code_challenge=x&code_challenge_method=S256',
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('invalid_client');
  });
});

describe('token (item 4 of 13.3)', () => {
  it('refuses unsupported grant types', async () => {
    const response = await app.request('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body['error']).toBe('unsupported_grant_type');
  });

  it('requires code and code_verifier for authorization_code', async () => {
    const response = await app.request('/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code',
    });
    expect(response.status).toBe(400);
  });
});

describe('callback (item 3, second leg)', () => {
  it('refuses a callback with a forged state', async () => {
    const response = await app.request('/callback?code=abc&state=forged.state');
    expect(response.status).toBe(400);
  });
});
