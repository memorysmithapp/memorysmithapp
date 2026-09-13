/**
 * Test fixtures for the Knowledge domain. Pure construction, no I/O and no
 * framework mock: if the domain needed an SDK mock to be tested, the hexagon
 * would have leaked (architecture-guide.md, section 19).
 */

import {
  Authorship,
  ContentId,
  ContentRef,
  FolderId,
  Instant,
  NoteId,
  Position,
  Slug,
  SubscriptionId,
  UserId,
  NotebookId,
  type Result,
} from '@memorysmith/kernel';
import { Notebook } from '../src/domain/notebook/Notebook.js';
import { Folder } from '../src/domain/notebook/Folder.js';
import { Note } from '../src/domain/note/Note.js';
import { FolderDescription, FolderName, ShortText, NotebookName } from '../src/domain/values.js';
import { NotePlacement, type NoteOrder } from '../src/domain/services/NotePlacement.js';

export function unwrap<T>(result: Result<T, { message: string }>): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error.message}`);
  return result.value;
}

export function expectErr<T, E>(result: Result<T, E>): E {
  if (result.ok) throw new Error('Expected an error, got ok');
  return result.error;
}

export const user = unwrap(UserId.create('user-owner'));
export const otherUser = unwrap(UserId.create('user-member'));

export function authorship(at = Instant.now()): Authorship {
  return Authorship.byHuman(user, at);
}

export function contentRef(sha = 'a'.repeat(64), bytes = 42): ContentRef {
  return unwrap(
    ContentRef.create({
      contentId: ContentId.generate(),
      versionId: `v-${sha.slice(0, 6)}`,
      sha256: sha,
      bytes,
    }),
  );
}

export function notebookName(value: string): NotebookName {
  return unwrap(NotebookName.create(value));
}

export function folderName(value: string): FolderName {
  return unwrap(FolderName.create(value));
}

export function folderDescription(value: string): FolderDescription {
  return unwrap(FolderDescription.create(value));
}

/**
 * A note whose content states its name, which is the only place a name comes
 * from now (RN-KNW-035). The fixtures take a name and write the note that
 * says it, so a test that cares about a name still reads as one.
 */
export function noteBody(name: string): string {
  return `---\nname: ${name}\n---\n\nThe general rule.\n`;
}

export function newNotebook(name = 'Normas e Legislacao'): Notebook {
  return unwrap(
    Notebook.create({
      id: NotebookId.generate(),
      subscriptionId: SubscriptionId.generate(),
      name: notebookName(name),
      description: unwrap(ShortText.create('Texto normativo por artigo')),
      by: authorship(),
    }),
  );
}

/** A notebook with a small tree, enough to exercise ordering and depth. */
export function notebookWithTree(): {
  notebook: Notebook;
  normas: ReturnType<Notebook['addFolder']>;
} {
  const notebook = newNotebook();
  const normas = notebook.addFolder(
    null,
    folderName('Normas'),
    folderDescription('Texto normativo por artigo. Uma norma por nota.'),
    null,
    authorship(),
  );
  notebook.addFolder(
    null,
    folderName('Achados'),
    folderDescription('Achados de auditoria.'),
    unwrap(normas).id,
    authorship(),
  );
  notebook.pullEvents();
  return { notebook, normas };
}

export function newNote(
  notebook: Notebook,
  folderId: FolderId,
  name = 'Lei 14.133',
  siblings: NoteOrder[] = [],
): Note {
  return unwrap(
    Note.create({
      id: NoteId.generate(),
      subscriptionId: notebook.subscriptionId,
      notebookId: notebook.id,
      folderId,
      body: noteBody(name),
      position: NotePlacement.append(siblings),
      bodyRef: contentRef(),
      by: authorship(),
    }),
  );
}

/**
 * A notebook as it comes back from storage, with the folder note counters that
 * travel in the same Query (architecture-guide.md, section 9.3).
 */
export function rehydratedNotebookWithNotes(notes: number): {
  notebook: Notebook;
  folderId: FolderId;
} {
  const folderId = FolderId.generate();
  const folder = Folder.rehydrate({
    id: folderId,
    parentFolderId: null,
    name: folderName('Normas'),
    slug: unwrap(Slug.from('Normas')),
    description: folderDescription('Texto normativo por artigo.'),
    position: Position.first(),
    templateRef: null,
    createdBy: authorship(),
    updatedAt: Instant.now(),
  });
  const notebook = Notebook.rehydrate({
    id: NotebookId.generate(),
    subscriptionId: SubscriptionId.generate(),
    name: notebookName('Normas e Legislacao'),
    slug: unwrap(Slug.from('Normas e Legislacao')),
    description: unwrap(ShortText.create('')),
    guidanceRef: null,
    folders: [folder],
    limits: new Map(),
    noteCounts: new Map([[folderId.value, notes]]),
    notebookNoteCount: notes,
    version: 7,
    createdBy: authorship(),
    updatedAt: Instant.now(),
    deletedAt: null,
  });
  return { notebook, folderId };
}
