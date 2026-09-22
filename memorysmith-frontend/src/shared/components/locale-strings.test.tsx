/**
 * Two strings of the reading surface that skipped the locale they are shown in
 * (#188): the notice before a rename, which put two counts in one sentence and
 * pluralised neither, and the title of a callout written without one, which
 * was its type in English whatever the reader spoke.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { i18n as I18n } from 'i18next';

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
let render: (markdown: string) => string;

/** The i18n bundle and the markdown pipeline load before the first case. */
const LOADING_THE_PIPELINE_MS = 30_000;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const { Markdown } = await import('./Markdown');
  render = (markdown: string): string =>
    renderToStaticMarkup(
      <MemoryRouter>
        <Markdown>{markdown}</Markdown>
      </MemoryRouter>,
    );
}, LOADING_THE_PIPELINE_MS);

const renamed = (losing: number, gaining: number): string =>
  i18n.t('editor.willBeRenamed', {
    from: 'Antigo',
    to: 'Novo',
    losing: i18n.t('editor.renameLosing', { count: losing }),
    gaining: i18n.t('editor.renameGaining', { count: gaining }),
  });

describe('the notice before a rename', () => {
  it('says one link, not "1 links", in both locales', async () => {
    await i18n.changeLanguage('pt_BR');
    expect(renamed(1, 0)).toBe(
      'Isto renomeia a nota de “Antigo” para “Novo”. 1 link para o nome antigo fica pendente, ' +
        'e nenhum link espera pelo novo. Nada mais é reescrito.',
    );
    expect(renamed(2, 1)).toContain('2 links para o nome antigo ficam pendentes');
    expect(renamed(2, 1)).toContain('1 link para o novo passa a resolver');

    await i18n.changeLanguage('en_US');
    expect(renamed(1, 3)).toBe(
      'This renames the note from “Antigo” to “Novo”. 1 link to the old name goes pending, ' +
        'and 3 links to the new one resolve. Nothing else is rewritten.',
    );
  });
});

describe('a callout written without a title', () => {
  it('is titled by its type in the locale of the reader', async () => {
    await i18n.changeLanguage('pt_BR');
    expect(render('> [!note]\n> O corpo.')).toContain('<div class="callout-title">Nota</div>');
    expect(render('> [!warning]\n> O corpo.')).toContain('<div class="callout-title">Aviso</div>');

    await i18n.changeLanguage('en_US');
    expect(render('> [!note]\n> The body.')).toContain('<div class="callout-title">Note</div>');
  });

  it('keeps a title the author wrote, and titles a type nobody translated by itself', async () => {
    await i18n.changeLanguage('pt_BR');
    expect(render('> [!note] Leia antes\n> O corpo.')).toContain('Leia antes');
    expect(render('> [!receita]\n> O corpo.')).toContain(
      '<div class="callout-title">Receita</div>',
    );
  });
});
