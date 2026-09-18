import type { ImportSelection, NotebookDocument } from '@memorysmith/contracts';

/**
 * The tree of a `.notebook` document, and what a selection of it means
 * (RN-PRT-017).
 *
 * Everything here is a pure function over the document the browser read, which
 * is what makes it testable without a browser: the page draws what these
 * answer and sends what `selectionOf` builds.
 */

export interface TreeNote {
  readonly kind: 'note';
  readonly id: string;
  readonly name: string;
}

export interface TreeTemplate {
  readonly kind: 'template';
  /** A Template belongs to its folder, so it is addressed by the folder. */
  readonly id: string;
  readonly name: string;
}

export interface TreeFolder {
  readonly kind: 'folder';
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly children: TreeFolder[];
  readonly template: TreeTemplate | null;
  readonly notes: TreeNote[];
  /** Notes of this folder and of every folder under it. */
  readonly noteCount: number;
}

export interface DocumentTree {
  readonly guidance: boolean;
  readonly folders: TreeFolder[];
  readonly noteCount: number;
  /** How many entries of the trail the archive carries, if it carries any. */
  readonly historyEntries: number;
}

/** Every identifier a selection can carry, which is what the presets fill. */
export interface Chosen {
  readonly guidance: boolean;
  /** The history the archive carries, when it carries one (RN-PRT-023). */
  readonly history: boolean;
  readonly folders: ReadonlySet<string>;
  readonly templates: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;
}

export type NodeState = 'on' | 'off' | 'mixed';

/**
 * What a note is called, read from the `name:` of its frontmatter and from
 * nothing else — the same rule every surface of the product reads it by
 * (RN-KNW-035). A note with no name is shown as such rather than as a blank
 * line.
 */
