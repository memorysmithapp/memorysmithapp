import type { TFunction } from 'i18next';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import type { FolderNode, NotebookStructure } from '../../shared/types/api';

/**
 * Renaming a folder and changing its description (#278, RN-KNW-058): the
 * limits the dialog says before they are hit, the tree the moment the write
 * is done, and what a refusal says. Kept apart from the dialog so each is read
 * without a browser.
 */

/** The limits of the API, said by the dialog before a write is refused. */
export const FOLDER_NAME_MAX = 120;
export const FOLDER_DESCRIPTION_MAX = 500;

/** What changed, and nothing else: an unchanged field is not written. */
export function folderChange(
  folder: { name: string; description: string },
  name: string,
  description: string,
): { name?: string; description?: string } {
  const nextName = name.trim();
  const nextDescription = description.trim();
  return {
    ...(nextName !== folder.name ? { name: nextName } : {}),
    ...(nextDescription !== folder.description ? { description: nextDescription } : {}),
  };
}

/**
 * The structure as the write left it, so the tree, the trail and this page
 * show the new name at once; the next read of the structure replaces it.
 */
export function folderChanged(
  structure: NotebookStructure,
  folderId: string,
  change: { name?: string; description?: string },
): NotebookStructure {
  const walk = (folders: FolderNode[]): FolderNode[] =>
    folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, ...change, children: walk(folder.children) }
        : { ...folder, children: walk(folder.children) },
    );
  return { ...structure, folders: walk(structure.folders) };
}

/** A name a sibling holds is said in place; anything else as the API said it. */
export function folderRefusal(error: unknown, t: TFunction, name: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT') return t('folderEdit.nameTaken', { name });
    if (error.status === 403) return error.message;
  }
  return t(messageKeyOf(error));
}
