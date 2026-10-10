/**
 * A note, a draft or a part of either, drawn for an agent to see (#260,
 * RN-PRT-032).
 *
 * The renderer of the server hands this page what to draw in the storage of
 * the browser and captures what it draws, so these are the three things that
 * decide the image: what the page reads out of the storage, what it cuts out
 * of the note, and that it draws the cut with the reading surface of the note
 * page — rendered to static markup, which is what the image is a picture of.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys';
import type * as PreviewPage from './PreviewNotePage';

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

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

const DRAFT = [
  '---',
  'name: Plan limits',
  'status: draft',
  '---',
  '',
  'What each plan holds.',
  '',
  '## Limits',
  '',
  '> [!warning] Limits',
  '> | Plan | Notes |',
  '> | --- | --- |',
  '> | Free | 100 |',
  '',
  'Read before writing. ^rule',
  '',
  '## Elsewhere',
  '',
  'Not part of the limits.',
  '',
].join('\n');

type Page = typeof PreviewPage;
let page: Page;
let draw: (raw: string, part: string | null) => string;

const LOADING_THE_PIPELINE_MS = 30_000;

beforeAll(async () => {
  await import('../../i18n');
  page = await import('./PreviewNotePage');
  draw = (raw, part) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <page.NotePreview
            notebookId={NOTEBOOK}
            drawing={page.previewOf(raw, part, 'Plan limits')}
            invalidates={queryKeys.note(NOTEBOOK, null)}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, LOADING_THE_PIPELINE_MS);

describe('what the renderer asks the page to draw', () => {
  const stored = (value: unknown) => ({
    getItem: (key: string) => (key === page.PREVIEW_STORAGE_KEY ? JSON.stringify(value) : null),
  });

  it('is a note or a draft, with its folder and its part', () => {
    expect(
      page.readPreviewRequest(stored({ noteId: null, content: '# x', folderId: 'F', part: 'S' })),
    ).toEqual({ noteId: null, content: '# x', folderId: 'F', part: 'S' });
    expect(page.readPreviewRequest(stored({ noteId: 'N', part: '#^rule' }))?.part).toBe('^rule');
    expect(page.readPreviewRequest(stored({ noteId: 'N' }))).toEqual({
      noteId: 'N',
      content: null,
      folderId: null,
      part: null,
    });
  });

  it('is nothing when it is both, neither, or not what the renderer writes', () => {
    expect(page.readPreviewRequest(stored({ noteId: 'N', content: '# x' }))).toBeNull();
    expect(page.readPreviewRequest(stored({}))).toBeNull();
    expect(page.readPreviewRequest({ getItem: () => '{not json' })).toBeNull();
    expect(page.readPreviewRequest({ getItem: () => null })).toBeNull();
  });
});

describe('what the page cuts out of a note', () => {
  it('takes a whole note with its name and its properties, and never its name as one', () => {
    const whole = page.previewOf(DRAFT, null, 'Plan limits');
    expect(whole.kind).toBe('whole');
    expect(whole.kind === 'whole' && whole.properties).toEqual([['status', 'draft']]);
  });

  it('takes a section by its heading and a block by its identifier, as a transclusion does', () => {
    const section = page.previewOf(DRAFT, 'Limits', null);
    expect(section.kind === 'part' && section.raw).toContain('[!warning] Limits');
    expect(section.kind === 'part' && section.raw).not.toContain('Not part of the limits');
    const block = page.previewOf(DRAFT, '^rule', null);
    expect(block.kind === 'part' && block.raw).toContain('Read before writing.');
    expect(block.kind === 'part' && block.raw).not.toContain('Free');
  });

  it('says which part it did not find', () => {
    expect(page.previewOf(DRAFT, 'Nowhere', null)).toEqual({ kind: 'missing', part: 'Nowhere' });
    expect(page.previewOf(DRAFT, '^none', null).kind).toBe('missing');
  });
});

describe('a draft, drawn by the reading surface of the note page', () => {
  it('draws a whole draft with its name, its properties, its callout and its table', () => {
    const html = draw(DRAFT, null);
    expect(html).toContain('<h1>Plan limits</h1>');
    expect(html).toContain('properties-box');
    expect(html).toContain('draft');
    expect(html).toContain('callout');
    expect(html).toContain('<table');
    // The frontmatter is properties, never prose.
    expect(html).not.toContain('status: draft');
  });

  it('draws a part alone, without the name of the note or the rest of it', () => {
    const html = draw(DRAFT, 'Limits');
    expect(html).toContain('callout');
    expect(html).toContain('<table');
    expect(html).not.toContain('<h1>');
    expect(html).not.toContain('Not part of the limits');
  });

  it('says so where the part would be when the note does not hold it', () => {
    expect(draw(DRAFT, 'Nowhere')).toContain('embed-missing');
  });
});
