/**
 * How a note is drawn, as an image an agent can see (#260, RN-PRT-032).
 */

import { describe, expect, it } from 'vitest';
import { ulid } from '@memorysmithapp/kernel';
import {
  clipOf,
  GetPreview,
  partOf,
  PREVIEW_MAX_HEIGHT,
  PREVIEW_WIDTH,
  StartPreview,
} from '../src/application/Previews.js';
import { PRINT_DEADLINE_MILLIS } from '../src/application/Prints.js';
import { InMemoryPreviewQueue, InMemoryPreviewStore } from '../src/adapters/memory.js';
import { previewStorageOf } from '../src/adapters/chromium.js';
import { previewKey } from '../src/adapters/previews.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTEBOOK = '01JBQ2X00000000000000000V1';
const NOTE = '01JBQ2X00000000000000000N1';
const FOLDER = '01JBQ2X00000000000000000F1';
const TOKEN = 'eyJ.token.of-the-connector';

function start() {
  const queue = new InMemoryPreviewQueue();
  const store = new InMemoryPreviewStore();
  return { queue, store, preview: new StartPreview(queue, store, SUBSCRIPTION) };
}

describe('a preview is started as the person the connector acts for', () => {
  it('hands the renderer a written note and its part, and keeps no draft', async () => {
    const { queue, store, preview } = start();
    const started = await preview.execute({
      notebookId: NOTEBOOK,
      noteId: NOTE.toLowerCase(),
      part: '#Decisões',
      accessToken: TOKEN,
      locale: 'en_US',
    });
    expect(started.ok).toBe(true);
    expect(queue.sent[0]).toMatchObject({
      kind: 'preview',
      subscriptionId: SUBSCRIPTION,
      notebookId: NOTEBOOK,
      noteId: NOTE,
      draft: false,
      folderId: null,
      part: 'Decisões',
      accessToken: TOKEN,
    });
    expect(store.drafts.size).toBe(0);
  });

  it('keeps a draft under the subscription, beside the image it will be, and names its folder', async () => {
    const { queue, store, preview } = start();
    const started = await preview.execute({
      notebookId: NOTEBOOK,
      content: '---\nname: Draft\n---\n\n> [!warning] Limits\n> | a | b |\n',
      folderId: FOLDER.toLowerCase(),
      part: '#^limits',
      accessToken: TOKEN,
      locale: 'pt_BR',
    });
    expect(started.ok).toBe(true);
    const previewId = started.ok ? started.value.previewId : '';
    expect(store.drafts.get(`${SUBSCRIPTION}/${previewId}`)).toContain('[!warning] Limits');
    // The draft never rides the queue: a note may be a megabyte.
    expect(queue.sent[0]).toMatchObject({ draft: true, folderId: FOLDER, part: '^limits' });
    expect(JSON.stringify(queue.sent[0])).not.toContain('Limits');
  });

  it('draws exactly one of a note and a draft, and says so', async () => {
    const { queue, preview } = start();
    const base = { notebookId: NOTEBOOK, accessToken: TOKEN, locale: 'en_US' };
    const both = await preview.execute({ ...base, noteId: NOTE, content: 'x' });
    const neither = await preview.execute(base);
    expect(both.ok || neither.ok).toBe(false);
    expect(!both.ok && both.error.code).toBe('VALIDATION');
    expect(!neither.ok && neither.error.message).toContain('exactly one');
    // A folder is where a draft would go; a note is drawn where it is.
    const placed = await preview.execute({ ...base, noteId: NOTE, folderId: FOLDER });
    expect(!placed.ok && placed.error.code).toBe('VALIDATION');
    expect(queue.sent).toHaveLength(0);
  });

  it('starts nothing without a session, for an empty draft, a bad identifier or an empty part', async () => {
    const { queue, preview } = start();
    const base = { notebookId: NOTEBOOK, locale: 'en_US' };
    expect((await preview.execute({ ...base, noteId: NOTE, accessToken: '' })).ok).toBe(false);
    expect((await preview.execute({ ...base, content: '  \n', accessToken: TOKEN })).ok).toBe(
      false,
    );
    const note = await preview.execute({ ...base, noteId: 'nota', accessToken: TOKEN });
    expect(!note.ok && note.error.code).toBe('NOT_FOUND');
    const part = await preview.execute({ ...base, noteId: NOTE, part: '#', accessToken: TOKEN });
    expect(!part.ok && part.error.code).toBe('VALIDATION');
    expect(queue.sent).toHaveLength(0);
  });
});

