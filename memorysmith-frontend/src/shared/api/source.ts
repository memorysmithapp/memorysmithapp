// The single source that answers the screens: the product API.
//
// There used to be a second one here, a bundled seed the app fell back to when
// VITE_API_ORIGIN was unset, and it was how the interface was designed before
// the API existed. It is gone on purpose. A fallback that answers with
// different data, silently, is worse than no answer: the screen looks right
// and is showing something else, and every bug found that way is found twice.
//
// So a missing origin is now a configuration error, and it says so.

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

const configuredOrigin = (import.meta.env['VITE_API_ORIGIN'] as string | undefined)?.replace(
  /\/$/,
  '',
);

if (!configuredOrigin) {
  throw new Error(
    'VITE_API_ORIGIN is not set. The interface reads and writes through the product API and ' +
      'has no offline mode; copy .env.example to .env.local and point it at the API.',
  );
}

export const apiOrigin: string = configuredOrigin;

/**
 * Walks the loaded structure, so a link needs no extra request.
 *
 * A target is a TITLE, compared after NFC and folded in no other way
 * (RN-DSC-041): a near miss is a pending link and never a landing. What the
 * interface does with a title carried by two notes is #98; here the first one
 * answers, and the address itself is still derived from the title until that
 * issue replaces it with the identifier.
 */
function resolveFromStructure(
  notebookSlug: string,
  target: string,
  structure: NotebookStructure | undefined,
): string | null {
  if (!structure) return null;
  const wanted = target.normalize('NFC');
  const found: Array<{
    folder: NotebookStructure['folders'][number];
    noteId: string;
    title: string;
  }> = [];

  const walk = (nodes: NotebookStructure['folders']): void => {
    for (const node of nodes) {
      for (const note of node.notes) {
        if ((note.title ?? '').normalize('NFC') === wanted) {
          found.push({ folder: node, noteId: note.id, title: note.title ?? '' });
        }
      }
      walk(node.children);
    }
  };
  walk(structure.folders);

  // Exactly one note answers: the link goes straight to it. None or several,
  // and what gets the address is the TARGET, because a name may be carried by
  // more than one note and an address may not (RN-DSC-046).
  const only = found.length === 1 ? found[0] : undefined;
  if (!only) return null;
  return noteAddress(notebookSlug, only.folder.slugPath, only.title, only.noteId);
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

export async function getNotebookStructure(notebookSlug: string): Promise<NotebookStructure> {
  const structure = await backend.getNotebookStructure(notebookSlug);
  loaded.set(notebookSlug, structure);
  return structure;
}

export function getNote(notebookSlug: string, noteSlug: string): Promise<NoteDetail> {
  return backend.getNote(notebookSlug, noteSlug);
}

export function getTemplate(
  notebookSlug: string,
  folderId: string,
): Promise<TemplateDetail | null> {
  return backend.getTemplate(notebookSlug, folderId);
}

/**
 * The address a wikilink navigates to, or `null` when the target does not
 * resolve to exactly one note — which is where the reading surface writes a
 * `pending:` link and the link target page takes over (RN-DSC-046).
 */
export function resolveNoteUrl(notebookSlug: string, target: string): string | null {
  return resolveFromStructure(notebookSlug, target, loaded.get(notebookSlug));
}

/**
 * Where a wikilink goes: the note when exactly one carries the title, the
 * address of the TARGET when several do, and `null` — the pending state — when
 * none does (RN-DSC-046).
 *
 * The interface can tell the three apart without asking the server, because
 * the structure it drew the page from already carries every title. What it
 * cannot tell from here is an alias, and it does not have to: an alias only
 * ever resolves what no title matched, so a target no title answers goes to
 * the target page, which asks Discovery.
 */
export function wikilinkUrl(notebookSlug: string, target: string): string | null {
  const carried = notesTitled(notebookSlug, target);
  if (carried === 1) return resolveNoteUrl(notebookSlug, target);
  return linkTargetAddress(notebookSlug, target);
}

/**
 * How many notes of the loaded structure carry that title. One is a link, none
 * is pending, and several is the choice.
 */
export function notesTitled(notebookSlug: string, target: string): number {
  const structure = loaded.get(notebookSlug);
  if (!structure) return 0;
  const wanted = target.normalize('NFC');
  const count = (nodes: NotebookStructure['folders']): number =>
    nodes.reduce(
      (total, node) =>
        total +
        node.notes.filter((note) => (note.title ?? '').normalize('NFC') === wanted).length +
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

export function exportNotebook(notebookSlug: string): Promise<ExportJobDto> {
  return backend.exportNotebook(notebookSlug);
}

export function resolveLinkTarget(notebookSlug: string, target: string) {
  return backend.resolveLinkTarget(notebookSlug, target);
}

export function searchNotes(notebookSlug: string, query: string, k: number): Promise<SearchHit[]> {
  return backend.searchNotebook(notebookSlug, query, k);
}

/**
 * The three writes the reading surface makes. They are the whole write surface
 * of the UI today, and each carries the revision it is based on: a notebook that
 * sustains auditing does not accept blind overwrite (RN-KNW-034).
 */
export function updateNote(
  notebookSlug: string,
  noteId: string,
  input: { content: string; baseRevision: string },
  options: { keepalive?: boolean } = {},
): Promise<string> {
  // The version the write produced. Every writer of a Content Slot answers
  // it, so the caller can chain a second write without reloading the note.
  return backend
    .updateNote(notebookSlug, noteId, input, options)
    .then((note) => note.revision.versionId);
}

export function putGuidance(
  notebookSlug: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  return backend.putGuidance(notebookSlug, content, baseRevision, options);
}

export function putTemplate(
  notebookSlug: string,
  folderId: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  return backend.putTemplate(notebookSlug, folderId, content, baseRevision, options);
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
