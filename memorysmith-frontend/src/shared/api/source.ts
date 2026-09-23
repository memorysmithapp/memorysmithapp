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

import type {
  DownloadLinkDto,
  FileLinkDto,
  NotebookFileDto,
  SubscriptionUsageDto,
  TransferSelection,
  TransferDto,
  TransferListDto,
} from '@memorysmith/contracts';
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
 * The structures the screens have already loaded. A wikilink resolves against
 * this instead of asking the API again: the tree it needs is the tree the page
 * is already showing.
 */
const loaded = new Map<string, NotebookStructure>();

/**
 * The spellings each notebook answers to, by target: an alias is read by
 * Discovery and by nothing else (rule 5), so it arrives in a call of its own
 * and is remembered beside the structure.
 *
 * Until it arrives a target no NAME matches reaches nothing, which is exactly
 * what the page drew before this existed — so a slow answer costs a moment of
 * the old behaviour and never a wrong address.
 */
const spellings = new Map<string, Map<string, string[]>>();

/**
 * The files each notebook keeps, by the name a note addresses them with
 * (#166). The extension of a name decides nothing: what a target reaches is
 * decided by what the notebook HOLDS, which is this map, and how it is drawn
 * is decided by its type.
 */
const files = new Map<string, Map<string, NotebookFileDto>>();

export async function getNotebookFiles(notebookId: string): Promise<NotebookFileDto[]> {
  const kept = await backend.getNotebookFiles(notebookId);
  files.set(notebookId, new Map(kept.map((file) => [file.name.normalize('NFC'), file])));
  return kept;
}

/** The file the notebook keeps under that name, or `null` when it keeps none. */
export function fileKept(notebookId: string, name: string): NotebookFileDto | null {
  return files.get(notebookId)?.get(name.normalize('NFC')) ?? null;
}

export function linkToFile(notebookId: string, fileId: string): Promise<FileLinkDto> {
  return backend.linkToFile(notebookId, fileId);
}

export async function getNotebookNames(notebookId: string): Promise<number> {
  const notes = await backend.getNotebookNames(notebookId);
  const byAlias = new Map<string, string[]>();
  for (const note of notes) {
    for (const alias of note.aliases) {
      const key = alias.normalize('NFC').trim();
      if (key.length === 0) continue;
      const held = byAlias.get(key) ?? [];
      if (!held.includes(note.noteId)) byAlias.set(key, [...held, note.noteId]);
    }
  }
  spellings.set(notebookId, byAlias);
  return notes.length;
}

/**
 * The notes a target REACHES, which is the question a reading surface has to
 * answer to draw a link: every note whose name matches it, or — only when
 * none does — every note carrying it as an alias (§5.2, steps 7 and 8).
 *
 * The surface used to ask how many notes were NAMED that, which is a different
 * question: a target an alias answered counted zero, so the link was painted
 * as a link to nothing and an embed of it expanded nothing, while clicking it
 * reached the note (#164).
 */
export function notesReaching(notebookId: string, target: string): string[] {
  const wanted = target.normalize('NFC');
  const named = noteIdsNamed(notebookId, wanted);
  if (named.length > 0) return named;
  return spellings.get(notebookId)?.get(wanted) ?? [];
}

export function readUsage(): Promise<SubscriptionUsageDto> {
  return backend.readUsage();
}

export function deleteNotebook(notebookId: string): Promise<void> {
  return backend.deleteNotebook(notebookId);
}

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
 * The address of the one note a target names, or `null` when none or several
 * do. A reading surface resolves a wikilink with `wikilinkUrl`, which tells
 * the three cases apart; this is the one-note half of it.
 */
export function resolveNoteUrl(notebookId: string, target: string): string | null {
  const noteId = resolveNoteId(notebookId, target);
  return noteId ? noteAddress(notebookId, noteId) : null;
}

/** The identifier of the one note a target names, which a transclusion expands. */
export function resolveNoteId(notebookId: string, target: string): string | null {
  const reached = notesReaching(notebookId, target);
  return reached.length === 1 ? (reached[0] ?? null) : null;
}

