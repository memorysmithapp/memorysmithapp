import type { FolderNode } from '../../shared/types/api';

// Folder chain from the vault root down to the folder at slugPath, or [] when
// no folder matches.
export function folderTrail(folders: FolderNode[], slugPath: string): FolderNode[] {
  for (const folder of folders) {
    if (folder.slugPath === slugPath) return [folder];
    const nested = folderTrail(folder.children, slugPath);
    if (nested.length) return [folder, ...nested];
  }
  return [];
}

// Folder chain from the vault root down to the folder holding the note with
// noteSlug, or [] when the note is not in the tree.
export function folderTrailForNote(folders: FolderNode[], noteSlug: string): FolderNode[] {
  for (const folder of folders) {
    if (folder.notes.some((note) => note.slug === noteSlug)) return [folder];
    const nested = folderTrailForNote(folder.children, noteSlug);
    if (nested.length) return [folder, ...nested];
  }
  return [];
}
