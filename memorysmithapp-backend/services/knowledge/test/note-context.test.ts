/**
 * The context a revision of a note records (#348): what differed when it was
 * written, kept on the note's own item and read back as it was written.
 */

import { describe, expect, it } from 'vitest';
import {
  Authorship,
  ContentRef,
  ContentId,
  FolderId,
  NoteId,
  NotebookId,
  Position,
  SubscriptionId,
  UserId,
} from '@memorysmithapp/kernel';
import { Note } from '../src/domain/note/Note.js';
import { NoteContexts, type NoteContext } from '../src/domain/note/NoteContext.js';
import { noteItem, parseNote } from '../src/adapters/outbound/dynamodb/items.js';

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
}

const subscriptionId = unwrap(SubscriptionId.fromClaim('01JBQ2X0000000000000000002'));
const by = Authorship.byHuman(unwrap(UserId.create('user-owner')));

function aNote(): Note {
  return unwrap(
    Note.create({
      id: NoteId.generate(),
      subscriptionId,
      notebookId: unwrap(NotebookId.create('01JBQ2X0000000000000000001')),
      folderId: unwrap(FolderId.create('01JBQ2X0000000000000000003')),
      body: '---\nname: Visita\n---\n',
      position: unwrap(Position.create('a0')),
      bodyRef: unwrap(
        ContentRef.create({
          contentId: ContentId.generate(),
          versionId: 'v1',
          sha256: 'a'.repeat(64),
          bytes: 20,
        }),
      ),
      by,
    }),
  );
}

const read: NoteContext = { guidance: 'g1', template: null, structure: '4' };

describe('the context of a note (#348)', () => {
  it('names what differs, in a stable order', () => {
    expect(NoteContexts.staleParts(read, read)).toEqual([]);
    expect(
      NoteContexts.staleParts(read, { guidance: 'g2', template: 't1', structure: '5' }),
    ).toEqual(['guidance', 'template', 'structure']);
  });

  it('records what was stale and answers it, and forgets it on a write that declares nothing', () => {
    const note = aNote();
    const current = { ...read, guidance: 'g2' };
    note.recordContext({ read, current });
    expect(note.staleContext).toEqual(['guidance']);
    expect(note.contextNotice).toEqual({ changed: ['guidance'], current });

    note.recordContext(null);
    expect(note.context).toBeNull();
    expect(note.staleContext).toEqual([]);
    expect(note.contextNotice).toBeNull();
  });

  it('is kept on the note item and read back as written', () => {
    const note = aNote();
    note.recordContext({ read, current: { ...read, structure: '5' } });
    const item = noteItem(note, { pk: 'pk', sk: 'sk', gsi2pk: 'g', gsi2sk: 'g' });
    const back = parseNote(item, subscriptionId);
    expect(back.context).toEqual({ read, stale: ['structure'] });
    // What a write answers is never stored.
    expect(back.contextNotice).toBeNull();

    const plain = parseNote(
      noteItem(aNote(), { pk: 'pk', sk: 'sk', gsi2pk: 'g', gsi2sk: 'g' }),
      subscriptionId,
    );
    expect(plain.context).toBeNull();
  });
});
