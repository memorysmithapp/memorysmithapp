// The single source that answers the screens: the product API.
//
// There used to be a second one here, a bundled seed the app fell back to when
// VITE_API_ORIGIN was unset, and it was how the interface was designed before
// the API existed. It is gone on purpose. A fallback that answers with
// different data, silently, is worse than no answer: the screen looks right
// and is showing something else, and every bug found that way is found twice.
//
// So where the API is comes from the configuration the environment publishes
// (shared/config/runtime-config.ts), and a page that cannot read it says so
// before it renders anything.

import type { ExportJobDto } from '@memorysmith/contracts';
import * as backend from './backend';
import { linkTargetAddress, noteAddress } from './note-address';
import type {
  NoteDetail,
  SearchHit,
  TemplateDetail,
  NotebookStructure,
  NotebookSummary,
} from '../types/api';

/**
 * The one note of a loaded structure that carries a name, by identifier, or
 * `null` when none or several carry it. It walks the structure the page is
 * already showing, so a link costs no request.
 *
 * A target is a NAME, compared after NFC and folded in no other way
 * (RN-DSC-041): a near miss is a pending link and never a landing. A name
 * carried by several notes is a choice and not a note, and what gets an
 * address then is the target (RN-DSC-046).
 */
function soleNoteNamed(target: string, structure: NotebookStructure | undefined): string | null {
  if (!structure) return null;
  const wanted = target.normalize('NFC');
  const found: string[] = [];

  const walk = (nodes: NotebookStructure['folders']): void => {
    for (const node of nodes) {
      for (const note of node.notes) {
        if ((note.name ?? '').normalize('NFC') === wanted) found.push(note.id);
      }
      walk(node.children);
    }
  };
  walk(structure.folders);

  return found.length === 1 ? (found[0] ?? null) : null;
}

/**
 * The structures the screens have already loaded. A wikilink resolves against
 * this instead of asking the API again: the tree it needs is the tree the page
 * is already showing.
 */
const loaded = new Map<string, NotebookStructure>();

export function listNotebooks(): Promise<NotebookSummary[]> {
  return backend.listNotebooks();
}

export async function getNotebookStructure(notebookId: string): Promise<NotebookStructure> {
  const structure = await backend.getNotebookStructure(notebookId);
  loaded.set(notebookId, structure);
  return structure;
}

export function getNote(notebookId: string, noteId: string): Promise<NoteDetail> {
  return backend.getNote(notebookId, noteId);
}

export function getTemplate(notebookId: string, folderId: string): Promise<TemplateDetail | null> {
  return backend.getTemplate(notebookId, folderId);
}

/**
 * The address a wikilink navigates to, or `null` when the target does not
 * resolve to exactly one note — which is where the reading surface writes a
 * `pending:` link and the link target page takes over (RN-DSC-046).
 */
export function resolveNoteUrl(notebookId: string, target: string): string | null {
  const noteId = resolveNoteId(notebookId, target);
  return noteId ? noteAddress(notebookId, noteId) : null;
}

/** The identifier of the one note a target names, which a transclusion expands. */
export function resolveNoteId(notebookId: string, target: string): string | null {
  return soleNoteNamed(target, loaded.get(notebookId));
}

/**
 * Where a wikilink goes: the note when exactly one carries the name, the
 * address of the TARGET when several do, and `null` — the pending state — when
 * none does (RN-DSC-046).
 *
 * The interface can tell the three apart without asking the server, because
 * the structure it drew the page from already carries every name. What it
 * cannot tell from here is an alias, and it does not have to: an alias only
 * ever resolves what no name matched, so a target no name answers goes to
 * the target page, which asks Discovery.
 */
export function wikilinkUrl(notebookId: string, target: string): string | null {
  const carried = notesNamed(notebookId, target);
  if (carried === 1) return resolveNoteUrl(notebookId, target);
  return linkTargetAddress(notebookId, target);
}

/**
 * How many notes of the loaded structure carry that name. One is a link, none
 * is pending, and several is the choice.
 */
export function notesNamed(notebookId: string, target: string): number {
  const structure = loaded.get(notebookId);
  if (!structure) return 0;
  const wanted = target.normalize('NFC');
  const count = (nodes: NotebookStructure['folders']): number =>
    nodes.reduce(
      (total, node) =>
        total +
        node.notes.filter((note) => (note.name ?? '').normalize('NFC') === wanted).length +
        count(node.children),
      0,
    );
  return count(structure.folders);
}

/** The whole notebook as a downloadable archive, prepared on demand. */
export function prepareImport() {
  return backend.prepareImport();
}

export function applyImport(uploadKey: string, name: string) {
  return backend.applyImport(uploadKey, name);
}

export function exportNotebook(notebookId: string): Promise<ExportJobDto> {
  return backend.exportNotebook(notebookId);
}

export function resolveLinkTarget(notebookId: string, target: string) {
  return backend.resolveLinkTarget(notebookId, target);
}

export function searchNotes(notebookId: string, query: string, k: number): Promise<SearchHit[]> {
  return backend.searchNotebook(notebookId, query, k);
}

/**
 * The three writes the reading surface makes. They are the whole write surface
 * of the UI today, and each carries the revision it is based on: a notebook that
 * sustains auditing does not accept blind overwrite (RN-KNW-034).
 */
export function updateNote(
  notebookId: string,
  noteId: string,
  input: { content: string; baseRevision: string },
  options: { keepalive?: boolean } = {},
): Promise<string> {
  // The version the write produced. Every writer of a Content Slot answers
  // it, so the caller can chain a second write without reloading the note.
  return backend
    .updateNote(notebookId, noteId, input, options)
    .then((note) => note.revision.versionId);
}

export function putGuidance(
  notebookId: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  return backend.putGuidance(notebookId, content, baseRevision, options);
}

export function putTemplate(
  notebookId: string,
  folderId: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  return backend.putTemplate(notebookId, folderId, content, baseRevision, options);
}

/**
 * The two Content Slots that are not notes are deleted on their own, and their
 * parent stays (RN-KNW-045).
 */
export function deleteGuidance(notebookId: string): Promise<void> {
  return backend.deleteGuidance(notebookId);
}

export function deleteTemplate(notebookId: string, folderId: string): Promise<void> {
  return backend.deleteTemplate(notebookId, folderId);
}

/**
 * Who may tick a box: whoever may write in THIS notebook. The effective role is
 * min(subscription role, notebook ceiling), and it is the only thing that decides
 * (section 5.3). Never the role in the subscription, which would let an EDITOR
 * demoted in this notebook write here.
 */
export function canWrite(effectiveRole: string): boolean {
  return effectiveRole === 'OWNER' || effectiveRole === 'EDITOR';
}
