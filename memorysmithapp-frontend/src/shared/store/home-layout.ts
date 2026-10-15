/**
 * Whether Home shows its notebooks as one row or across the whole page (#257),
 * in this browser.
 *
 * It is a convenience of the device, like the language chosen before signing
 * in, so it lives in `localStorage` and never in the product: it is never
 * exported and nobody else sees it. Everything here is inside a try/catch,
 * because a browser can refuse storage, and one that keeps nothing simply
 * opens Home as a row.
 */

const KEY = 'memorysmith.homeExpanded';

/** Whether Home was left with its notebooks across the whole page. */
export function homeExpanded(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

/** Remembers how Home was left. A row is the absence of the entry. */
export function rememberHomeExpanded(expanded: boolean): void {
  try {
    if (expanded) localStorage.setItem(KEY, 'true');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage refused or full: Home opens as a row next time, nothing else.
  }
}
