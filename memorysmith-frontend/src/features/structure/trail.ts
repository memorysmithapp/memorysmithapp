import type { FolderNode } from '../../shared/types/api';

/**
 * The chain of folders from the notebook root down to the folder of that
 * identifier, or [] when it is not in the tree. The breadcrumb is built from
 * it: the trail of a folder is what a person reads, and the address never
 * carries it (RN-DSC-045).
 */
export function folderTrailOf(folders: FolderNode[], folderId: string): FolderNode[] {
  for (const folder of folders) {
    if (folder.id === folderId) return [folder];
    const nested = folderTrailOf(folder.children, folderId);
    if (nested.length) return [folder, ...nested];
  }
  return [];
}

// Folder chain from the notebook root down to the folder holding the note, or []
// when the note is not in the tree.
export function folderTrailForNote(folders: FolderNode[], noteId: string): FolderNode[] {
  for (const folder of folders) {
    if (folder.notes.some((note) => note.id === noteId)) return [folder];
    const nested = folderTrailForNote(folder.children, noteId);
    if (nested.length) return [folder, ...nested];
  }
  return [];
}
