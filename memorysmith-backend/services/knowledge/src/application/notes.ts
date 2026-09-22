/**
 * Note use cases: form B of the transaction, the hot path
 * (architecture-guide.md, section 10.2).
 *
 * One rule of the public contract lives here, and it is what makes an agent
 * safe to point at a notebook: update_note requires baseRevision, and a
 * divergence answers CONFLICT WITH THE CURRENT CONTENT attached, so the caller
 * can choose between redoing and merging (RN-AGT-005).
 *
 * The other one is what a folder holds once: a name (RN-KNW-037). Two live
 * notes of one folder never carry the same name, so creating, renaming or moving
 * into a name the folder already holds is refused, naming the note that holds
 * it (RN-KNW-042) — and a create retried after its answer was lost finds the
 * note it made instead of writing a twin (RN-AGT-024). Across folders names
 * repeat freely, and the folder is what tells them apart for whoever reads.
 */

import {
  type Authorship,
  DomainError,
  err,
  type FolderId,
  NoteId,
  noteName,
  ok,
  type NotebookId,
  type Result,
} from '@memorysmith/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import type { Notebook } from '../domain/notebook/Notebook.js';
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

/**
 * A note, and only while every unit above it is valid (RN-KNW-046).
 *
 * A note lives in a folder, and a folder that was removed took everything
 * under it out of reach in that one write: nothing under it was rewritten, so
 * the item of a note whose folder is gone is still in the table, still
 * pointing at its content, until the purge takes it. Whether the note is
 * reachable is not what its own item says, it is what the tree says, and the
 * tree is already loaded here.
 *
 * The notebook needs no check of its own: `loadAuthorized` answers a deleted
 * one as not found before any of this runs.
 */
async function liveNote(
  deps: NoteDependencies,
  notebook: Notebook,
  notebookId: NotebookId,
  noteId: NoteId,
): Promise<Result<Note, DomainError>> {
  const note = await deps.notes.findById(notebookId, noteId);
  if (!note || note.isDeleted || !notebook.folders.has(note.folderId)) {
    return err(DomainError.notFound('Note not found'));
  }
  return ok(note);
}

/** Whether a refusal is a taken name, which no retry changes (RN-KNW-042). */
function isNameTaken(error: DomainError): boolean {
  return (error.details as { code?: string } | undefined)?.code === 'ALREADY_EXISTS';
}

/** Retries a lost optimistic lock up to three times before surfacing it. */
async function withRetry<T>(
  operation: () => Promise<Result<T, DomainError>>,
): Promise<Result<T, DomainError>> {
  let last: Result<T, DomainError> | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    last = await operation();
    if (last.ok || last.error.code !== 'CONFLICT' || isNameTaken(last.error)) return last;
  }
  return last as Result<T, DomainError>;
}

/**
 * The refusal of RN-KNW-042, naming the note that holds the name, so the
 * caller can read it and update it instead of guessing (RN-AGT-030).
 */
function nameTakenBy(holder: NoteId, name: string): DomainError {
  return DomainError.conflict(`A note of this folder is already named "${name}"`, {
    code: 'ALREADY_EXISTS',
    noteId: holder.value,
    name,
  });
}

/**
 * Whether this folder already holds this name in another live note. It is
 * read BEFORE anything is written, so a refused write leaves nothing in the
 * store; the guard of the transaction is what settles a race the read lost.
 */
async function nameHeldElsewhere(
  deps: NoteDependencies,
  notebookId: NotebookId,
  folderId: FolderId,
  name: string | null,
  self: NoteId | null,
): Promise<DomainError | null> {
  if (name === null) return null; // A note with no name reserves nothing.
  const holder = await deps.notes.findByName(notebookId, folderId, name);
  if (!holder || (self && holder.equals(self))) return null;
  return nameTakenBy(holder, name);
}

/**
 * A save refused on the guard: the race the read above lost. The answer is the
 * same refusal, naming whoever won it.
 */
async function refusalOfSave(
  deps: NoteDependencies,
  error: DomainError,
  notebookId: NotebookId,
  folderId: FolderId,
  name: string | null,
): Promise<DomainError> {
  if (!isNameTaken(error) || name === null) return error;
  const holder = await deps.notes.findByName(notebookId, folderId, name);
  return holder ? nameTakenBy(holder, name) : error;
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

    if (input.folderId) {
      if (!notebook.value.folders.has(input.folderId)) {
        return err(DomainError.notFound('Folder not found in this notebook'));
      }
      return ok(await this.deps.notes.listByFolder(input.notebookId, input.folderId));
    }
    // The notes of a notebook are the notes of its TREE: a note whose folder
    // was removed is invalid and out of every listing, although its item is
    // still there waiting for the purge (RN-KNW-046).
    //
    // And in the defined order within each folder (PP9), as the listing of one
    // folder always was. The repository answers in key order, which is the
    // order of creation, so a note the agent moved to the top with
    // `reorder_note` stayed where it was born in every screen that reads the
    // whole notebook (#184). `Position.compare` is by code unit, which is what
    // puts `Zz` — the key of a note moved first — before `a0`.
    const notes = await this.deps.notes.listByNotebook(input.notebookId);
    return ok(
      notes
        .filter((note) => notebook.value.folders.has(note.folderId))
        .sort(
          (left, right) =>
            left.position.compare(right.position) || left.id.value.localeCompare(right.id.value),
        ),
    );
  }
}

