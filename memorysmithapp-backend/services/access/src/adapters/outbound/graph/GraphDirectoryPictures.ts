/**
 * The photo Microsoft Entra ID keeps of a person, asked of Microsoft Graph
 * with the app's own credential on every sign-in (#561).
 *
 * The OIDC token carries no picture and Cognito keeps the provider's tokens to
 * itself, so the person's own token never reaches Graph: the app asks as
 * itself, through client credentials, with the client secret `deliver` already
 * keeps for the provider. What lets it read a photo is the application
 * permission `ProfilePhoto.Read.All` with admin consent, which the
 * organization grants in Entra ID; until it does, Graph refuses and the
 * answer is unknown.
 *
 * Only a 404 of the photo says the person has none; every other failure is
 * unknown, and it never throws, within a budget well inside the five seconds
 * the pool gives the trigger.
 */

import type { DirectoryAnswer, DirectoryPictures } from '../../../application/federated-face.js';
import type { Email } from '../../../domain/values.js';

/** The side Graph is asked for first: the closest it keeps to `avatarSide`. */
const SIDE = '240x240';

export interface GraphApp {
  readonly tenant: string;
  readonly clientId: string;
  /** The client secret, read when first needed. */
  readonly secret: () => Promise<string>;
}

export class GraphDirectoryPictures implements DirectoryPictures {
  constructor(
    private readonly app: GraphApp,
    private readonly budgetMs = 2000,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async pictureOf(email: Email): Promise<DirectoryAnswer> {
    try {
      const signal = AbortSignal.timeout(this.budgetMs);
      const token = await this.token(signal);
      if (!token) return { kind: 'unknown' };
      const user = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email.value)}`;
      // The size closest to what the interface draws, and the photo as it was
      // kept when that size is not one of its own; a refusal is not retried.
      const sized = await this.photo(`${user}/photos/${SIDE}/$value`, token, signal);
      if (sized.kind !== 'none') return sized;
      return await this.photo(`${user}/photo/$value`, token, signal);
    } catch {
      return { kind: 'unknown' };
    }
  }

  private async token(signal: AbortSignal): Promise<string | null> {
    const response = await this.fetchFn(
      `https://login.microsoftonline.com/${encodeURIComponent(this.app.tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.app.clientId,
          client_secret: await this.app.secret(),
          scope: 'https://graph.microsoft.com/.default',
        }),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { access_token?: unknown };
    return typeof body.access_token === 'string' ? body.access_token : null;
  }

  private async photo(url: string, token: string, signal: AbortSignal): Promise<DirectoryAnswer> {
    const response = await this.fetchFn(url, {
      signal,
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.status === 404) return { kind: 'none' };
    if (!response.ok) return { kind: 'unknown' };
    const mime = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    return {
      kind: 'picture',
      picture: { mime, bytes: new Uint8Array(await response.arrayBuffer()) },
    };
  }
}
