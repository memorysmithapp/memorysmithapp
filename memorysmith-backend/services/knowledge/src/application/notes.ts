/**
 * Note use cases: form B of the transaction, the hot path
 * (architecture-guide.md, section 10.2).
 *
 * One rule of the public contract lives here, and it is what makes an agent
 * safe to point at a notebook: update_note requires baseRevision, and a
 * divergence answers CONFLICT WITH THE CURRENT CONTENT attached, so the caller
 * can choose between redoing and merging (RN-AGT-005).
 *
 * The other one used to be idempotency, and it is gone with the key it stood
 * on: **create_note always creates** (RN-AGT-024). Nothing in a notebook is
 * unique, two notes may carry one name (RN-KNW-037), and a repeated call
 * writes a second note. Answering ALREADY_EXISTS would mean the API refusing
 * what the model allows.
 */

import {
  type Authorship,
  DomainError,
  err,
  type FolderId,
  NoteId,
  ok,
  type NotebookId,
  type Result,
} from '@memorysmith/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import { Note } from '../domain/note/Note.js';
import { NotePlacement, type NoteOrder } from '../domain/services/NotePlacement.js';
import { NOTEBOOK_LIMITS } from '../domain/values.js';
import type { NoteRepository } from '../domain/ports/index.js';
import { loadAuthorized, type NotebookDependencies } from './notebooks.js';
import { admitWrite } from '../domain/services/StorageQuota.js';

export interface NoteDependencies extends NotebookDependencies {
  readonly notes: NoteRepository;
}

const MAX_RETRIES = 3;

/** Retries a lost optimistic lock up to three times before surfacing it. */
async function withRetry<T>(
  operation: () => Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  let last: Result<T, DomainError> | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    last = await operation();
    if (last.ok || last.error.code !== 'CONFLICT') return last;
  }
  return last as Result<T, DomainError>;
}

/**
 * The notes of a folder in the defined order, with the anchor of a placement
 * among them when it lives there.
 *
 * The listing of a folder is an index that converges after a write, so a note
 * written a moment ago can be missing from it, and an agent that writes a note
 * and then the one that goes after it would be refused an anchor that exists.
 * The anchor is read from the table itself, and joins the siblings when it is a
 * live note of this folder; anything else stays out and is refused as not a
 * sibling (RN-AGT-029).
 */
async function siblingsWithAnchor(
  deps: NoteDependencies,
  notebookId: NotebookId,
  folderId: FolderId,
  anchorId: NoteId | null,
): Promise<NoteOrder[]> {
  const siblings = await deps.notes.siblingOrder(notebookId, folderId);
  if (!anchorId || siblings.some((each) => each.noteId.equals(anchorId))) return siblings;

  const anchor = await deps.notes.findById(notebookId, anchorId);
  if (!anchor || anchor.isDeleted || !anchor.folderId.equals(folderId)) return siblings;
  return [...siblings, { noteId: anchor.id, position: anchor.position }].sort((left, right) => {
    const byPosition = left.position.compare(right.position);
    return byPosition !== 0 ? byPosition : left.noteId.value.localeCompare(right.noteId.value);
  });
}

export class ListNotes {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId?: FolderId | undefined;
  }): Promise<Result<Note[], DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    return ok(
      input.folderId
        ? await this.deps.notes.listByFolder(input.notebookId, input.folderId)
        : await this.deps.notes.listByNotebook(input.notebookId),
    );
  }
}

export class ReadNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
  }): Promise<Result<{ note: Note; content: string }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    const note = await this.deps.notes.findById(input.notebookId, input.noteId);
    if (!note || note.isDeleted) return err(DomainError.notFound('Note not found'));

    return ok({ note, content: await this.deps.content.read(note.bodyRef) });
  }
}

