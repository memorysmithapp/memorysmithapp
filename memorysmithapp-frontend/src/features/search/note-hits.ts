// The notes of a notebook a search answers (#418): what turns a hit into a
// name, a path and a link, and its excerpt into one line of prose.
//
// What is typed goes to the source untouched: the whole query language lives
// in the backend (RN-DSC-026), and a box that pre-filtered here would either
// duplicate that grammar or quietly break it.

import type { FolderNode } from '../../shared/types/api';
import { noteAddress } from '../../shared/api/note-address';

export interface FlatNote {
  id: string;
  /** Where the note lives, built from its identifier (RN-DSC-045). */
  address: string;
  name: string | null;
  folderPath: string;
}

export function flatten(
  notebookId: string,
  folders: FolderNode[],
  trail: string[] = [],
): FlatNote[] {
  return folders.flatMap((folder) => {
    const path = [...trail, folder.name];
    return [
      ...folder.notes.map((note) => ({
        id: note.id,
        address: noteAddress(notebookId, note.id),
        name: note.name,
        folderPath: path.join(' / '),
      })),
      ...flatten(notebookId, folder.children, path),
    ];
  });
}

/**
 * The excerpt arrives as the note was written, which means Markdown: a heading
 * marker, a list bullet, a callout, a table row. Shown as one line of prose,
 * that punctuation reads as noise, so it comes off. Nothing is added and no
 * word is changed: the reader has to recognise the sentence when they open the
 * note.
 */
export function readable(excerpt: string): string {
  return excerpt
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*>\s*(?:\[![a-z]+\]\s*)?/i, '')
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*+]\s+/, '')
        // A table separator carries no words at all.
        .replace(/^\s*\|?[\s|:-]*\|[\s|:-]*$/, '')
        .replace(/\|/g, ' '),
    )
    .join(' ')
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_all, target: string, label?: string) => label ?? target,
    )
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
