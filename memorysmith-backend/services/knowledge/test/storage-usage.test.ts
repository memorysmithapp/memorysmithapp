/**
 * What fills the space of a subscription (#197, RN-SUB-024).
 *
 * Two things are worth testing, and neither is a table. The ARITHMETIC — which
 * event moves which counter, and that a note, its bytes and its revisions go
 * in and out together — because a counter that is wrong looks exactly like one
 * that is right. And WHO SEES WHICH LINE, because the totals are about the
 * subscription and the lines are about the requester (rule 9).
 */

import { describe, expect, it } from 'vitest';
import { NotebookRoleLimit, Role, type DomainEvent } from '@memorysmith/kernel';
import { ReadStorageUsage } from '../src/application/usage.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { usageChangeOf, withoutZeros } from '../src/domain/services/StorageUsage.js';
import { InMemoryStorageUsage } from '../src/adapters/outbound/memory/InMemoryAdapters.js';
import {
  authorship,
  contentRef,
  folderDescription,
  folderName,
  newGuidance,
  newNote,
  newNotebook,
  newTemplate,
  otherUser,
  unwrap,
  user,
} from './fixtures.js';

function eventsOf(...sources: Array<{ pullEvents(): DomainEvent[] }>): DomainEvent[] {
  return sources.flatMap((source) => source.pullEvents());
}

describe('the arithmetic of the counters', () => {
  it('counts a note, its bytes and its revisions in and out together', () => {
    const usage = new InMemoryStorageUsage();
    const notebook = newNotebook();
    const folder = unwrap(
      notebook.addFolder(
        null,
        folderName('Normas'),
        folderDescription('Normas.'),
        null,
        authorship(),
      ),
    );
    const note = newNote(notebook, folder.id);
    usage.record(eventsOf(notebook, note));

    unwrap(note.replaceBody(contentRef('b'.repeat(64), 100), 'name: x', authorship()));
    usage.record(eventsOf(note));

    expect(usage.subscription).toMatchObject({
      notebooks: 1,
      folders: 1,
      noteCount: 1,
      noteBytes: 100,
      revisions: 2,
    });
    expect(usage.notebooks.get(notebook.id.value)).toEqual({
      bytes: 100,
      notes: 1,
      folders: 1,
      files: 0,
    });

    unwrap(note.delete(authorship()));
    usage.record(eventsOf(note));

    // The note and its bytes leave at the deletion; its revisions stay until
    // the purge destroys them.
    expect(usage.subscription).toMatchObject({ noteCount: 0, noteBytes: 0, revisions: 2 });
  });

  it('counts a Guidance and a Template once each, however often they are rewritten', () => {
    const usage = new InMemoryStorageUsage();
    const notebook = newNotebook();
    const folder = unwrap(
      notebook.addFolder(
        null,
        folderName('Normas'),
        folderDescription('Normas.'),
        null,
        authorship(),
      ),
    );
    const guidance = newGuidance(notebook, contentRef('a'.repeat(64), 30));
    const template = newTemplate(notebook, folder.id, contentRef('c'.repeat(64), 20));
    unwrap(guidance.replace(contentRef('d'.repeat(64), 35), authorship()));
    usage.record(eventsOf(notebook, guidance, template));

    expect(usage.subscription).toMatchObject({ otherCount: 2, otherBytes: 55, revisions: 3 });

    unwrap(template.delete(authorship()));
    usage.record(eventsOf(template));
    expect(usage.subscription).toMatchObject({ otherCount: 1, otherBytes: 35 });
  });

  it('frees a unit its parent took only when the purge frees its bytes', () => {
    const notebookId = newNotebook().id.value;
    const live = usageChangeOf({
      type: 'NotePurged',
      storageDelta: -40,
      contentRef: null,
      payload: { notebookId, live: true, revisions: 4 },
    });
    expect(live.subscription).toEqual({ revisions: -4, noteCount: -1, noteBytes: -40 });

    // An event written before the flag existed says so through its bytes.
    const older = usageChangeOf({
      type: 'TemplatePurged',
      storageDelta: 0,
      contentRef: null,
      payload: { notebookId },
    });
    expect(withoutZeros(older)).toEqual({ subscription: {}, notebooks: [], forget: null });
  });

  it('forgets a notebook when its purge ends, and only then', () => {
    const usage = new InMemoryStorageUsage();
    const notebook = newNotebook();
    usage.record(eventsOf(notebook));
    usage.record([
      {
        type: 'FolderAdded',
        storageDelta: 0,
        contentRef: null,
        payload: { notebookId: notebook.id.value, folderId: 'f' },
      },
    ]);

    unwrap(notebook.delete(authorship()));
    usage.record(eventsOf(notebook));
    expect(usage.notebooks.has(notebook.id.value)).toBe(true);
    expect(usage.subscription.notebooks).toBe(1);

    usage.record([
      {
        type: 'NotebookPurged',
        storageDelta: 0,
        contentRef: null,
        payload: { notebookId: notebook.id.value, folderCount: 1 },
      },
    ]);
    expect(usage.notebooks.has(notebook.id.value)).toBe(false);
    expect(usage.subscription).toMatchObject({ notebooks: 0, folders: 0 });
  });
});

