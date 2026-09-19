import type { NotebookDocument, TransferSelection } from '@memorysmith/contracts';

/**
 * The tree of a `.notebook` document, and what a selection of it means
 * (RN-PRT-017).
 *
 * Everything here is a pure function over the document the browser read, which
 * is what makes it testable without a browser: the page draws what these
 * answer and sends what `selectionOf` builds.
 *
 * **A selection is asked as a scope first and as items second (#161).** It used
 * to be asked item by item, in one tree that mixed five different kinds of
 * thing, so the first question anybody actually has — *what am I bringing, the
 * design of the notebook or the notebook* — had nowhere to be answered. It is
 * two values now: a `Scope`, which says which species travel and whether each
 * one travels whole, and a `Picked`, which holds what was ticked in the tab of
 * each species. What goes on the wire is neither of them: it is the `Chosen`
 * that `effectiveOf` computes out of both, which is where the dependency
 * between the species is enforced once instead of in three components.
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
  /**
   * How many entries of the trail there are: a number when the tree was read
   * from an archive, which carries them, and `null` when it was read from the
   * API, where the notebook HAS a history and nobody counted it for a dialog
   * (#156). Zero means there is none to choose.
   */
  readonly historyEntries: number | null;
}

/** Every identifier a selection can carry, which is what travels. */
export interface Chosen {
  readonly guidance: boolean;
  /** The history the archive carries, when it carries one (RN-PRT-023). */
  readonly history: boolean;
  readonly folders: ReadonlySet<string>;
  readonly templates: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;
}

export type NodeState = 'on' | 'off' | 'mixed';

/** The three species that have a hierarchy, and therefore a tab of their own. */
export type Species = 'folders' | 'templates' | 'notes';

/** How much of a species travels: all of it, or the items somebody picked. */
export type Reach = 'all' | 'choose';

/**
 * The scope of a transfer: which species travel, and how much of each (#161).
 *
 * The five are not five of a kind. The Guidance and the history are a yes or a
 * no, because there is nothing under them to walk. The other three have a
 * hierarchy, so each one answers twice: whether it travels at all, and whether
 * it travels whole or item by item.
 */
export interface Scope {
  readonly guidance: boolean;
  readonly history: boolean;
  readonly folders: boolean;
  readonly templates: boolean;
  readonly notes: boolean;
  readonly reach: {
    readonly folders: Reach;
    readonly templates: Reach;
    readonly notes: Reach;
  };
}

/** Every species, whole: where the chooser opens. */
export const wholeScope: Scope = {
  guidance: true,
  history: true,
  folders: true,
  templates: true,
  notes: true,
  reach: { folders: 'all', templates: 'all', notes: 'all' },
};

/**
 * What was ticked in the tab of each species — **what somebody asked for**, and
 * not what will travel. A folder unticked later takes its notes out of the
 * transfer, and `effectiveOf` is what says so; leaving them ticked here means
 * that ticking the folder back brings them back rather than silently losing
 * what the person had already chosen note by note.
 */
export interface Picked {
  readonly folders: ReadonlySet<string>;
  readonly templates: ReadonlySet<string>;
  readonly notes: ReadonlySet<string>;
}

export const pickedNothing: Picked = {
  folders: new Set<string>(),
  templates: new Set<string>(),
  notes: new Set<string>(),
};

/**
 * A folder as one of the three tabs offers it.
 *
 * `offered` is the whole point: a folder that was not chosen but holds one that
 * was still has to be DRAWN, or its children would hang off nothing — and it
 * must not be choosable, because it is travelling as a path and a path carries
 * its name and its description and nothing else of its own (RN-PRT-017). So it
 * is a row with no box, and its Template and its notes are not offered on it.
 */
export interface OfferableFolder {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly template: TreeTemplate | null;
  readonly notes: ReadonlyArray<TreeNote>;
  readonly children: ReadonlyArray<OfferableFolder>;
  readonly noteCount: number;
  readonly offered: boolean;
}

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

/**
 * The same tree, read from the API instead of from an archive (#156).
 *
 * An import reads its document in the browser before a byte is uploaded, so
 * its tree is free. An export has no document yet — the notebook is on the
 * server — and what it chooses from is the structure the interface already
 * loads for every page of a notebook: the folders with their descriptions and
 * their counts, whether each has a Template, whether the notebook has a
 * Guidance, and the notes in each folder.
 *
 * One shape, so one chooser draws both.
 */
