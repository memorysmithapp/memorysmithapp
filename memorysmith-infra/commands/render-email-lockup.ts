/**
 * Renders the signature the messages of the pool carry (RN-ACC-017).
 *
 *   pnpm -C memorysmith-infra exec playwright install chromium
 *   pnpm -C memorysmith-infra exec tsx commands/render-email-lockup.ts
 *
 * It draws the lockup of the brand book in Chromium, at twice the width a
 * message shows it, on a transparent background, and records what it drew
 * from. Run it whenever the lockup changes: a test fails until it is.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  bytesHash,
  drawingHash,
  EMAIL_LOCKUP,
  type EmailLockupRecord,
} from './lib/email-lockup.js';
import { REPOSITORY_ROOT } from './lib/repository.js';

const svg = readFileSync(join(REPOSITORY_ROOT, EMAIL_LOCKUP.source), 'utf8');
const box = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
if (!box) throw new Error(`${EMAIL_LOCKUP.source} has no viewBox.`);
const [viewWidth, viewHeight] = [Number(box[3]), Number(box[4])];
const width = EMAIL_LOCKUP.width;
const height = Math.round((width * viewHeight) / viewWidth);

const sized = svg
  .replace('<svg ', '<svg id="lockup" style="display:block" ')
  .replace(/width="[\d.]+"/, `width="${width}"`)
  .replace(/height="[\d.]+"/, `height="${height}"`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
  );
  const png = await page.locator('#lockup').screenshot({ omitBackground: true });

  const target = join(REPOSITORY_ROOT, EMAIL_LOCKUP.png);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, png);

  const record: EmailLockupRecord = {
    sourceSha256: drawingHash(svg),
    pngSha256: bytesHash(png),
    width,
    height,
  };
  writeFileSync(join(REPOSITORY_ROOT, EMAIL_LOCKUP.record), `${JSON.stringify(record, null, 2)}\n`);
  process.stdout.write(`Rendered ${EMAIL_LOCKUP.png} at ${width * 2}x${height * 2}.\n`);
} finally {
  await browser.close();
}
