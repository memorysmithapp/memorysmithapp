/**
 * The signature the messages of the pool carry (RN-ACC-017).
 *
 * E-mail clients show no SVG, so a message carries a PNG of the lockup, served
 * from the site of the environment. It is rendered from the same SVG the sign-in
 * page shows, and what it was rendered from is recorded beside the SVG, so a
 * test can say when the two stopped being the same drawing.
 */

import { createHash } from 'node:crypto';

export const EMAIL_LOCKUP = {
  /** The drawing, from the brand book, as the sign-in page carries it. */
  source: 'memorysmith-infra/branding/lockup-light.svg',
  /** Where the site serves it from, at `/email/lockup.png`. */
  png: 'memorysmith-frontend/public/email/lockup.png',
  /** What the PNG was rendered from, written by the renderer. */
  record: 'memorysmith-infra/branding/email-lockup.json',
  /** The width a message shows it at, in CSS pixels; it is rendered at twice that. */
  width: 190,
} as const;

export interface EmailLockupRecord {
  readonly sourceSha256: string;
  readonly pngSha256: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The hash of a drawing, read as text with its line endings made one, so a
 * checkout that converted them is still the same drawing.
 */
export function drawingHash(svg: string): string {
  return createHash('sha256').update(svg.replace(/\r\n/g, '\n')).digest('hex');
}

export function bytesHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