export class CreateNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    folderId: FolderId;
    content: string;
    afterNoteId: NoteId | null;
    by: Authorship;
  }): Promise<Result<Note, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    if (!notebook.value.folders.has(input.folderId)) {
      return err(DomainError.notFound('Folder not found in this notebook'));
    }
    if (Buffer.byteLength(input.content, 'utf8') > NOTEBOOK_LIMITS.maxNoteBytes) {
      return err(DomainError.limitExceeded('A note holds at most 1 MB of content'));
    }
    if (notebook.value.noteCount >= NOTEBOOK_LIMITS.maxNotes) {
      return err(
        DomainError.limitExceeded(`A notebook holds at most ${NOTEBOOK_LIMITS.maxNotes} notes`),
      );
    }
    // A new note costs its whole body, and the check runs before the content
    // is written so a refused write leaves nothing in the store (RN-SUB-021).
    const admitted = admitWrite(
      await this.deps.storage.current(),
      Buffer.byteLength(input.content, 'utf8'),
    );
    if (!admitted.ok) return admitted;

    // Where it goes is decided before anything is stored, so a refused anchor
    // leaves no content behind.
    const siblings = await siblingsWithAnchor(
      this.deps,
      input.notebookId,
      input.folderId,
      input.afterNoteId,
    );
    const position = input.afterNoteId
      ? NotePlacement.place(siblings, input.afterNoteId)
      : ok(NotePlacement.append(siblings));
    if (!position.ok) return position;

    // Content first, pointer second (section 10.5).
    const body = await this.deps.content.create(input.content);

    const note = Note.create({
      id: NoteId.generate(),
      subscriptionId: notebook.value.subscriptionId,
      notebookId: input.notebookId,
      folderId: input.folderId,
      body: input.content,
      position: position.value,
      bodyRef: body,
      by: input.by,
    });
    if (!note.ok) return note;

    const saved = await this.deps.notes.save(note.value);
    return saved.ok ? ok(note.value) : err(saved.error);
  }
}

export class UpdateNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
    content: string;
    baseRevision: string;
    by: Authorship;
  }): Promise<Result<Note, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;
    if (Buffer.byteLength(input.content, 'utf8') > NOTEBOOK_LIMITS.maxNoteBytes) {
      return err(DomainError.limitExceeded('A note holds at most 1 MB of content'));
    }

    return withRetry(async () => {
      const note = await this.deps.notes.findById(input.notebookId, input.noteId);
      if (!note || note.isDeleted) return err(DomainError.notFound('Note not found'));

      if (note.revision !== input.baseRevision) {
        // The current content travels with the conflict, so the caller can
        // decide between redoing and merging. Blind overwrite is not accepted
        // in a notebook that sustains auditing.
        return err(
          DomainError.conflict('The note changed since the revision you based this edit on', {
            currentRevision: note.revision,
            currentContent: await this.deps.content.read(note.bodyRef),
          }),
        );
      }

      // Identical bytes are not a write: nothing reaches the store, and the
      // note answers as it is (RN-KNW-028).
      if (note.bodyRef.matchesContent(input.content)) return ok(note);

      // Only the difference between the revision that is live and the one
      // being written: an edit that shortens a note never costs anything.
      const admitted = admitWrite(
        await this.deps.storage.current(),
        Buffer.byteLength(input.content, 'utf8') - note.bodyRef.bytes,
      );
      if (!admitted.ok) return admitted;

      const ref = await this.deps.content.overwrite(note.bodyRef.contentId, input.content);
      const replaced = note.replaceBody(ref, input.content, input.by);
      if (!replaced.ok) return replaced;
      if (!note.hasChanges) return ok(note); // identical bytes (RN-KNW-028)

      const saved = await this.deps.notes.save(note);
      return saved.ok ? ok(note) : err(saved.error);
    });
  }
}

export class ReorderNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
    afterNoteId: NoteId | null;
    by: Authorship;
  }): Promise<Result<Note, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const note = await this.deps.notes.findById(input.notebookId, input.noteId);
    if (!note || note.isDeleted) return err(DomainError.notFound('Note not found'));

    const siblings = await siblingsWithAnchor(
      this.deps,
      input.notebookId,
      note.folderId,
      input.afterNoteId,
    );
    const position = NotePlacement.place(siblings, input.afterNoteId, note.id);
    if (!position.ok) return position;

    const reordered = note.reorder(position.value, input.by);
    if (!reordered.ok) return reordered;

    // The note as this write left it: its position is how a caller learns where
    // it now sits, since the listing of a folder is an index that converges
    // after the write (RN-AGT-029).
    const saved = await this.deps.notes.save(note);
    return saved.ok ? ok(note) : err(saved.error);
  }
}

