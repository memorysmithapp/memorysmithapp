// Keeping the session alive while it is used (#525, RN-SUB-022).
//
// The access token lives an hour and the refresh token thirty days, so a
// person who keeps the product open never signs in again: the access token is
// renewed silently. Three things made that renewal end sessions it should
// have kept, and each is answered here:
//
// - Every request that left in the last minute of the hour ran its own
//   refresh, and screens poll, so the hour ended in a burst. Now one refresh
//   runs at a time — in the tab, through one promise, and across the tabs of
//   the browser, through a Web Lock — and whoever waited reads what it stored.
// - Any failure of the provider read as a dead session. Now only
//   `invalid_grant` does (`refresh` in oauth.ts); a passing failure is tried
//   again, and while it keeps failing the request fails as the network does.
// - The renewal waited for a request. Now it runs a few minutes before the
//   hour ends, on a timer and when the tab comes back, so a request rarely
//   carries it.

import { readTokens, refresh, RefreshUnavailable, type AuthConfig, type Tokens } from './oauth';

/** How long before the end of the hour the keeper renews. */
export const RENEW_AHEAD_MS = 5 * 60_000;

/** The waits between the tries of a refresh the provider could not answer. */
const RETRY_MS = [1_000, 3_000];

let inFlight: Promise<Tokens | null> | null = null;

/** Waits; replaced by a test. */
let pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function setPauseForTests(next: (ms: number) => Promise<void>): void {
  pause = next;
}

/**
 * The tokens to use when the ones held end within `margin`: the same ones when
 * another tab or request already renewed them, new ones otherwise. `null` says
 * the session is gone; `RefreshUnavailable` says it could not be renewed now.
 */
export function renew(config: AuthConfig, margin: number): Promise<Tokens | null> {
  if (inFlight) return inFlight;
  const run = async (): Promise<Tokens | null> => {
    const held = readTokens();
    if (!held) return null;
    // Another tab may have renewed while this one waited for the lock.
    if (held.expiresAt - Date.now() > margin) return held;
    return refreshWithRetry(config);
  };
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  const running: Promise<Tokens | null> = (
    locks ? locks.request('memorysmith.refresh', run).then((tokens) => tokens) : run()
  ).finally(() => {
    inFlight = null;
  });
  inFlight = running;
  return running;
}

async function refreshWithRetry(config: AuthConfig): Promise<Tokens | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await refresh(config);
    } catch (error) {
      const wait = RETRY_MS[attempt];
      if (!(error instanceof RefreshUnavailable) || wait === undefined) throw error;
      await pause(wait);
    }
  }
}

/**
 * Renews ahead of the hour while the product is open: every minute, and when
 * the tab is shown again or the network comes back, which is when a tab that
 * slept finds its token old. A failure here is quiet; the next request tries
 * again, and only it may end the session.
 */
export function keepSessionAlive(config: AuthConfig): () => void {
  const check = () => {
    const held = readTokens();
    if (!held || held.expiresAt - Date.now() > RENEW_AHEAD_MS) return;
    renew(config, RENEW_AHEAD_MS).catch(() => undefined);
  };
  const shown = () => {
    if (document.visibilityState === 'visible') check();
  };
  const timer = setInterval(check, 60_000);
  document.addEventListener('visibilitychange', shown);
  window.addEventListener('online', check);
  window.addEventListener('focus', check);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', shown);
    window.removeEventListener('online', check);
    window.removeEventListener('focus', check);
  };
}

/**
 * Asks the browser to keep this site's storage, where the session lives, when
 * the product runs as an installed app (#526): a browser under storage
 * pressure clears what it was not asked to keep, and the person is asked to
 * sign in again. Chrome decides on its own and asks nobody; a browser tab is
 * left as it is, since Firefox would ask the person.
 */
export function keepSessionStorage(): void {
  try {
    const installed = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    if (installed && navigator.storage?.persist)
      void navigator.storage.persist().catch(() => false);
  } catch {
    // A browser that cannot say is left as it is.
  }
}
