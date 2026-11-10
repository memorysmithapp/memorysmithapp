/**
 * The picker of a notebook or a model (#432): a field, the places as tabs
 * with how many each holds, and the rows under them, filtered by every word
 * typed in what a row is called, what it is for and whose it is. Rendered to
 * static markup.
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
let render: (sources: ReadonlyArray<PickerSource<'mine' | 'shared' | 'community'>>) => string;
let matchesItem: (item: PickerItem, text: string) => boolean;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const module = await import('./SearchPicker');
  matchesItem = module.matchesItem;
  render = (sources) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <module.SearchPicker
          label="Model"
          placeholder="Search"
          sources={sources}
          onPick={() => undefined}
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
        search: async () => ({ items: [], next: null }),
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
    // The first row is the one Enter picks.
    expect(html).toMatch(/aria-selected="true"[^>]*>.*Diário de pesquisa/);
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
});
