/**
 * How the proxy records which connector a token belongs to
 * (architecture-guide.md, section 13.3, item 4).
 *
 * Access owns the binding and svc-agent may not import it, so the proxy writes
 * it through a route of Access, signed with the IAM credentials of this
 * function: the gateway lets nobody else reach that route (section 14.1). The
 * token being bound travels in the body, and Access reads the subscription and
 * the identifier of the token from its verified claims. The refresh token never
 * leaves this process: only its SHA-256 does.
 *
 * This file knows nothing about AWS. The signer is a port as well, and its SigV4
 * implementation lives in connector-binding.aws.ts, so the token endpoint can be
 * tested without the SDK.
 */

import { createHash } from 'node:crypto';
import type { ConnectorBindingRequest } from '@memorysmith/contracts';

export interface ConnectorBinder {
  /** A token was issued, through the authorization code grant, to this connector. */
  bind(input: {
    accessToken: string;
    connector: { clientId: string; clientName: string };
    refreshToken: string | null;
  }): Promise<void>;
  /** A token was renewed by a refresh token, which already names its connector. */
  rebind(input: {
    accessToken: string;
    refreshToken: string;
    rotatedRefreshToken: string | null;
  }): Promise<void>;
}

/** What is signed and sent. */
export interface OutgoingRequest {
  readonly method: string;
  readonly url: URL;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** Signs a request, answering the headers to send it with. */
export type RequestSigner = (request: OutgoingRequest) => Promise<Record<string, string>>;

/** The route of Access the binding is written through. */
export const CONNECTOR_BINDING_PATH = '/access/connector-bindings';

/** The SHA-256 of a refresh token, which is all of it that ever leaves the proxy. */
export function refreshTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class HttpConnectorBinder implements ConnectorBinder {
  constructor(
    private readonly origin: string,
    private readonly sign: RequestSigner,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  bind(input: Parameters<ConnectorBinder['bind']>[0]): Promise<void> {
    return this.send({
      grant: 'authorization_code',
      accessToken: input.accessToken,
      connector: input.connector,
      refreshTokenHash: input.refreshToken ? refreshTokenHash(input.refreshToken) : null,
    });
  }

  rebind(input: Parameters<ConnectorBinder['rebind']>[0]): Promise<void> {
    return this.send({
      grant: 'refresh_token',
      accessToken: input.accessToken,
      refreshTokenHash: refreshTokenHash(input.refreshToken),
      rotatedRefreshTokenHash: input.rotatedRefreshToken
        ? refreshTokenHash(input.rotatedRefreshToken)
        : null,
    });
  }

  private async send(binding: ConnectorBindingRequest): Promise<void> {
    const url = new URL(`${this.origin}${CONNECTOR_BINDING_PATH}`);
    const body = JSON.stringify(binding);
    const headers = await this.sign({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
    });
    const response = await this.fetchImpl(url, { method: 'POST', headers, body });
    if (!response.ok) {
      throw new Error(`The connector binding was refused with ${response.status}`);
    }
  }
}
