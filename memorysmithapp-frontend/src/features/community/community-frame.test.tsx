/**
 * The frame of the community pages (#384, #385): the tagline beside the mark,
 * buttons that say where they lead, and a version row whose button is never
 * squeezed out by its changelog.
 */

import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { i18n as I18n } from 'i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

vi.stubGlobal('localStorage', memoryStorage());
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

let i18n: I18n;
let page: () => string;
let backTarget: (index: number, signedIn: boolean) => -1 | string;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const pages = await import('./CommunityPages');
  backTarget = pages.backTarget;
  page = () =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <pages.CommunityPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, 30_000);

describe('the header of the community pages (#385)', () => {
  it('shows the tagline and two buttons, and Sign in to a visitor', async () => {
    await i18n.changeLanguage('pt_BR');
    localStorage.clear();
    const html = page();
    expect(html).toContain(
      'class="tagline">Conhecimento estruturado, que construímos e mantemos com os assistentes de IA que já usamos no dia a dia.',
    );
    // Each button carries its icon beside its word, which stays its name on a phone.
    expect(html).toMatch(
      /class="button is-quiet is-small"[^>]*><svg[^]*?<span class="action-word">Modelos da comunidade<\/span>/,
    );
    expect(html).toMatch(
      /<button type="button" class="button is-quiet is-small"><svg[^]*?<span class="action-word">Voltar<\/span><\/button>/,
    );
    expect(html).toMatch(/<svg[^]*?<span class="action-word">Entrar<\/span><\/a>/);
  });

  it('leaves Sign in out for a person signed in, in English too', async () => {
    await i18n.changeLanguage('en_US');
    localStorage.setItem('memorysmith.tokens', JSON.stringify({ accessToken: 'x' }));
    const html = page();
    expect(html).toContain('<span class="action-word">Back</span></button>');
    expect(html).toContain('class="tagline">Structured knowledge');
    expect(html).not.toContain('Sign in</span></a>');
    localStorage.clear();
  });

  it('is the header of the application, so the mark stands where it stands on every page', async () => {
    await i18n.changeLanguage('pt_BR');
    const html = page();
    expect(html).toMatch(
      /<div class="community-frame"><header class="app-header"><a class="brand"/,
    );
  });

  it('goes back when there is a page to go back to, and home or to the list otherwise', () => {
    expect(backTarget(2, true)).toBe(-1);
    expect(backTarget(0, true)).toBe('/');
    expect(backTarget(0, false)).toBe('/community');
  });
});

describe('a version row of a community model (#384)', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('has a column for each of its four items, so its button keeps its width', () => {
    expect(css).toMatch(
      /\.model-version\.is-public \{\s*grid-template-columns: auto auto minmax\(0, 1fr\) auto;/,
    );
  });
});

describe('the frame of the community pages (#410)', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
  const frame = /\.community-frame \{([^}]*)\}/.exec(css)?.[1] ?? '';

  it('fills its row of the root and scrolls inside it, so the document never scrolls', () => {
    expect(frame).toMatch(/height: 100%;/);
    expect(frame).toMatch(/min-height: 0;/);
    expect(frame).toMatch(/overflow-y: auto;/);
  });

  it('never sizes itself by the viewport, which the root already is', () => {
    expect(frame).not.toMatch(/\d+d?vh/);
  });
});
