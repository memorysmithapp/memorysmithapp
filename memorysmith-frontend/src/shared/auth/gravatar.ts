// Gravatar, in one place, because the avatar and the display name are the same
// identity keyed by the same hash and there is no reason to compute it twice.
//
// PRIVACY: the only thing that ever leaves is the hash of the e-mail, and it
// leaves already, for the avatar. Asking for the profile that belongs to that
// same hash sends nothing new. Everything here fails silently: no network, no
// profile, a rate limit, all end the same way, with the caller keeping what it
// already had. A missing display name is a cosmetic loss, never an error the
// person has to read.

/** Gravatar keys profiles by the SHA-256 of the lowercased, trimmed e-mail. */
export async function gravatarHash(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function avatarUrl(email: string, size: number): Promise<string> {
  return `https://www.gravatar.com/avatar/${await gravatarHash(email)}?d=identicon&s=${size}`;
}

const CACHE_PREFIX = 'memorysmith.gravatar.';

function remembered(hash: string): string | null | undefined {
  try {
    const value = sessionStorage.getItem(CACHE_PREFIX + hash);
    // An empty string is "asked, and there is no name": a real answer worth
    // remembering, so the next render does not ask again.
    return value === null ? undefined : value === '' ? null : value;
  } catch {
    return undefined;
  }
}

function remember(hash: string, name: string | null): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + hash, name ?? '');
  } catch {
    // Storage refused: the only cost is asking again next time.
  }
}

/**
 * The name the person chose on their public Gravatar profile, or null when
 * there is none. Only worth calling when the product itself does not know a
 * name: what the person told the identity provider always wins over what a
 * third party knows about them.
 */
export async function gravatarDisplayName(email: string): Promise<string | null> {
  const hash = await gravatarHash(email);
  const cached = remembered(hash);
  if (cached !== undefined) return cached;

  try {
    const response = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`);
    if (!response.ok) {
      remember(hash, null);
      return null;
    }
    const profile = (await response.json()) as { display_name?: unknown };
    const name = typeof profile.display_name === 'string' ? profile.display_name.trim() : '';
    const found = name.length > 0 ? name : null;
    remember(hash, found);
    return found;
  } catch {
    // No network, blocked request, malformed answer: all the same answer.
    return null;
  }
}