describe('a part is addressed as a transclusion addresses one', () => {
  it('takes a heading or a block, with or without its #', () => {
    expect(partOf('#Section')).toEqual({ ok: true, value: 'Section' });
    expect(partOf('Section')).toEqual({ ok: true, value: 'Section' });
    expect(partOf('#^abc123')).toEqual({ ok: true, value: '^abc123' });
    expect(partOf(undefined)).toEqual({ ok: true, value: null });
    expect(partOf('#^').ok).toBe(false);
    expect(partOf('  ').ok).toBe(false);
  });
});

describe('a preview is asked for until its image is drawn', () => {
  it('is running until the renderer leaves the image, and then answers it with its size', async () => {
    const store = new InMemoryPreviewStore();
    const previewId = ulid();
    const get = new GetPreview(store, SUBSCRIPTION);
    expect(await get.execute(previewId)).toMatchObject({ value: { status: 'running' } });

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    store.set(SUBSCRIPTION, previewId, {
      status: 'ready',
      image: { png, width: 760, height: 1600, drawnHeight: 2400 },
    });
    const ready = await get.execute(previewId.toLowerCase());
    expect(ready.ok && ready.value.image).toEqual({
      mimeType: 'image/png',
      base64: Buffer.from(png).toString('base64'),
      width: 760,
      height: 1600,
      drawnHeight: 2400,
      cut: true,
    });
  });

  it('says why there is no image, that one nobody finished timed out, and finds no other subscription', async () => {
    const store = new InMemoryPreviewStore();
    const failed = ulid();
    store.set(SUBSCRIPTION, failed, { status: 'failed', failure: 'PART_NOT_FOUND' });
    const late = new GetPreview(store, SUBSCRIPTION, () => Date.now() + PRINT_DEADLINE_MILLIS * 2);
    expect(await late.execute(failed)).toMatchObject({ value: { failure: 'PART_NOT_FOUND' } });
    expect(await late.execute(ulid())).toMatchObject({
      value: { status: 'failed', failure: 'TIMED_OUT' },
    });

    const theirs = ulid();
    store.set('01JBQ2X0000000000000000OTH', theirs, { status: 'failed', failure: 'X' });
    const get = new GetPreview(store, SUBSCRIPTION);
    expect(await get.execute(theirs)).toMatchObject({ value: { status: 'running' } });
    expect((await get.execute('not-a-preview')).ok).toBe(false);
  });
});

describe('the renderer', () => {
  it('cuts the image at the reading width and at most 1600 high, and says when it cut', () => {
    expect(clipOf(412.4)).toEqual({ width: PREVIEW_WIDTH, height: 413, cut: false });
    expect(clipOf(1600)).toEqual({ width: 760, height: 1600, cut: false });
    expect(clipOf(1600.2)).toEqual({ width: 760, height: PREVIEW_MAX_HEIGHT, cut: true });
    expect(clipOf(0).height).toBe(1);
  });

  it('hands the page the session and what to draw, and nothing of the queue it came from', () => {
    const storage = previewStorageOf(
      {
        kind: 'preview',
        previewId: ulid(),
        subscriptionId: SUBSCRIPTION,
        notebookId: NOTEBOOK,
        noteId: null,
        draft: true,
        folderId: FOLDER,
        part: 'Section',
        accessToken: TOKEN,
        locale: 'xx',
      },
      '# A draft',
    );
    expect(JSON.parse(storage['memorysmith.preview'] ?? '{}')).toEqual({
      noteId: null,
      content: '# A draft',
      folderId: FOLDER,
      part: 'Section',
    });
    expect(JSON.parse(storage['memorysmith.tokens'] ?? '{}')).toMatchObject({
      accessToken: TOKEN,
    });
    expect(storage['memorysmith.locale']).toBe('en_US');
  });

  it('keeps every object of a preview under the subscription that asked', () => {
    expect(previewKey(SUBSCRIPTION, 'P1', 'png')).toBe(`s/${SUBSCRIPTION}/previews/P1.png`);
    expect(previewKey(SUBSCRIPTION, 'P1', 'md')).toBe(`s/${SUBSCRIPTION}/previews/P1.md`);
  });
});
