import { describe, expect, it } from 'vitest';
import {
  isPrivateIp,
  parseClientIdUrl,
  redirectUriMatches,
  resolveClientMetadata,
} from '../src/cimd.js';

const CLIENT_ID = 'https://client.example.com/oauth/metadata.json';

const documentResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

const stubFetch =
  (response: Response): typeof fetch =>
  async () =>
    response;

describe('parseClientIdUrl', () => {
  it('accepts an absolute HTTPS URL', () => {
    expect(parseClientIdUrl(CLIENT_ID)).not.toBeNull();
  });

  it.each(['http://client.example.com/m.json', 'not-a-url', 'ftp://x.example/m', ''])(
    'rejects %s',
    (value) => {
      expect(parseClientIdUrl(value)).toBeNull();
    },
  );

  it('rejects URLs carrying credentials', () => {
    expect(parseClientIdUrl('https://user:pass@client.example.com/m.json')).toBeNull();
  });
});

describe('isPrivateIp', () => {
  it.each([
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:10.0.0.1',
  ])('flags %s as non-public', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '52.94.236.248', '172.32.0.1', '2600:9000::1', '::ffff:8.8.8.8'])(
    'accepts public %s',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );
});

describe('redirectUriMatches (RFC 8252)', () => {
  it('matches exact URIs', () => {
    expect(redirectUriMatches('https://app.example.com/cb', 'https://app.example.com/cb')).toBe(
      true,
    );
  });

  it('ignores the port on loopback hosts', () => {
    expect(redirectUriMatches('http://127.0.0.1:53171/cb', 'http://127.0.0.1/cb')).toBe(true);
    expect(redirectUriMatches('http://localhost:9999/cb', 'http://localhost:3000/cb')).toBe(true);
  });

  it('never ignores the port on non-loopback hosts', () => {
    expect(
      redirectUriMatches('https://app.example.com:8443/cb', 'https://app.example.com/cb'),
    ).toBe(false);
  });

  it('still requires path equality on loopback', () => {
    expect(redirectUriMatches('http://127.0.0.1:1234/other', 'http://127.0.0.1/cb')).toBe(false);
  });

  it('does not let a loopback request match a hosted registration', () => {
    expect(redirectUriMatches('http://127.0.0.1:1234/cb', 'https://app.example.com/cb')).toBe(
      false,
    );
  });
});

describe('resolveClientMetadata', () => {
  const validDocument = {
    client_id: CLIENT_ID,
    client_name: 'Example Client',
    redirect_uris: ['https://app.example.com/cb', 'http://127.0.0.1/cb'],
  };

  it('accepts a valid document with a registered redirect_uri', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'https://app.example.com/cb', {
      fetchImpl: stubFetch(documentResponse(validDocument)),
      skipDnsCheck: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.client_name).toBe('Example Client');
  });

  it('accepts a loopback redirect_uri with any port', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'http://127.0.0.1:61023/cb', {
      fetchImpl: stubFetch(documentResponse(validDocument)),
      skipDnsCheck: true,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a client_id that is not HTTPS', async () => {
    const result = await resolveClientMetadata('http://client.example.com/m.json', 'https://x/cb');
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_CLIENT_ID_URL' } });
  });

  it('rejects a client_id resolving to a private address', async () => {
    const result = await resolveClientMetadata(
      'https://169.254.169.254/latest/meta',
      'https://x/cb',
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'PRIVATE_ADDRESS' } });
  });

  it('rejects localhost client_id hosts', async () => {
    const result = await resolveClientMetadata('https://localhost/m.json', 'https://x/cb');
    expect(result).toMatchObject({ ok: false, error: { code: 'PRIVATE_ADDRESS' } });
  });

  it('rejects a document whose client_id differs from the URL', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'https://app.example.com/cb', {
      fetchImpl: stubFetch(
        documentResponse({ ...validDocument, client_id: 'https://other.example.com/m.json' }),
      ),
      skipDnsCheck: true,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'CLIENT_ID_MISMATCH' } });
  });

  it('rejects an unregistered redirect_uri', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'https://evil.example.com/cb', {
      fetchImpl: stubFetch(documentResponse(validDocument)),
      skipDnsCheck: true,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'REDIRECT_URI_NOT_REGISTERED' } });
  });

  it('rejects a document above the size cap', async () => {
    const huge = JSON.stringify({ ...validDocument, padding: 'x'.repeat(70 * 1024) });
    const result = await resolveClientMetadata(CLIENT_ID, 'https://app.example.com/cb', {
      fetchImpl: stubFetch(documentResponse(huge)),
      skipDnsCheck: true,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'DOCUMENT_TOO_LARGE' } });
  });

  it('rejects malformed JSON', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'https://app.example.com/cb', {
      fetchImpl: stubFetch(documentResponse('not-json{')),
      skipDnsCheck: true,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'MALFORMED_DOCUMENT' } });
  });

  it('rejects a non-200 answer', async () => {
    const result = await resolveClientMetadata(CLIENT_ID, 'https://app.example.com/cb', {
      fetchImpl: stubFetch(new Response('gone', { status: 404 })),
      skipDnsCheck: true,
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'FETCH_FAILED' } });
  });
});