/**
 * Moving between folders costs zero bytes in S3. Moving between notebooks is the
 * only operation that writes into two notebook partitions in one transaction, and
 * it preserves the NoteId, and with it the whole timeline (RN-KNW-023).
 *
 * Nothing is resolved against the destination on the way in: a name collides
 * with nothing there, so the move carries no policy (RN-KNW-022, removed).
 */
export class MoveNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
    toNotebookId: NotebookId | null;
    toFolderId: FolderId;
    afterNoteId: NoteId | null;
    by: Authorship;
  }): Promise<Result<Note, DomainError>> {
    const origin = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!origin.ok) return origin;

    const destinationNotebookId = input.toNotebookId ?? input.notebookId;
    const crossNotebook = !destinationNotebookId.equals(input.notebookId);
    const destination = crossNotebook
      ? await loadAuthorized(this.deps, input.ctx, destinationNotebookId, 'write')
      : origin;
    if (!destination.ok) return destination;

    if (!destination.value.folders.has(input.toFolderId)) {
      return err(DomainError.notFound('Folder not found in the destination notebook'));
    }

    const note = await this.deps.notes.findById(input.notebookId, input.noteId);
    if (!note || note.isDeleted) return err(DomainError.notFound('Note not found'));

    const siblings = await siblingsWithAnchor(
      this.deps,
      destinationNotebookId,
      input.toFolderId,
      input.afterNoteId,
    );
    const position = input.afterNoteId
      ? NotePlacement.place(siblings, input.afterNoteId, note.id)
      : ok(NotePlacement.append(siblings));
    if (!position.ok) return position;

    const moved = note.moveTo(
      {
        notebookId: destinationNotebookId,
        folderId: input.toFolderId,
        position: position.value,
      },
      input.by,
    );
    if (!moved.ok) return moved;

    const saved = crossNotebook
      ? await this.deps.notes.saveMoved(note, { notebookId: input.notebookId })
      : await this.deps.notes.save(note);
    return saved.ok ? ok(note) : err(saved.error);
  }
}

/** Soft delete: the note leaves the listings, the bytes stay (RN-KNW-029). */
export class DeleteNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const note = await this.deps.notes.findById(input.notebookId, input.noteId);
    if (!note || note.isDeleted) return err(DomainError.notFound('Note not found'));

    const deleted = note.delete(input.by);
    if (!deleted.ok) return deleted;

    const saved = await this.deps.notes.save(note);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class RestoreNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const note = await this.deps.notes.findById(input.notebookId, input.noteId);
    if (!note) return err(DomainError.notFound('Note not found'));

    // A note lives in a folder, and the folder of this one may have been removed
    // with it (RN-KNW-040). Restoring it there would bring back a live note no
    // tree shows, so it is refused (RN-KNW-041).
    if (!notebook.value.folders.has(note.folderId)) {
      return err(
        DomainError.conflict(
          'The folder this note was in has been removed, so the note has nowhere to come back to.',
        ),
      );
    }

    // Nothing has to be free for a note to come back: another note may have
    // been written under the same name in the meantime, and both stand
    // (RN-KNW-037, and RN-KNW-030, removed).
    //
    // Bringing a note back puts its bytes back on the count, so it is a write
    // that grows the stored content and is refused when there is no room.
    const admitted = admitWrite(await this.deps.storage.current(), note.bodyRef.bytes);
    if (!admitted.ok) return admitted;

    const restored = note.restore(input.by);
    if (!restored.ok) return restored;

    const saved = await this.deps.notes.save(note);
    return saved.ok ? ok() : err(saved.error);
  }
}
