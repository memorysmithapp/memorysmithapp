/**
 * A notebook as its tree on disk describes it: the Guidance, the folders with
 * their descriptions and Templates, and the notes, in order.
 *
 * THE STRUCTURE OF A NOTEBOOK COMES FROM ITS STRUCTURE.md, NOT FROM THE
 * DIRECTORIES. The description of a folder is an attribute of the folder and
 * never a document, so the tree writes every description once, at the notebook
 * root, and nothing inside the folder carries it. A folder holding no template
 * and no note leaves no directory behind at all, and only that document
 * remembers it.
 *
 * One line per folder, numbered, which is what makes it readable without an
 * index: `2.1.` is the folder numbered 1 inside the folder numbered 2, and those
 * numbers are the numeric prefixes the directories carry.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** A description is mandatory and capped at 500 characters (RN-KNW-006). */
const DESCRIPTION_LIMIT = 500;

/** The files of a tree that are not notes. */
const RESERVED = new Set(['GUIDANCE.md', 'STRUCTURE.md', 'TEMPLATE.md']);

export interface TreeNote {
  readonly file: string;
  readonly content: string;
}

export interface TreeFolder {
  readonly title: string;
  readonly description: string;
  readonly template: string | null;
  readonly notes: readonly TreeNote[];
  readonly children: readonly TreeFolder[];
}

export interface NotebookTree {
  readonly name: string;
  readonly guidance: string;
  readonly folders: readonly TreeFolder[];
  /** Notes at the root of the tree, which no folder holds and nothing can write. */
  readonly orphanNotes: number;
}

const LINE = /^\s*([\d.]+)\.\s+\*\*(.+?)\/?\*\*:\s*(.*?)\s*(?:\(\d+\s+notes?[^()]*\))?\s*$/;

const text = (path: string): string => readFileSync(path, 'utf8');

/** A longer description is cut rather than refused, and a missing one still gets a sentence. */
export function boundedDescription(raw: string, title: string): string {
  const value = raw.trim() || `Notas de ${title}.`;
  return value.length > DESCRIPTION_LIMIT ? `${value.slice(0, DESCRIPTION_LIMIT - 3)}...` : value;
}

function notesOf(directory: string | null): TreeNote[] {
  if (!directory) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !RESERVED.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map((file) => ({ file, content: text(join(directory, file)) }));
}

function childDirectory(parent: string | null, position: number): string | null {
  if (!parent || !existsSync(parent)) return null;
  const match = readdirSync(parent, { withFileTypes: true }).find((entry) => {
    const prefix = /^(\d+)\s/.exec(entry.name);
    return entry.isDirectory() && prefix !== null && Number(prefix[1]) === position;
  });
  return match ? join(parent, match.name) : null;
}

interface MutableFolder {
  title: string;
  description: string;
  template: string | null;
  notes: TreeNote[];
  children: MutableFolder[];
}

/** Reads the tree of one notebook, or throws when there is none. */
export function readNotebookTree(root: string, slug: string): NotebookTree {
  if (!existsSync(join(root, 'STRUCTURE.md'))) {
    throw new Error(`There is no notebook tree at ${root}.`);
  }
  const guidancePath = join(root, 'GUIDANCE.md');
  const guidance = existsSync(guidancePath) ? text(guidancePath) : '';
  // The name is the first heading of the Guidance, which is where the tree
  // writes it; the slug when there is none.
  const heading = /^#\s+(.+?)\s*$/m.exec(guidance);

  const roots: MutableFolder[] = [];
  const byNumbering = new Map<string, MutableFolder>();
  const directories = new Map<string, string | null>([['', root]]);

  for (const line of text(join(root, 'STRUCTURE.md')).split(/\r?\n/)) {
    const found = LINE.exec(line);
    if (!found) continue;
    const [, numbering = '', title = '', description = ''] = found;
    const parts = numbering.split('.');
    const parentKey = parts.slice(0, -1).join('.');
    if (!directories.has(parentKey)) continue;

    const directory = childDirectory(directories.get(parentKey) ?? null, Number(parts.at(-1)));
    const templatePath = directory ? join(directory, 'TEMPLATE.md') : null;
    const folder: MutableFolder = {
      title,
      description: boundedDescription(description, title),
      template: templatePath && existsSync(templatePath) ? text(templatePath) : null,
      notes: notesOf(directory),
      children: [],
    };
    byNumbering.set(numbering, folder);
    directories.set(numbering, directory);
    if (parentKey === '') roots.push(folder);
    else byNumbering.get(parentKey)?.children.push(folder);
  }

  return {
    name: heading?.[1] ?? slug,
    guidance,
    folders: roots,
    orphanNotes: notesOf(root).length,
  };
}