export function treeOfNotebook(structure: {
  guidance: string | null;
  folders: ReadonlyArray<NotebookFolder>;
}): DocumentTree {
  const build = (folders: ReadonlyArray<NotebookFolder>): TreeFolder[] =>
    folders.map((folder) => ({
      kind: 'folder',
      id: folder.id,
      name: folder.name,
      description: folder.description,
      children: build(folder.children),
      template: folder.hasTemplate ? { kind: 'template', id: folder.id, name: folder.name } : null,
      notes: folder.notes.map((note) => ({ kind: 'note', id: note.id, name: note.name ?? '' })),
      noteCount: folder.noteCount,
    }));

  const folders = build(structure.folders);
  const count = (list: TreeFolder[]): number =>
    list.reduce((total, folder) => total + folder.notes.length + count(folder.children), 0);

  return {
    guidance: structure.guidance !== null,
    folders,
    noteCount: count(folders),
    // A notebook always has a trail; how much of one is not a question a
    // dialog asks the server before it opens.
    historyEntries: null,
  };
}

/** A folder of a notebook, as the interface already holds it. */
interface NotebookFolder {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly hasTemplate: boolean;
  readonly noteCount: number;
  readonly notes: ReadonlyArray<{ id: string; name: string | null }>;
  readonly children: ReadonlyArray<NotebookFolder>;
}

/** Every folder of a tree, depth first, which several of these walk. */
function flatten(folders: ReadonlyArray<TreeFolder>): TreeFolder[] {
  return folders.flatMap((folder) => [folder, ...flatten(folder.children)]);
}

/**
 * What actually travels, out of a scope and what was ticked under it (#161).
 *
 * **This is the one place the dependency between the species is enforced**, and
 * the direction is always the same: a Template and a note belong to a folder,
 * so neither can travel without it. A species switched off carries nothing; a
 * species on `all` carries everything its folders allow; a species on `choose`
 * carries what was ticked, intersected with those same folders.
 */
export function effectiveOf(tree: DocumentTree, scope: Scope, picked: Picked): Chosen {
  const every = flatten(tree.folders);

  const folders = new Set<string>();
  if (scope.folders) {
    for (const folder of every) {
      if (scope.reach.folders === 'all' || picked.folders.has(folder.id)) folders.add(folder.id);
    }
  }

  const templates = new Set<string>();
  const notes = new Set<string>();
  for (const folder of every) {
    // A folder that is not carried carries nothing of its own: it is a path.
    if (!folders.has(folder.id)) continue;
    if (scope.templates && folder.template !== null) {
      if (scope.reach.templates === 'all' || picked.templates.has(folder.id)) {
        templates.add(folder.id);
      }
    }
    if (!scope.notes) continue;
    for (const note of folder.notes) {
      if (scope.reach.notes === 'all' || picked.notes.has(note.id)) notes.add(note.id);
    }
  }

  return {
    guidance: scope.guidance && tree.guidance,
    history: scope.history && tree.historyEntries !== 0,
    folders,
    templates,
    notes,
  };
}

/** Everything: the whole document, which is what almost everyone wants. */
export function everything(tree: DocumentTree): Chosen {
  return effectiveOf(tree, wholeScope, pickedNothing);
}

export const nothing: Chosen = {
  guidance: false,
  history: false,
  folders: new Set<string>(),
  templates: new Set<string>(),
  notes: new Set<string>(),
};

/**
 * What each species contributes, as *carried over held* — which is what the row
 * of the scope states, so the dependency between the species is visible in the
 * first tab instead of being discovered in the third (#161).
 */
export function scopeCountsOf(
  tree: DocumentTree,
  chosen: Chosen,
): Record<Species, { carried: number; held: number }> {
  const every = flatten(tree.folders);
  return {
    folders: { carried: chosen.folders.size, held: every.length },
    templates: {
      carried: chosen.templates.size,
      held: every.filter((folder) => folder.template !== null).length,
    },
    notes: { carried: chosen.notes.size, held: tree.noteCount },
  };
}

/**
 * Every identifier of a species, which is where `Choose items` starts from.
 *
 * Flipping a species from `Everything` to `Choose items` with nothing ticked
 * would drop it to nothing at once — the tab would open on a tree where every
 * box is empty and the summary would say the species is not travelling, which
 * is the opposite of what somebody opening a chooser is doing. They are taking
 * things OUT. So the first flip fills the set, and only the first: a set that
 * already holds something is work somebody did, and flipping back and forth
 * never destroys it.
 */
export function seedOf(tree: DocumentTree, species: Species): ReadonlySet<string> {
  const every = flatten(tree.folders);
  if (species === 'folders') return new Set(every.map((folder) => folder.id));
  if (species === 'templates') {
    return new Set(every.filter((folder) => folder.template !== null).map((folder) => folder.id));
  }
  return new Set(every.flatMap((folder) => folder.notes.map((note) => note.id)));
}

