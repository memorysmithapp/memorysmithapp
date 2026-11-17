/**
 * An embed never reaches the note it is written in (#472, RN-DSC-067).
 *
 * A note named `foto.jpg` embedding `![[foto.jpg]]` beside a file `foto.jpg`
 * shows the file, which is what naming a note after the file it shows means.
 * From 0.11 the renderer asks for a note before a file, so it is the address
 * the page hands it that takes the note itself out: without it, the note would
 * transclude itself. A Guidance, a Template and a dashboard hand none, and
 * nothing is taken out for them. Rendered to static markup, as the other
 * reading-surface cases are; what the file looks like once its link arrives is
 * the functional suite's.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotebookStructure } from '../types/api';
import type * as Backend from '../api/backend';
import { queryKeys } from '../api/query-keys';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const FOLDER = '01J8X2K9QZ3M4N5P6R7S8T9VF1';
const FOTO = '01J8X2K9QZ3M4N5P6R7S8T9VN1';
const OTHER = '01J8X2K9QZ3M4N5P6R7S8T9VN2';

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

const structureWith = (notes: Array<{ id: string; name: string }>) =>
  ({
    notebook: { id: NOTEBOOK, slug: 'n', name: 'N', description: '', noteCount: 1, updatedAt: '' },
    guidance: null,
    guidanceRevision: null,
    structureRevision: '1',
    permissions: { writeContent: true, maintain: true, administer: true },
    effectiveRole: 'OWNER',
    folders: [
      {
        id: FOLDER,
        parentId: null,
        name: 'Fotos',
        slug: 'fotos',
        description: '',
        position: 0,
        noteOrder: 'manual',
        hasTemplate: false,
        noteCount: notes.length,
        notes: notes.map((each) => ({ ...each, folderId: FOLDER })),
        children: [],
      },
    ],
  }) as unknown as NotebookStructure;

let structure = structureWith([{ id: FOTO, name: 'foto.jpg' }]);

vi.mock('../api/backend', async (original) => ({
  ...(await original<typeof Backend>()),
  getNotebookStructure: async () => structure,
  getNotebookFiles: async () => [
    {
      fileId: '01J8X2K9QZ3M4N5P6R7S8T9VA1',
      name: 'foto.jpg',
      description: '',
      mimeType: 'image/jpeg',
      tags: [],
      path: '/',
      bytes: 1024,
      sha256: '0'.repeat(64),
      updatedAt: '2026-11-16T00:00:00.000Z',
      authorship: { kind: 'person', userId: 'u', displayName: 'U' },
    },
  ],
  // Static markup draws what is there before anything arrives.
  getNote: () => new Promise(() => undefined),
  resolveLinkTarget: () => new Promise(() => undefined),
  linkToFile: () => new Promise(() => undefined),
}));

const NOTE = '---\nname: foto.jpg\n---\n![[foto.jpg]]\n';

let render: (noteId?: string) => string;
let load: () => Promise<void>;

const LOADING_THE_PIPELINE_MS = 30_000;

beforeAll(async () => {
  await import('../../i18n');
  const source = await import('../api/source');
  load = async () => {
    await source.getNotebookStructure(NOTEBOOK);
    await source.getNotebookFiles(NOTEBOOK);
  };
  await load();
  const { NoteContent } = await import('./NoteContent');

  render = (noteId?: string): string =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <NoteContent
            raw={NOTE}
            notebookId={NOTEBOOK}
            {...(noteId ? { noteId } : {})}
            baseRevision="rev-1"
            writable={false}
            write={() => Promise.resolve('rev-2')}
            invalidates={queryKeys.note(NOTEBOOK, noteId ?? null)}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, LOADING_THE_PIPELINE_MS);

/** A file being drawn: its link is still on its way, so it is its name for now. */
const FILE = '<span class="attachment-loading">foto.jpg</span>';
/** A note being drawn in place: it is still being read, so it is its skeleton for now. */
const EMBEDDED_NOTE = 'embed-skeleton';

describe('an embed of the name of the note it is written in (#472, RN-DSC-067)', () => {
  it('draws the file of that name on the note page, and not the note itself', () => {
    const html = render(FOTO);
    expect(html).toContain(FILE);
    expect(html).not.toContain(EMBEDDED_NOTE);
  });

  it('takes nothing out where no note is drawn, as on a Guidance or a Template', () => {
    // The one note of the name answers, and is drawn in place.
    const html = render();
    expect(html).toContain(EMBEDDED_NOTE);
    expect(html).not.toContain(FILE);
  });

  it('reaches another note of that name before the file', async () => {
    structure = structureWith([
      { id: FOTO, name: 'foto.jpg' },
      { id: OTHER, name: 'foto.jpg' },
    ]);
    await load();
    try {
      // Two notes carry the name: with the note itself out, the other one is
      // left, and it is drawn in place, read by its address.
      const html = render(FOTO);
      expect(html).toContain(EMBEDDED_NOTE);
      expect(html).not.toContain(FILE);
    } finally {
      structure = structureWith([{ id: FOTO, name: 'foto.jpg' }]);
      await load();
    }
  });
});
