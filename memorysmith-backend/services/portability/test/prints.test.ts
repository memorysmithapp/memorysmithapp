/**
 * A note downloaded as a PDF made by the server (#263, RN-PRT-031).
 */

import { describe, expect, it } from 'vitest';
import { ulid } from '@memorysmith/kernel';
import { GetPrint, PRINT_DEADLINE_MILLIS, StartPrint } from '../src/application/Prints.js';
import { InMemoryPrintQueue, InMemoryPrintStore } from '../src/adapters/memory.js';
import { attachmentNamed } from '../src/adapters/s3.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTE = '01JBQ2X00000000000000000N1';
const choices = { placement: 'cover', tables: 'wrap', orientation: 'portrait' } as const;

describe('a print is started as the person who asks for it', () => {
  it('hands the renderer the note, the choices and the token, and answers the print', async () => {
    const queue = new InMemoryPrintQueue();
    const started = await new StartPrint(queue, SUBSCRIPTION).execute({
      notebookId: '01JBQ2X00000000000000000V1',
      noteId: NOTE.toLowerCase(),
      accessToken: 'eyJ.token.of-the-session',
      choices,
      locale: 'pt_BR',
    });
    expect(started.ok).toBe(true);
    expect(queue.sent).toHaveLength(1);
    expect(queue.sent[0]).toMatchObject({
      subscriptionId: SUBSCRIPTION,
      noteId: NOTE,
      accessToken: 'eyJ.token.of-the-session',
      choices,
      locale: 'pt_BR',
    });
  });

  it('starts nothing for a note that is not an identifier, or without a session', async () => {
    const queue = new InMemoryPrintQueue();
    const print = new StartPrint(queue, SUBSCRIPTION);
    const base = { notebookId: 'x', choices, locale: 'en_US' };
    expect((await print.execute({ ...base, noteId: 'nota', accessToken: 't' })).ok).toBe(false);
    expect((await print.execute({ ...base, noteId: NOTE, accessToken: '' })).ok).toBe(false);
    expect(queue.sent).toHaveLength(0);
  });
});

describe('a print is polled until its file is made', () => {
  it('is running until the renderer leaves the file, and then answers a link named after the note', async () => {
    const store = new InMemoryPrintStore();
    const printId = ulid();
    const get = new GetPrint(store, SUBSCRIPTION);
    expect(await get.execute(printId)).toMatchObject({ value: { status: 'running' } });

    store.set(SUBSCRIPTION, printId, { status: 'ready', name: 'Ata de reunião' });
    const ready = await get.execute(printId.toLowerCase());
    expect(ready.ok && ready.value.status).toBe('ready');
    expect(ready.ok && ready.value.downloadUrl).toContain(encodeURIComponent('Ata de reunião.pdf'));
    expect(ready.ok && ready.value.expiresAt).toBeTruthy();
  });

  it('says why there is no file, and that a print nobody finished timed out', async () => {
    const store = new InMemoryPrintStore();
    const failed = ulid();
    store.set(SUBSCRIPTION, failed, { status: 'failed', failure: 'NOT_FOUND' });
    const get = new GetPrint(store, SUBSCRIPTION, () => Date.now() + PRINT_DEADLINE_MILLIS * 2);
    expect(await get.execute(failed)).toMatchObject({ value: { failure: 'NOT_FOUND' } });
    expect(await get.execute(ulid())).toMatchObject({
      value: { status: 'failed', failure: 'TIMED_OUT' },
    });
  });

  it('finds the print of another subscription nowhere', async () => {
    const store = new InMemoryPrintStore();
    const printId = ulid();
    store.set('01JBQ2X0000000000000000OTH', printId, { status: 'ready', name: 'Alheia' });
    const answer = await new GetPrint(store, SUBSCRIPTION).execute(printId);
    expect(answer.ok && answer.value.status).toBe('running');
    expect((await new GetPrint(store, SUBSCRIPTION).execute('not-a-print')).ok).toBe(false);
  });
});

describe('a download is named after what it is, in any language', () => {
  it('carries the name whole for a browser, and without its accents for an old client', () => {
    const header = attachmentNamed('Ata de reunião (março).pdf');
    expect(header).toContain('filename="Ata de reuniao (marco).pdf"');
    expect(header).toContain("filename*=UTF-8''Ata%20de%20reuni%C3%A3o%20%28mar%C3%A7o%29.pdf");
    expect(attachmentNamed('a "quoted" name')).toContain('filename="a quoted name"');
  });
});
