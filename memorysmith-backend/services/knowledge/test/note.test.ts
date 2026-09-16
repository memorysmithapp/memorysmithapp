import { describe, expect, it } from 'vitest';
import { FolderId, NotebookId } from '@memorysmith/kernel';
import { NotePlacement } from '../src/domain/services/NotePlacement.js';
import {
  authorship,
  contentRef,
  expectErr,
  newNote,
  newNotebook,
  noteBody,
  unwrap,
} from './fixtures.js';

const folderId = FolderId.generate();

describe('Note: creation', () => {
  it('records NoteCreated carrying the complete ContentRef', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId, 'Lei 14.133, art. 75');

    // The name is what the content says, and nothing was passed in.
    expect(note.name).toBe('Lei 14.133, art. 75');
    const [event] = note.pullEvents();
    expect(event?.type).toBe('NoteCreated');
    expect(event?.subject).toBe('NOTE');
    expect(event?.subjectId).toBe(note.id.value);
    expect(event?.contentRef?.sha256).toBe(note.bodyRef.sha256);
  });

  it('exposes the revision a caller must echo back on update', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    expect(note.revision).toBe(note.bodyRef.versionId);
  });
});

describe('Note: editing', () => {
  it('replaces the body and records NoteUpdated with the new ref', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    note.pullEvents();

    const next = contentRef('d'.repeat(64), 900);
    expect(unwrap(note.replaceBody(next, noteBody('Lei 14.133'), authorship()))).toBe(true);
    expect(note.bodyRef.equals(next)).toBe(true);
    const [event] = note.pullEvents();
    expect(event?.type).toBe('NoteUpdated');
    expect(event?.contentRef?.bytes).toBe(900);
  });

  it('is a no-op when the content is byte-for-byte identical', () => {
    // RN-KNW-028: no new revision, no event, no re-indexing.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    note.pullEvents();

    const sameBytes = contentRef(note.bodyRef.sha256, note.bodyRef.bytes);
    expect(unwrap(note.replaceBody(sameBytes, noteBody('Lei 14.133'), authorship()))).toBe(false);
    expect(note.pullEvents()).toHaveLength(0);
  });

  it('renames a note by editing the content that states the name', () => {
    // RN-KNW-038: there is no operation that renames a note apart from its
    // content, and this is what one looks like.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    note.pullEvents();

    const rewritten = contentRef('f'.repeat(64), 1500);
    unwrap(note.replaceBody(rewritten, noteBody('Lei 14.133, art. 76'), authorship()));

    expect(note.name).toBe('Lei 14.133, art. 76');
    const [event] = note.pullEvents();
    expect(event?.type).toBe('NoteUpdated');
    // The event is the whole truth: the name the content states AND the live ref.
    expect(event?.payload['name']).toBe('Lei 14.133, art. 76');
    expect(event?.contentRef?.equals(rewritten)).toBe(true);
  });

  it('leaves a note with no addressable name, and writes it anyway', () => {
    // RN-KNW-036: the content states nothing a link could name. The note is
    // written, and what is reported is the absence, not an error.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    note.pullEvents();

    unwrap(note.replaceBody(contentRef('b'.repeat(64), 40), 'Just prose.\n', authorship()));

    expect(note.name).toBeNull();
    expect(note.pullEvents()[0]?.payload['name']).toBeNull();
  });

  it('keeps the two events of a move and a reorder apart', () => {
    // Only NoteUpdated is a snapshot. A transition is a fact of its own, and
    // collapsing two of those would lose one.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    note.pullEvents();

    unwrap(
      note.moveTo(
        { notebookId: notebook.id, folderId: FolderId.generate(), position: note.position },
        authorship(),
      ),
    );
    unwrap(note.reorder(note.position, authorship()));

    expect(note.pullEvents().map((event) => event.type)).toEqual(['NoteMoved', 'NoteReordered']);
  });
});

describe('Note: ordering', () => {
  it('reorders with a single write, zero bytes in S3', () => {
    const notebook = newNotebook();
    const first = newNote(notebook, folderId, 'Lei 14.133');
    const second = newNote(notebook, folderId, 'Lei 8.666', [
      { noteId: first.id, position: first.position },
    ]);
    const before = second.position;
    second.pullEvents();

    const siblings = [
      { noteId: first.id, position: first.position },
      { noteId: second.id, position: second.position },
    ];
    // Move the second note to the front of the folder.
    const position = unwrap(NotePlacement.place(siblings, null, second.id));
    unwrap(second.reorder(position, authorship()));

    const note = second;
    expect(note.position.value < first.position.value).toBe(true);
    expect(note.position.equals(before)).toBe(false);
    const [event] = note.pullEvents();
    expect(event?.type).toBe('NoteReordered');
    // Nothing about the content moved: no ref travels with a reorder.
    expect(event?.contentRef).toBeNull();
  });

  it('refuses to place a note after itself', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    const placement = NotePlacement.place(
      [{ noteId: note.id, position: note.position }],
      note.id,
      note.id,
    );
    expect(expectErr(placement).code).toBe('VALIDATION');
  });
});

describe('Note: moving', () => {
  it('preserves the NoteId and reports both sides of the move', () => {
    // RN-KNW-023: the identifier survives, and with it the whole timeline.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    const originalId = note.id.value;
    note.pullEvents();

    const toNotebook = NotebookId.generate();
    const toFolder = FolderId.generate();
    unwrap(
      note.moveTo(
        { notebookId: toNotebook, folderId: toFolder, position: NotePlacement.append([]) },
        authorship(),
      ),
    );

    expect(note.id.value).toBe(originalId);
    const [event] = note.pullEvents();
    expect(event?.type).toBe('NoteMoved');
    expect(event?.payload).toMatchObject({
      fromNotebookId: notebook.id.value,
      toNotebookId: toNotebook.value,
      toFolderId: toFolder.value,
    });
  });

  it('refuses a move that changes nothing', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    const move = note.moveTo(
      { notebookId: note.notebookId, folderId: note.folderId, position: note.position },
      authorship(),
    );
    expect(expectErr(move).code).toBe('VALIDATION');
  });
});

describe('Note: deleting is not destroying', () => {
  it('marks the note, keeps the bodyRef and records NoteDeleted', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    const bodyBefore = note.bodyRef;
    note.pullEvents();

    unwrap(note.delete(authorship()));

    expect(note.isDeleted).toBe(true);
    // The content pointer is untouched: read_note(asOf) keeps answering.
    expect(note.bodyRef.equals(bodyBefore)).toBe(true);
    expect(note.pullEvents()[0]?.type).toBe('NoteDeleted');
  });

  it('refuses every write on a deleted note', () => {
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    unwrap(note.delete(authorship()));
    note.pullEvents();

    expect(
      expectErr(note.replaceBody(contentRef('e'.repeat(64)), noteBody('Other'), authorship())).code,
    ).toBe('NOT_FOUND');
    expect(expectErr(note.reorder(NotePlacement.append([]), authorship())).code).toBe('NOT_FOUND');
    expect(expectErr(note.delete(authorship())).code).toBe('NOT_FOUND');
  });

  it('has no way back once it is deleted', () => {
    // Deleting is definitive (RN-KNW-029): the mark is the state between the
    // write and the purge, and nothing in the aggregate clears it.
    const notebook = newNotebook();
    const note = newNote(notebook, folderId);
    unwrap(note.delete(authorship()));

    expect(note.isDeleted).toBe(true);
    expect('restore' in note).toBe(false);
  });
});