export class ReadNote {
  constructor(private readonly deps: NoteDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    noteId: NoteId;
  }): Promise<Result<{ note: Note; content: string; folderTrail: string[] }, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    const note = await liveNote(this.deps, notebook.value, input.notebookId, input.noteId);
    if (!note.ok) return note;

    return ok({
      note: note.value,
      content: await this.deps.content.read(note.value.bodyRef),
      // The tree was already loaded to authorize, so where the note lives
      // costs no read (RN-AGT-033).
      folderTrail: notebook.value.folders
        .trailOf(note.value.folderId)
        .map((folder) => folder.name.value),
    });
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
    // There is no ceiling of notes (RN-KNW-010): what bounds the content of a
    // notebook is the storage quota of its subscription, checked below.
    // One live note of each name in a folder (RN-KNW-042). A create retried
    // after its answer was lost is refused here naming the note it already
    // made, which is how one note stays one note (RN-AGT-024).
    const name = noteName(input.content);
    const taken = await nameHeldElsewhere(this.deps, input.notebookId, input.folderId, name, null);
    if (taken) return err(taken);

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
    if (saved.ok) return ok(note.value);
    return err(
      await refusalOfSave(
        this.deps,
        saved.error,
        input.notebookId,
        input.folderId,
        note.value.name,
      ),
    );
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
    /** What the author said about this change, or nothing (RN-AUD-012). */
    message?: string | null;
    by: Authorship;
  }): Promise<Result<Note, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;
    if (Buffer.byteLength(input.content, 'utf8') > NOTEBOOK_LIMITS.maxNoteBytes) {
      return err(DomainError.limitExceeded('A note holds at most 1 MB of content'));
    }

    return withRetry(async () => {
      const found = await liveNote(this.deps, notebook.value, input.notebookId, input.noteId);
      if (!found.ok) return found;
      const note = found.value;

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

      // Renaming is editing `name:`, and the new name is refused when another
      // note of this folder already carries it (RN-KNW-038, RN-KNW-042).
      const renamedTo = noteName(input.content);
      if (renamedTo !== note.name) {
        const taken = await nameHeldElsewhere(
          this.deps,
          input.notebookId,
          note.folderId,
          renamedTo,
          note.id,
        );
        if (taken) return err(taken);
      }

      // Only the difference between the revision that is live and the one
      // being written: an edit that shortens a note never costs anything.
      const admitted = admitWrite(
        await this.deps.storage.current(),
        Buffer.byteLength(input.content, 'utf8') - note.bodyRef.bytes,
      );
      if (!admitted.ok) return admitted;

      const ref = await this.deps.content.overwrite(note.bodyRef.contentId, input.content);
      const replaced = note.replaceBody(ref, input.content, input.by, input.message ?? null);
      if (!replaced.ok) return replaced;
      if (!note.hasChanges) return ok(note); // identical bytes (RN-KNW-028)

      const saved = await this.deps.notes.save(note);
      if (saved.ok) return ok(note);
      return err(
        await refusalOfSave(this.deps, saved.error, input.notebookId, note.folderId, note.name),
      );
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

    const found = await liveNote(this.deps, notebook.value, input.notebookId, input.noteId);
    if (!found.ok) return found;
    const note = found.value;

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

    const found = await liveNote(this.deps, origin.value, input.notebookId, input.noteId);
    if (!found.ok) return found;
    const note = found.value;

    // A folder that already holds this name does not take a second note of it
    // (RN-KNW-042), and the move changes nothing.
    const taken = await nameHeldElsewhere(
      this.deps,
      destinationNotebookId,
      input.toFolderId,
      note.name,
      note.id,
    );
    if (taken) return err(taken);

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
    if (saved.ok) return ok(note);
    return err(
      await refusalOfSave(
        this.deps,
        saved.error,
        destinationNotebookId,
        input.toFolderId,
        note.name,
      ),
    );
  }
}

/**
 * Deleting a note is definitive: it leaves every listing and the search at
 * once, and what it leaves behind is purged in the background (RN-KNW-029,
 * RN-KNW-047). There is no way back.
 */
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

    const found = await liveNote(this.deps, notebook.value, input.notebookId, input.noteId);
    if (!found.ok) return found;
    const note = found.value;

    const deleted = note.delete(input.by);
    if (!deleted.ok) return deleted;

    const saved = await this.deps.notes.save(note);
    return saved.ok ? ok() : err(saved.error);
  }
}