/**
 * The tree a tab offers, pruned to what the folders allow (#161).
 *
 * `offered` of `null` is the Folders tab, where every folder is choosable
 * because choosing them is the question. For the other two it is the set of
 * folders that travel: a folder outside it is drawn when something under it is
 * inside — otherwise its children would hang off nothing — and drawn as a path,
 * with no box of its own and neither its Template nor its notes offered on it.
 *
 * A branch that offers nothing of the species is dropped whole, so the
 * Templates tab of a notebook with four Templates is four rows and their
 * parents, and not sixty-eight rows of which four matter.
 */
export function offeredFolders(
  folders: ReadonlyArray<TreeFolder>,
  offered: ReadonlySet<string> | null,
  species: Species,
): OfferableFolder[] {
  const kept: OfferableFolder[] = [];
  for (const folder of folders) {
    const isOffered = offered === null || offered.has(folder.id);
    const children = offeredFolders(folder.children, offered, species);
    const offers =
      isOffered &&
      (species === 'folders' ||
        (species === 'templates' ? folder.template !== null : folder.notes.length > 0));
    if (!offers && children.length === 0) continue;
    kept.push({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      template: isOffered ? folder.template : null,
      notes: isOffered ? folder.notes : [],
      children,
      noteCount: folder.noteCount,
      offered: isOffered,
    });
  }
  return kept;
}

/**
 * Every identifier a branch offers for one species, counting only the folders
 * that are offered — a path contributes its children and nothing of its own.
 */
function branchIds(folder: OfferableFolder, species: Species): string[] {
  const here = !folder.offered
    ? []
    : species === 'folders'
      ? [folder.id]
      : species === 'templates'
        ? folder.template !== null
          ? [folder.id]
          : []
        : folder.notes.map((note) => note.id);
  return [...here, ...folder.children.flatMap((child) => branchIds(child, species))];
}

/** The set a species is ticked in, which is the only thing that differs. */
function setFor(picked: Picked, species: Species): ReadonlySet<string> {
  return species === 'folders'
    ? picked.folders
    : species === 'templates'
      ? picked.templates
      : picked.notes;
}

function withSet(picked: Picked, species: Species, next: ReadonlySet<string>): Picked {
  return species === 'folders'
    ? { ...picked, folders: next }
    : species === 'templates'
      ? { ...picked, templates: next }
      : { ...picked, notes: next };
}

/**
 * Ticking a node takes the whole branch under it, in that species alone.
 *
 * It never reaches across species: ticking a folder in the Folders tab does not
 * tick its Template, and ticking notes never ticks a folder. Which folders
 * travel is one question and what they carry is another — a checkbox that
 * answered both is exactly what made the previous chooser unreadable (#156).
 */
export function pickBranch(
  picked: Picked,
  folder: OfferableFolder,
  species: Species,
  on: boolean,
): Picked {
  const next = new Set(setFor(picked, species));
  for (const id of branchIds(folder, species)) {
    if (on) next.add(id);
    else next.delete(id);
  }
  return withSet(picked, species, next);
}

/** Ticking one node alone, which is a leaf row: a note, or a Template. */
export function pickOne(picked: Picked, species: Species, id: string, on: boolean): Picked {
  const next = new Set(setFor(picked, species));
  if (on) next.add(id);
  else next.delete(id);
  return withSet(picked, species, next);
}

/**
 * On, off or mixed, over what the branch OFFERS of that species. A branch that
 * offers nothing reads as off, because there is nothing in it to be on.
 */
export function stateOfBranch(
  picked: Picked,
  folder: OfferableFolder,
  species: Species,
): NodeState {
  const ids = branchIds(folder, species);
  if (ids.length === 0) return 'off';
  const set = setFor(picked, species);
  const on = ids.filter((id) => set.has(id)).length;
  if (on === 0) return 'off';
  return on === ids.length ? 'on' : 'mixed';
}

/** What will be created, which is what the summary states. */
export function countsOf(
  tree: DocumentTree,
  chosen: Chosen,
): { folders: number; templates: number; notes: number; guidance: boolean } {
  // A folder not selected but holding something selected is written as a path,
  // so it counts among what will be created (RN-PRT-017) — and a Template is
  // something selected, since it belongs to a folder (#156).
  const written = new Set([...chosen.folders, ...chosen.templates]);
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
    const key = `${note.folderId} ${name}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen]
    .filter(([, count]) => count > 1)
    .map(([key]) => {
      const [folderId = '', name = ''] = key.split(' ');
      return { folderId, name };
    });
}

/** What travels to the server: the identifiers the document carries. */
export function selectionOf(chosen: Chosen): TransferSelection {
  return {
    guidance: chosen.guidance,
    history: chosen.history,
    folders: [...chosen.folders],
    templates: [...chosen.templates],
    notes: [...chosen.notes],
  };
}