export function nameOf(body: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(body);
  if (!match?.[1]) return null;
  for (const line of match[1].split(/\r?\n/)) {
    const key = /^name:\s*(.*)$/.exec(line);
    if (!key) continue;
    const value = (key[1] ?? '').trim().replace(/^["']|["']$/g, '');
    return value.length > 0 ? value : null;
  }
  return null;
}

/** The folders of a document as a tree, each carrying its notes and its count. */
export function treeOf(document: NotebookDocument): DocumentTree {
  const notesOf = new Map<string, TreeNote[]>();
  for (const note of [...document.notes].sort((a, b) => (a.position < b.position ? -1 : 1))) {
    const held = notesOf.get(note.folderId) ?? [];
    held.push({ kind: 'note', id: note.noteId, name: nameOf(note.body) ?? '' });
    notesOf.set(note.folderId, held);
  }

  const childrenOf = new Map<string | null, NotebookDocument['folders']>();
  for (const folder of [...document.folders].sort((a, b) => (a.position < b.position ? -1 : 1))) {
    childrenOf.set(folder.parentFolderId, [
      ...(childrenOf.get(folder.parentFolderId) ?? []),
      folder,
    ]);
  }

  const build = (parentFolderId: string | null): TreeFolder[] =>
    (childrenOf.get(parentFolderId) ?? []).map((folder) => {
      const children = build(folder.folderId);
      const notes = notesOf.get(folder.folderId) ?? [];
      return {
        kind: 'folder',
        id: folder.folderId,
        name: folder.name,
        description: folder.description,
        children,
        template:
          folder.template === null
            ? null
            : { kind: 'template', id: folder.folderId, name: folder.name },
        notes,
        // The count of a collapsed branch says what it carries, so a folder
        // that keeps its notes in subfolders never reads as empty.
        noteCount: notes.length + children.reduce((total, child) => total + child.noteCount, 0),
      };
    });

  return {
    guidance: document.notebook.guidance !== null,
    folders: build(null),
    noteCount: document.notes.length,
    historyEntries: document.history?.entries.length ?? 0,
  };
}

/** Everything: the whole document, which is what almost everyone wants. */
export function everything(tree: DocumentTree): Chosen {
  const folders = new Set<string>();
  const templates = new Set<string>();
  const notes = new Set<string>();
  const walk = (list: TreeFolder[]): void => {
    for (const folder of list) {
      folders.add(folder.id);
      if (folder.template) templates.add(folder.id);
      for (const note of folder.notes) notes.add(note.id);
      walk(folder.children);
    }
  };
  walk(tree.folders);
  return {
    guidance: tree.guidance,
    history: tree.historyEntries > 0,
    folders,
    templates,
    notes,
  };
}

export const nothing: Chosen = {
  guidance: false,
  history: false,
  folders: new Set<string>(),
  templates: new Set<string>(),
  notes: new Set<string>(),
};

/** Every identifier of a branch: the folder, what it holds and what is under it. */
export function branchOf(folder: TreeFolder): Chosen {
  const folders = new Set<string>([folder.id]);
  const templates = new Set<string>(folder.template ? [folder.id] : []);
  const notes = new Set<string>(folder.notes.map((note) => note.id));
  for (const child of folder.children) {
    const under = branchOf(child);
    for (const id of under.folders) folders.add(id);
    for (const id of under.templates) templates.add(id);
    for (const id of under.notes) notes.add(id);
  }
  return { guidance: false, history: false, folders, templates, notes };
}

/** Adds or removes a whole branch, which is what a checkbox of a tree does. */
export function withBranch(chosen: Chosen, folder: TreeFolder, on: boolean): Chosen {
  const branch = branchOf(folder);
  const folders = new Set(chosen.folders);
  const templates = new Set(chosen.templates);
  const notes = new Set(chosen.notes);
  const apply = (set: Set<string>, ids: Iterable<string>): void => {
    for (const id of ids) {
      if (on) set.add(id);
      else set.delete(id);
    }
  };
  apply(folders, branch.folders);
  apply(templates, branch.templates);
  apply(notes, branch.notes);
  return { ...chosen, folders, templates, notes };
}

/** Adds or removes one node alone, which is the `⋯` of a row. */
export function withNode(
  chosen: Chosen,
  node: { kind: 'folder' | 'template' | 'note'; id: string },
  on: boolean,
): Chosen {
  const next = {
    guidance: chosen.guidance,
    history: chosen.history,
    folders: new Set(chosen.folders),
    templates: new Set(chosen.templates),
    notes: new Set(chosen.notes),
  };
  const set =
    node.kind === 'folder' ? next.folders : node.kind === 'template' ? next.templates : next.notes;
  if (on) set.add(node.id);
  else set.delete(node.id);
  return next;
}

/** Selected, not selected, or mixed — which is what a folder usually is. */
export function stateOf(chosen: Chosen, folder: TreeFolder): NodeState {
  const branch = branchOf(folder);
  const ids = [
    ...[...branch.folders].map((id) => chosen.folders.has(id)),
    ...[...branch.templates].map((id) => chosen.templates.has(id)),
    ...[...branch.notes].map((id) => chosen.notes.has(id)),
  ];
  if (ids.every((on) => on)) return 'on';
  if (ids.every((on) => !on)) return 'off';
  return 'mixed';
}

/** What will be created, which is what the summary states. */
export function countsOf(
  tree: DocumentTree,
  chosen: Chosen,
): { folders: number; templates: number; notes: number; guidance: boolean } {
  // A folder not selected but holding something selected is written as a path,
  // so it counts among what will be created (RN-PRT-017).
  const written = new Set(chosen.folders);
  const parentOf = new Map<string, string | null>();
  const walk = (list: TreeFolder[], parent: string | null): void => {
    for (const folder of list) {
      parentOf.set(folder.id, parent);
      walk(folder.children, folder.id);
    }
  };
  walk(tree.folders, null);

  const notesFolder = new Map<string, string>();
  const index = (list: TreeFolder[]): void => {
    for (const folder of list) {
      for (const note of folder.notes) notesFolder.set(note.id, folder.id);
      index(folder.children);
    }
  };
  index(tree.folders);

  for (const noteId of chosen.notes) {
    let at = notesFolder.get(noteId) ?? null;
    while (at !== null && !written.has(at)) {
      written.add(at);
      at = parentOf.get(at) ?? null;
    }
  }
  for (const folderId of [...chosen.folders]) {
    let at = parentOf.get(folderId) ?? null;
    while (at !== null && !written.has(at)) {
      written.add(at);
      at = parentOf.get(at) ?? null;
    }
  }

  return {
    folders: written.size,
    templates: [...chosen.templates].filter((id) => written.has(id)).length,
    notes: chosen.notes.size,
    guidance: tree.guidance && chosen.guidance,
  };
}

/**
 * The links a selection leaves pointing at notes left out. A pending link is
 * not an error — it resolves the day somebody writes the note — but importing
 * half a notebook and being surprised by it is avoidable, so it is said.
 */
export function danglingLinks(document: NotebookDocument, chosen: Chosen): number {
  const names = new Set<string>();
  for (const note of document.notes) {
    if (!chosen.notes.has(note.noteId)) continue;
    const name = nameOf(note.body);
    if (name !== null) names.add(name);
  }

  let dangling = 0;
  for (const note of document.notes) {
    if (!chosen.notes.has(note.noteId)) continue;
    for (const target of targetsOf(note.body)) {
      if (!names.has(target)) dangling += 1;
    }
  }
  return dangling;
}

/**
 * The wikilink targets of a body, literally as written: no decoding, nothing
 * folded (RN-DSC-043). It is a count for a summary and not the resolver, and
 * it says so — the graph is built by Discovery, out of what was written.
 */
function targetsOf(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)) {
    const target = (match[1] ?? '').trim();
    if (target.length > 0) targets.push(target.normalize('NFC'));
  }
  return targets;
}

/**
 * Two notes of one name in one folder, among the SELECTED ones. Both selected
 * is a refusal (RN-KNW-042), and it is resolved by leaving one out rather than
 * by editing the file.
 */
export function twinNames(
  document: NotebookDocument,
  chosen: Chosen,
): Array<{ folderId: string; name: string }> {
  const seen = new Map<string, number>();
  for (const note of document.notes) {
    if (!chosen.notes.has(note.noteId)) continue;
    const name = nameOf(note.body);
    if (name === null) continue;
    const key = `${note.folderId} ${name}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([key]) => {
      const [folderId = '', name = ''] = key.split(' ');
      return { folderId, name };
    });
}

/** What travels to the server: the identifiers the document carries. */
export function selectionOf(chosen: Chosen): ImportSelection {
  return {
    guidance: chosen.guidance,
    history: chosen.history,
    folders: [...chosen.folders],
    templates: [...chosen.templates],
    notes: [...chosen.notes],
  };
}