/**
 * Where a wikilink goes: the note when exactly one carries the name, and the
 * address of the TARGET otherwise — several notes, which is the choice, or
 * none, which is pending and still asks (RN-DSC-046, RN-DSC-060).
 *
 * The interface can tell one note from several without asking the server,
 * because the structure it drew the page from already carries every name.
 * What it cannot tell from here is an alias: an alias only ever resolves what
 * no name matched, so a target no name answers is asked of Discovery when it
 * is clicked.
 */
export function wikilinkUrl(notebookId: string, target: string): string | null {
  const reached = notesReaching(notebookId, target);
  if (reached.length === 1) return resolveNoteUrl(notebookId, target);
  return linkTargetAddress(notebookId, target);
}

/**
 * The names of the folders from the root down to the one that holds a note, in
 * the structure the page already loaded. It is what tells two notes of one
 * name apart in the choice of a link (RN-DSC-046): two folders may hold one
 * name each, and two subfolders of one name under different parents are told
 * apart by the trail above them.
 */
export function folderTrailOfNote(notebookId: string, noteId: string): string[] {
  return folderOfNote(notebookId, noteId).trail;
}

/**
 * The same walk, answering what the choice of a link actually shows: the trail
 * of names, and the **description of the folder that holds the note**.
 *
 * The trail tells two notes of one name apart, and the description is what
 * says which of the two somebody meant — `Decisões` and `Decisões` under
 * different parents are told apart by the path, and `01 Contexto` is told from
 * `02 Integrações` by what each one is for, which is written on the folder and
 * was being left on the server.
 */
export function folderOfNote(
  notebookId: string,
  noteId: string,
): { trail: string[]; description: string } {
  const walk = (
    nodes: NotebookStructure['folders'],
    above: string[],
  ): { trail: string[]; description: string } | null => {
    for (const node of nodes) {
      const trail = [...above, node.name];
      if (node.notes.some((note) => note.id === noteId)) {
        return { trail, description: node.description };
      }
      const nested = walk(node.children, trail);
      if (nested) return nested;
    }
    return null;
  };
  return walk(loaded.get(notebookId)?.folders ?? [], []) ?? { trail: [], description: '' };
}

/**
 * The notes of the loaded structure that carry that name, by identifier. A
 * name is compared after NFC and folded in no other way (RN-DSC-041).
 */
function noteIdsNamed(notebookId: string, wanted: string): string[] {
  const structure = loaded.get(notebookId);
  if (!structure) return [];
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
  return found;
}

/**
 * How many notes of the loaded structure carry that name. One is a link, none
 * is pending, and several is the choice.
 */
export function notesNamed(notebookId: string, target: string): number {
  return noteIdsNamed(notebookId, target.normalize('NFC')).length;
}

/** The whole notebook as a downloadable archive, prepared on demand. */
export function prepareImport() {
  return backend.prepareImport();
}

export function applyImport(
  uploadKey: string,
  name: string,
  selection: TransferSelection | null,
  fileName: string | null = null,
) {
  return backend.applyImport(uploadKey, name, selection, fileName);
}

export function startExport(
  notebookId: string,
  selection: TransferSelection | null = null,
): Promise<TransferDto> {
  return backend.startExport(notebookId, selection);
}

export function listTransfers(): Promise<TransferListDto> {
  return backend.listTransfers();
}

export function getTransfer(transferId: string): Promise<TransferDto> {
  return backend.getTransfer(transferId);
}

export function downloadTransfer(transferId: string): Promise<DownloadLinkDto> {
  return backend.downloadTransfer(transferId);
}

export function cancelTransfer(transferId: string): Promise<void> {
  return backend.cancelTransfer(transferId);
}

export function deleteTransfer(transferId: string): Promise<void> {
  return backend.deleteTransfer(transferId);
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
  input: {
    content: string;
    baseRevision: string;
    /** One line about this change, recorded in the trail (RN-AUD-012). */
    message?: string;
  },
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
