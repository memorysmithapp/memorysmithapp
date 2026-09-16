/**
 * A wikilink on every reading surface, told apart three ways (#138,
 * RN-DSC-046, RN-DSC-060).
 *
 * Every surface drew a link to a name several notes carry as a dead pending
 * span, because it resolved with the one-note half of the resolver. These
 * render the reading surface to static markup: whether the link is a link,
 * whether it announces the menu it opens, and whether it still has a real
 * address for a new tab. What the menu does on a click is exercised in the
 * browser, by the functional suite.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotebookStructure } from '../types/api';
import type * as Backend from '../api/backend';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

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

const note = (id: string, name: string, folderId: string) => ({ id, name, folderId });
const folder = (id: string, name: string, notes: ReturnType<typeof note>[], children = []) => ({
  id,
  parentId: null,
  name,
  slug: name.toLowerCase(),
  description: '',
  position: 0,
  hasTemplate: false,
  noteCount: notes.length,
  notes,
  children,
});

const STRUCTURE = {
  notebook: { id: NOTEBOOK, slug: 'n', name: 'N', description: '', noteCount: 3, updatedAt: '' },
  guidance: null,
  guidanceRevision: null,
  effectiveRole: 'OWNER',
  folders: [
    folder('01J8X2K9QZ3M4N5P6R7S8T9VF1', 'Code', [
      note('01J8X2K9QZ3M4N5P6R7S8T9VN1', 'Facet', '01J8X2K9QZ3M4N5P6R7S8T9VF1'),
      note('01J8X2K9QZ3M4N5P6R7S8T9VN3', 'Only one', '01J8X2K9QZ3M4N5P6R7S8T9VF1'),
    ]),
    folder('01J8X2K9QZ3M4N5P6R7S8T9VF2', 'Concepts', [
      note('01J8X2K9QZ3M4N5P6R7S8T9VN2', 'Facet', '01J8X2K9QZ3M4N5P6R7S8T9VF2'),
    ]),
  ],
} as unknown as NotebookStructure;

vi.mock('../api/backend', async (original) => ({
  ...(await original<typeof Backend>()),
  getNotebookStructure: async () => STRUCTURE,
}));

let render: (markdown: string) => string;

beforeAll(async () => {
  await import('../../i18n');
  const source = await import('../api/source');
  await source.getNotebookStructure(NOTEBOOK);
  const { WritableContent } = await import('./WritableContent');

  render = (markdown: string): string =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <WritableContent
            raw={markdown}
            notebookId={NOTEBOOK}
            baseRevision="rev-1"
            writable={false}
            write={() => Promise.resolve('rev-2')}
            invalidates={[]}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
});

describe('a wikilink on the reading surface', () => {
  it('opens the choice where it stands when several notes carry the name', () => {
    const html = render('See [[Facet]].');

    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('class="wikilink"');
    // A real address, so a new tab reaches the page with the same choice.
    expect(html).toContain('href="/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/links/Facet"');
    expect(html).not.toContain('wikilink-pending');
  });

  it('goes straight to the note when exactly one carries the name', () => {
    const html = render('See [[Only one]].');

    expect(html).toContain(
      'href="/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/notes/01j8x2k9qz3m4n5p6r7s8t9vn3"',
    );
    expect(html).not.toContain('aria-haspopup');
  });

  it('is drawn pending when no name answers, and can still be clicked', () => {
    const html = render('See [[Nobody]].');

    // Only Discovery knows the aliases, so the click still asks (RN-DSC-060).
    expect(html).toContain('class="wikilink-pending"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('href="/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/links/Nobody"');
  });
});

describe('the folder trail of a note', () => {
  it('names the folders from the root down to the note', async () => {
    const source = await import('../api/source');
    expect(source.folderTrailOfNote(NOTEBOOK, '01J8X2K9QZ3M4N5P6R7S8T9VN2')).toEqual(['Concepts']);
  });
});
