/**
 * What the files of a notebook answer, which two screens read under ONE cache
 * key (#176).
 *
 * The notebook page loads them so a `![[name]]` can be resolved against what
 * the notebook holds, and the chooser of a transfer loads them to offer them
 * as a species of the selection. Both ask `queryKeys.notebookFiles`, so both
 * get whatever was written there first — and for one afternoon this function
 * answered a **count** to the page and a **list** to the dialog, which meant
 * the dialog read the count and called `.map` on a number. The screen died
 * with `files.map is not a function` the moment somebody picked a notebook
 * that keeps any.
 *
 * So the shape is pinned here: one key, one shape, and the shape is the list.
 * The lookup the page needs is a side effect of loading it, not a second
 * answer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotebookFileDto } from '@memorysmith/contracts';

const KEPT: NotebookFileDto[] = [
  {
    fileId: '01JBQ2X000000000000000000A',
    name: 'engelbart.jpg',
    description: 'A face.',
    mimeType: 'image/jpeg',
    tags: [],
    path: '/',
    bytes: 1024,
    sha256: 'a'.repeat(64),
    updatedAt: '2026-09-20T12:00:00.000Z',
    authorship: { userId: 'user', agent: null, at: '2026-09-20T12:00:00.000Z' },
  } as NotebookFileDto,
];

vi.mock('./backend', () => ({
  getNotebookFiles: vi.fn(async () => KEPT),
}));

const NOTEBOOK = '01JBQ2X0000000000000000001';

describe('the files of a notebook answer a list, which is what the key holds', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('answers the files themselves, and never a count of them', async () => {
    const source = await import('./source');
    const answered = await source.getNotebookFiles(NOTEBOOK);

    // A list, because the dialog that offers them maps over it.
    expect(Array.isArray(answered)).toBe(true);
    expect(answered.map((file) => file.name)).toEqual(['engelbart.jpg']);
  });

  it('leaves the name lookup filled, which is what the note page reads', async () => {
    const source = await import('./source');
    expect(source.fileKept(NOTEBOOK, 'engelbart.jpg')).toBeNull();

    await source.getNotebookFiles(NOTEBOOK);

    expect(source.fileKept(NOTEBOOK, 'engelbart.jpg')?.mimeType).toBe('image/jpeg');
    // And a name nothing is kept under stays nothing: the extension of a name
    // decides nothing, what the notebook HOLDS decides everything.
    expect(source.fileKept(NOTEBOOK, 'engelbart.png')).toBeNull();
  });
});