describe('who sees which line', () => {
  function setUp(notebooks: Notebook[], usage: InMemoryStorageUsage) {
    const byId = new Map(notebooks.map((notebook) => [notebook.id.value, notebook]));
    return new ReadStorageUsage({
      usage,
      notebooks: {
        // The listing leaves a deleted notebook out, as the index does.
        listAll: async () => notebooks.filter((notebook) => !notebook.isDeleted),
        findById: async (id) => byId.get(id.value) ?? null,
        findBySlug: async () => null,
        save: async () => ({ ok: true as const, value: undefined }),
      },
    });
  }

  function twoNotebooks() {
    const usage = new InMemoryStorageUsage();
    const first = newNotebook('First');
    const second = newNotebook('Second');
    const folder = unwrap(
      first.addFolder(null, folderName('Normas'), folderDescription('Normas.'), null, authorship()),
    );
    const note = newNote(first, folder.id);
    usage.record(eventsOf(first, second, note));
    return { usage, first, second };
  }

  it('answers the totals of the subscription and a line per notebook, to the owner', async () => {
    const { usage, first, second } = twoNotebooks();

    const answer = unwrap(
      await setUp([first, second], usage).execute({
        ctx: { user, isOwner: true, role: Role.OWNER },
      }),
    );

    expect(answer.subscription).toMatchObject({ notebooks: 2, folders: 1, noteCount: 1 });
    expect(answer.notebooks.map((line) => line.name).sort()).toEqual(['First', 'Second']);
    expect(answer.notebooks.find((line) => line.name === 'First')).toMatchObject({
      notes: 1,
      folders: 1,
      bytes: 42,
    });
  });

  it('lists a notebook under a ceiling, which lowers a role and never hides a notebook', async () => {
    const { usage, first, second } = twoNotebooks();
    unwrap(first.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));

    const answer = unwrap(
      await setUp([first, second], usage).execute({
        ctx: { user: otherUser, isOwner: false, role: Role.EDITOR },
      }),
    );

    // RN-ACC-012: the ceiling controls writing, not seeing.
    expect(answer.notebooks.map((line) => line.name).sort()).toEqual(['First', 'Second']);
  });

  it('lists nothing to a role that reads no notebook, and still answers the totals', async () => {
    const { usage, first, second } = twoNotebooks();

    const answer = unwrap(
      await setUp([first, second], usage).execute({
        ctx: { user: otherUser, isOwner: false, role: Role.NONE },
      }),
    );

    // Every notebook would answer 404 to this requester (rule 9), so none is
    // listed; the totals are about the subscription, and they hold for anyone.
    expect(answer.notebooks).toEqual([]);
    expect(answer.subscription).toMatchObject({ notebooks: 2, noteCount: 1 });
  });

  it('keeps a deleted notebook listed until its purge ends, under its current name', async () => {
    const { usage, first, second } = twoNotebooks();
    unwrap(first.delete(authorship()));
    usage.record(eventsOf(first));

    const read = setUp([first, second], usage);
    const ctx = { user, isOwner: true, role: Role.OWNER };
    const waiting = unwrap(await read.execute({ ctx }));
    // Its bytes are still in the total until the purge gives them back, and
    // the line that holds them stays with them (RN-KNW-047).
    expect(waiting.notebooks.map((line) => line.name).sort()).toEqual(['First', 'Second']);

    usage.record([
      {
        type: 'NotebookPurged',
        storageDelta: 0,
        contentRef: null,
        payload: { notebookId: first.id.value, folderCount: 1 },
      },
    ]);
    const purged = unwrap(await setUp([second], usage).execute({ ctx }));
    expect(purged.notebooks.map((line) => line.name)).toEqual(['Second']);
    expect(purged.subscription.notebooks).toBe(1);
  });
});
