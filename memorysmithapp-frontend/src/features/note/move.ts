import { compareByName } from '@memorysmithapp/contracts';
import type { TFunction } from 'i18next';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import type { FolderNode, NoteSummary, NotebookStructure } from '../../shared/types/api';

/**
 * Moving a note to another folder of its notebook (#265, RN-KNW-057): what
 * the dialog offers, what the tree shows the moment it is done, and what a
 * refusal says. Kept apart from the dialog so each is read without a browser.
 */

/** A folder the note may go to, named by the whole trail so two of one name are told apart. */
export interface FolderChoice {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  readonly noteOrder: FolderNode['noteOrder'];
  readonly notes: readonly NoteSummary[];
}

/** Every folder of the notebook, in the order the tree draws them. */
export function folderChoices(folders: readonly FolderNode[]): FolderChoice[] {
  const choices: FolderChoice[] = [];
  const walk = (level: readonly FolderNode[], trail: string[]) => {
    for (const folder of level) {
      const path = [...trail, folder.name];
      choices.push({
        id: folder.id,
        label: path.join(' / '),
        depth: trail.length,
        noteOrder: folder.noteOrder,
        notes: folder.notes,
      });
      walk(folder.children, path);
    }
  };
  walk(folders, []);
  return choices;
}

/**
 * The structure as the move left it, so the tree, the trail and the folder
 * pages show the note where it went at once: the listing they are drawn from
 * is an index that catches up a moment after the write, and the next read of
 * it replaces this one.
 */
export function movedInto(
  structure: NotebookStructure,
  noteId: string,
  toFolderId: string,
  afterNoteId: string | null,
): NotebookStructure {
  let moving: NoteSummary | null = null;
  const take = (folders: FolderNode[]): FolderNode[] =>
    folders.map((folder) => {
      const kept = folder.notes.filter((note) => {
        if (note.id !== noteId) return true;
        moving = note;
        return false;
      });
      return {
        ...folder,
        notes: kept,
        noteCount: kept.length < folder.notes.length ? folder.noteCount - 1 : folder.noteCount,
        children: take(folder.children),
      };
    });
  const without = take(structure.folders);
  const found = moving as NoteSummary | null;
  if (!found) return structure;
  const note: NoteSummary = { ...found, folderId: toFolderId };

  const place = (folders: FolderNode[]): FolderNode[] =>
    folders.map((folder) => {
      if (folder.id !== toFolderId) return { ...folder, children: place(folder.children) };
      const notes = [...folder.notes];
      if (folder.noteOrder === 'alphabetical') {
        notes.push(note);
        notes.sort((left, right) =>
          compareByName(
            { name: left.name, noteId: left.id },
            { name: right.name, noteId: right.id },
          ),
        );
      } else {
        const anchor = afterNoteId ? notes.findIndex((each) => each.id === afterNoteId) : -1;
        notes.splice(anchor >= 0 ? anchor + 1 : notes.length, 0, note);
      }
      return { ...folder, notes, noteCount: folder.noteCount + 1, children: folder.children };
    });
  return { ...structure, folders: place(without) };
}

/**
 * What a refused move says, in the dialog that asked for it. A folder that
 * holds the name names the note there (RN-KNW-042); a refusal of a notebook
 * the person reads and may not write says whose it is, as every write does.
 */
export function moveRefusal(
  error: unknown,
  t: TFunction,
  destination: string,
): { message: string; holder: string | null } {
  if (error instanceof ApiError) {
    const details = error.details as { code?: string; noteId?: string; name?: string } | undefined;
    if (error.code === 'CONFLICT' && details?.code === 'ALREADY_EXISTS') {
      return {
        message: t('move.nameTaken', { folder: destination, name: details.name ?? '' }),
        holder: details.noteId ?? null,
      };
    }
    if (error.status === 403) return { message: error.message, holder: null };
  }
  return { message: t(messageKeyOf(error)), holder: null };
}
