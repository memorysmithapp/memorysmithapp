/**
 * The renderer of a print (#263): a Chromium of the server opens the page the
 * print tab previews, as the person who asked, and saves its pages as a PDF.
 *
 * It draws nothing of its own. The page is the application's — the reading
 * surface, the A4 pages laid by the tab, the choices the person made — so the
 * file and the preview are one drawing, and a change to how a note is printed
 * reaches the PDF with no change here.
 *
 * **It reaches the product and nothing else.** A note may point a picture at
 * any address, and a browser on the server that fetched any address a note
 * names would be a door into the network it runs in. Every request outside the
 * application, its API, its files host and the fonts the application loads is
 * refused before it leaves: such a picture is drawn by the print of the
 * browser, and left out of a PDF made here.
 */

import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import type { PrintJob } from '../application/Prints.js';

export interface RendererConfig {
  /** The origin the application is served from, the only one the page is opened on. */
  readonly siteOrigin: string;
  /** Every other origin the page may reach: the API, the files host, the fonts. */
  readonly allowedOrigins: readonly string[];
  /** Where the compressed browser lies: the layer of the function. */
  readonly chromiumDirectory: string;
}

export type Rendered =
  | { readonly ok: true; readonly pdf: Uint8Array; readonly name: string }
  | {
      readonly ok: false;
      readonly failure: string;
      /** What the page said on the way, for the log of the function: never shown. */
      readonly diagnostics: readonly string[];
    };

/** How long the page has to draw the note and lay its pages. */
const DRAWING_MILLIS = 75_000;

const LOCALES = new Set(['en_US', 'pt_BR']);

/** When the token stops being accepted, read from its own claims. */
function expiryOf(token: string): number {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    ) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : Date.now() + 5 * 60 * 1000;
  } catch {
    return Date.now() + 5 * 60 * 1000;
  }
}

/** What the page finds in the storage of the browser: the session, and the choices. */
function storageOf(job: PrintJob): Record<string, string> {
  return {
    'memorysmith.tokens': JSON.stringify({
      accessToken: job.accessToken,
      idToken: job.accessToken,
      refreshToken: null,
      expiresAt: expiryOf(job.accessToken),
    }),
    'memorysmith.locale': LOCALES.has(job.locale) ? job.locale : 'en_US',
    'memorysmith.printProperties': job.choices.placement,
    'memorysmith.printTables': job.choices.tables,
    'memorysmith.printOrientation': job.choices.orientation,
  };
}

let browser: Browser | null = null;

/** One browser per warm function: starting it is most of what a cold print costs. */
async function browserOf(config: RendererConfig): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(config.chromiumDirectory),
    headless: true,
    defaultViewport: { width: 1400, height: 1000 },
  });
  return browser;
}

/**
 * How the page ended: its pages laid, or why not. A note the person may not
 * read answers not found; a session the API refused sends the page to sign in,
 * which is another origin and is refused, so the page leaves the application —
 * either way the person has no session here.
 */
async function outcomeOf(page: Page, siteOrigin: string): Promise<string> {
  const deadline = Date.now() + DRAWING_MILLIS;
  while (Date.now() < deadline) {
    if (!page.url().startsWith(siteOrigin)) return 'SESSION';
    const seen = await page
      .evaluate(() => {
        const scope = globalThis as unknown as {
          document: { querySelector(selector: string): object | null };
          location: { pathname: string };
        };
        if (scope.document.querySelector('.print-preview[data-ready="true"]')) return 'ready';
        if (scope.document.querySelector('p.status')) return 'NOT_FOUND';
        if (scope.location.pathname.startsWith('/login')) return 'SESSION';
        return null;
      })
      // A page in the middle of navigating answers nothing for a moment.
      .catch(() => null);
    if (seen) return seen;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return 'TIMED_OUT';
}

export async function renderPrint(job: PrintJob, config: RendererConfig): Promise<Rendered> {
  const allowed = new Set([config.siteOrigin, ...config.allowedOrigins]);
  const diagnostics: string[] = [];
  const page = await (await browserOf(config)).newPage();
  try {
    page.on('pageerror', (error) => diagnostics.push(`page error: ${String(error)}`.slice(0, 300)));
    page.on('console', (message) => {
      if (message.type() === 'error') diagnostics.push(`console: ${message.text()}`.slice(0, 300));
    });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return void request.continue();
      let origin = '';
      try {
        origin = new URL(url).origin;
      } catch {
        // Not an address at all: refused below.
      }
      if (allowed.has(origin)) return void request.continue();
      diagnostics.push(`refused: ${origin || url.slice(0, 80)}`);
      void request.abort('blockedbyclient');
    });
    await page.evaluateOnNewDocument(
      (site: string, entries: Record<string, string>) => {
        const scope = globalThis as unknown as {
          location: { origin: string };
          localStorage: { setItem(key: string, value: string): void };
        };
        if (scope.location.origin !== site) return;
        for (const [key, value] of Object.entries(entries)) scope.localStorage.setItem(key, value);
      },
      config.siteOrigin,
      storageOf(job),
    );

    const address = `${config.siteOrigin}/notebooks/${job.notebookId.toLowerCase()}/notes/${job.noteId.toLowerCase()}/print`;
    await page.goto(address, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const outcome = await outcomeOf(page, config.siteOrigin);
    if (outcome !== 'ready') return { ok: false, failure: outcome, diagnostics };

    const name = (await page.title()).trim() || 'note';
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { ok: true, pdf, name };
  } finally {
    await page.close().catch(() => undefined);
  }
}
