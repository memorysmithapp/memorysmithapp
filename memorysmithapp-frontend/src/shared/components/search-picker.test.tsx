/**
 * The picker of a notebook or a model (#432): a field, the places as tabs
 * with how many each holds, and the rows under them, filtered by every word
 * typed in what a row is called, what it is for and whose it is, drawn as the
 * list of a folder (#435). Rendered to static markup.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { i18n as I18n } from 'i18next';
import type { PickerItem, PickerSource } from './SearchPicker';

const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  removeItem: (key: string) => void stored.delete(key),
  setItem: (key: string, value: string) => void stored.set(key, value),
} as Storage);

const MINE: PickerItem[] = [
  { id: 'a', name: 'Diário de pesquisa', line: 'Hipóteses, achados e fontes' },
  { id: 'b', name: 'Onboarding de cliente', line: 'Etapas e decisões' },
];
const SHARED: PickerItem[] = [{ id: 'c', name: 'Diário de obra', by: 'ana@example.com' }];

let i18n: I18n;
let render: (
  sources: ReadonlyArray<PickerSource<'mine' | 'shared' | 'community'>>,
  chosen?: string | null,
) => string;
let matchesItem: (item: PickerItem, text: string) => boolean;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const module = await import('./SearchPicker');
  matchesItem = module.matchesItem;
  render = (sources, chosen) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <module.SearchPicker
          label="Model"
          placeholder="Search"
          sources={sources}
          onPick={() => undefined}
          {...(chosen === undefined ? {} : { chosen })}
        />
      </QueryClientProvider>,
    );
});

describe('the picker of a notebook or a model (#432)', () => {
  it('finds a row by every word typed, accents and case aside, in its name, line or owner', () => {
    expect(matchesItem(MINE[0]!, 'diario')).toBe(true);
    expect(matchesItem(MINE[0]!, 'pesquisa FONTES')).toBe(true);
    expect(matchesItem(MINE[0]!, 'diario obra')).toBe(false);
    expect(matchesItem(SHARED[0]!, 'ana')).toBe(true);
    expect(matchesItem(MINE[1]!, '')).toBe(true);
  });

  it('draws the field, the places as tabs with what each holds, and the rows of the first', async () => {
    await i18n.changeLanguage('en_US');
    const html = render([
      { key: 'mine', label: 'Mine', kind: 'local', items: MINE },
      { key: 'shared', label: 'Shared with me', kind: 'local', items: SHARED },
      {
        key: 'community',
        label: 'Community',
        kind: 'remote',
        queryKey: ['test-catalog'],
        search: async () => ({ items: [], next: null, total: 0 }),
      },
    ]);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/Mine<span class="tab-total">2<\/span>/);
    expect(html).toMatch(/Shared with me<span class="tab-total">1<\/span>/);
    // The community is searched on the server, so it says no count.
    expect(html).not.toMatch(/Community<span class="tab-total">/);
    expect(html).toContain('role="listbox"');
    expect(html).toContain('Diário de pesquisa');
    expect(html).toContain('Onboarding de cliente');
    expect(html).not.toContain('Diário de obra');
    // Nothing is lit until the keyboard or the mouse moves (#444).
    expect(html).not.toContain('is-lit');
    expect(html).not.toMatch(/role="option" aria-selected="true"/);
  });

  it('draws the rows as the list of a folder: the name, what it is for and whose it is (#435)', async () => {
    await i18n.changeLanguage('en_US');
    const html = render([
      { key: 'mine', label: 'Mine', kind: 'local', items: MINE },
      { key: 'shared', label: 'Shared with me', kind: 'local', items: SHARED },
    ]);
    expect(html).toContain('class="tables-grid folder-notes-table search-picker-table"');
    expect(html).toMatch(
      /<thead aria-hidden="true"><tr><th>Name<\/th><th>What it is for<\/th><th>Whose<\/th><\/tr><\/thead>/,
    );
    // Each row is an option of the listbox, its cells the three columns.
    expect(html).toMatch(/<tbody role="listbox" aria-label="Model">/);
    expect(html).toMatch(
      /<tr id="[^"]+-option-0" role="option" aria-selected="false" class="search-picker-row"><td class="folder-notes-name search-picker-name">Diário de pesquisa<\/td><td data-label="What it is for" class="search-picker-line">Hipóteses, achados e fontes<\/td><td data-label="Whose" class="search-picker-by">Yours<\/td><\/tr>/,
    );
    await i18n.changeLanguage('pt_BR');
    const pt = render([{ key: 'mine', label: 'Meus', kind: 'local', items: MINE }]);
    expect(pt).toContain('<th>Para que serve</th><th>De quem é</th>');
    await i18n.changeLanguage('en_US');
  });

  it('says so when a place holds nothing yet, in each language', async () => {
    const empty: ReadonlyArray<PickerSource<'mine'>> = [
      { key: 'mine', label: 'Mine', kind: 'local', items: [] },
    ];
    await i18n.changeLanguage('en_US');
    expect(render(empty)).toContain('Nothing here yet.');
    await i18n.changeLanguage('pt_BR');
    expect(render(empty)).toContain('Nada aqui ainda.');
    // One place is no choice of places: no tabs.
    expect(render(empty)).not.toContain('role="tablist"');
  });

  it('shows 20 rows a page, with the pager of a folder, and no pager for fewer (#438)', async () => {
    await i18n.changeLanguage('en_US');
    const many = Array.from({ length: 45 }, (_, at) => ({
      id: `m${at}`,
      name: `Model ${String(at).padStart(2, '0')}`,
    }));
    const html = render([{ key: 'mine', label: 'Mine', kind: 'local', items: many }]);
    expect(html.match(/role="option"/g)).toHaveLength(20);
    expect(html).toContain('Model 19');
    expect(html).not.toContain('Model 20');
    expect(html).toContain('class="tables-grid-pages"');
    expect(html).toMatch(/1.20 of 45/);
    expect(render([{ key: 'mine', label: 'Mine', kind: 'local', items: MINE }])).not.toContain(
      'tables-grid-pages',
    );
  });

  it('draws a radio where the picker waits for Select, filled on the row chosen (#438)', async () => {
    await i18n.changeLanguage('en_US');
    const sources: ReadonlyArray<PickerSource<'mine'>> = [
      { key: 'mine', label: 'Mine', kind: 'local', items: MINE },
    ];
    const html = render(sources, 'b');
    expect(html.match(/<span class="search-picker-radio[^"]*"/g)).toHaveLength(2);
    expect(html.match(/search-picker-radio is-chosen/g)).toHaveLength(1);
    expect(html).toMatch(
      /class="search-picker-row is-chosen"|class="search-picker-row is-lit is-chosen"/,
    );
    // Where a click picks at once, as in the export, there is no radio.
    expect(render(sources)).not.toContain('search-picker-radio');
  });
});
