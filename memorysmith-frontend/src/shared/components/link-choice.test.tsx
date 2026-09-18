/**
 * A wikilink on every reading surface, told apart three ways (#138,
 * RN-DSC-046, RN-DSC-060).
 *
 * Every surface drew a link to a name several notes carry as a dead pending
 * span, because it resolved with the one-note half of the resolver. These
 * render the reading surface to static markup: whether the link is a link,
 * whether it announces the dialog it opens, and whether it still has a real
 * address for a new tab. What the dialog does on a click is exercised in the
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

/**
 * The hook loads the whole i18n bundle and the markdown pipeline before the
 * first case, which on a cold or busy machine takes longer than the ten
 * seconds vitest allows a hook by default. The work is the same; what changes
 * is how long the suite is willing to wait for it.
 */
const LOADING_THE_PIPELINE_MS = 30_000;

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
}, LOADING_THE_PIPELINE_MS);

describe('a wikilink on the reading surface', () => {
  it('opens the choice where it stands when several notes carry the name', () => {
    const html = render('See [[Facet]].');

    expect(html).toContain('aria-haspopup="dialog"');
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
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('href="/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/links/Nobody"');
  });
});

describe('the folder trail of a note', () => {
  it('names the folders from the root down to the note', async () => {
    const source = await import('../api/source');
    expect(source.folderTrailOfNote(NOTEBOOK, '01J8X2K9QZ3M4N5P6R7S8T9VN2')).toEqual(['Concepts']);
  });
});

/**
 * What the choice SAYS, rendered on its own (#144). It is one component and two
 * places — the dialog a wikilink opens and the page at the address of the
 * target — so what it explains is asserted once. Opening, closing and the focus
 * are browser behaviour, and live in the functional suite.
 */
describe('what a link to several notes explains', () => {
  let content: (props: {
    target: string;
    by: 'name' | 'alias' | null;
    options: Array<{ noteId: string; name: string; trail: string[]; address: string }>;
    state: 'loading' | 'error' | 'ready';
  }) => string;

  beforeAll(async () => {
    const { LinkChoiceContent } = await import('./LinkChoiceContent');
    content = (props) => renderToStaticMarkup(<LinkChoiceContent {...props} />);
  });

  const option = (noteId: string, name: string, trail: string[]) => ({
    noteId,
    name,
    trail,
    address: `/notebooks/n/notes/${noteId}`,
  });

  it('leads each option with its folder trail when the name matched', () => {
    const html = content({
      target: 'Facet',
      by: 'name',
      state: 'ready',
      options: [option('n1', 'Facet', ['Code', 'Discovery']), option('n2', 'Facet', ['Decisions'])],
    });

    // The name is said once, in the explanation, because every option carries
    // it: what tells them apart is the folder.
    expect(html).toContain('Code › Discovery');
    expect(html).toContain('Decisions');
    // The locale of this file is the one the interface starts in, pt_BR.
    expect(html).toContain('é o nome de 2 notas');
    expect(html).not.toContain('link-choice-under');
  });

  it('leads each option with its name when an alias matched, and says it is less durable', () => {
    const html = content({
      target: 'LGL',
      by: 'alias',
      state: 'ready',
      options: [option('n1', 'Lei 14.133', ['Norms']), option('n2', 'Lei Geral', ['Norms'])],
    });

    expect(html).toContain('Lei 14.133');
    expect(html).toContain('link-choice-under');
    expect(html).toContain('devolve o link');
  });

  it('says a name nobody carries is free, and offers nothing', () => {
    const html = content({ target: 'Nowhere yet', by: null, state: 'ready', options: [] });

    expect(html).toContain('Nenhuma nota se chama');
    expect(html).not.toContain('link-choice-option');
  });

  it('shows placeholder rows while the target resolves, so a click is never ignored', () => {
    const html = content({ target: 'Facet', by: null, state: 'loading', options: [] });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('is-placeholder');
  });

  it('names the root when a note of the root is an option', () => {
    const html = content({
      target: 'Facet',
      by: 'name',
      state: 'ready',
      options: [option('n1', 'Facet', []), option('n2', 'Facet', ['Code'])],
    });

    expect(html).toContain('Raiz');
  });
});
