// The HTTP-backed source. It answers exactly the same shapes the seed source
// answers, which is what lets the components stay unchanged: swapping the
// backend in is choosing a different implementation of this contract, not
// rewriting the screens.
//
// The interface addresses by identifier, as the API does (RN-DSC-045), so a
// call names the notebook it reads with the identifier the address carried and
// never goes through the listing to find it.

import type {
  AccountLocaleDto,
  ExportJobDto,
  FolderDto,
  ContentDto,
  NoteDto,
  NoteSummaryDto,
  ResolvedTargetDto,
  SessionDto,
  FacetStatsDto,
  NotebookDetailDto,
  NotebookGraphDto,
  NotebookHealthDto,
  NotebookSummaryDto,
} from '@memorysmith/contracts';
import type {
  FolderNode,
  NoteDetail,
  SearchHit,
  TemplateDetail,
  NotebookStructure,
  NotebookSummary,
} from '../types/api';
import { splitFrontmatter } from './markdown';
import { request } from './http';

export async function getSession(): Promise<SessionDto> {
  return request<SessionDto>('/access/session');
}

/**
 * Records the language the person chose on their account, which every message
 * the product sends them is written in (RN-ACC-018).
 */
export async function recordAccountLocale(locale: AccountLocaleDto): Promise<void> {
  await request<void>('/access/session/locale', { method: 'PUT', body: { locale } });
}

function toSummary(notebook: NotebookSummaryDto): NotebookSummary {
  return {
    id: notebook.notebookId,
    slug: notebook.slug,
    name: notebook.name,
    description: notebook.description,
    noteCount: notebook.noteCount,
    updatedAt: notebook.updatedAt,
  };
}

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const notebooks = await request<NotebookSummaryDto[]>('/knowledge/notebooks');
  return notebooks.map(toSummary);
}

/**
 * The API returns the tree flat and in the defined order, with a fractional
 * position key. The UI wants it nested, and it wants a number to sort by, so
 * the index within the level is the number: the key itself is storage detail.
 */
function nest(folders: FolderDto[], notes: NoteSummaryDto[]): FolderNode[] {
  const byParent = new Map<string | null, FolderDto[]>();
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentFolderId, siblings);
  }

  const build = (parentId: string | null): FolderNode[] =>
    (byParent.get(parentId) ?? []).map((folder, index) => ({
      id: folder.folderId,
      parentId: folder.parentFolderId,
      name: folder.name,
      slug: folder.slug,
      description: folder.description,
      position: index,
      hasTemplate: folder.hasTemplate,
      noteCount: folder.noteCount,
      notes: notes
        .filter((note) => note.folderId === folder.folderId)
        .map((note) => ({
          id: note.noteId,
          name: note.name,
          folderId: note.folderId,
        })),
      children: build(folder.folderId),
    }));

  return build(null);
}

export async function getNotebookStructure(notebookId: string): Promise<NotebookStructure> {
  const [detail, notes] = await Promise.all([
    request<NotebookDetailDto>(`/knowledge/notebooks/${notebookId}`),
    request<NoteSummaryDto[]>(`/knowledge/notebooks/${notebookId}/notes`),
  ]);

  return {
    notebook: toSummary(detail),
    guidance: detail.guidance?.content ?? null,
    guidanceRevision: detail.guidance?.revision.versionId ?? null,
    effectiveRole: detail.effectiveRole,
    folders: nest(detail.folders, notes),
  };
}

/**
 * What one wikilink target resolves to in this notebook: the notes it reaches and
 * whether a name or an alias answered (RN-DSC-046). Resolution belongs to
 * Discovery, which is the context that holds the index a notebook answers with.
 */
export async function resolveLinkTarget(
  notebookId: string,
  target: string,
): Promise<ResolvedTargetDto> {
  return request<ResolvedTargetDto>(
    `/discovery/notebooks/${notebookId}/links/${encodeURIComponent(target)}`,
  );
}

export async function getNote(notebookId: string, noteId: string): Promise<NoteDetail> {
  const [note, detail] = await Promise.all([
    /**
     * Typed by the DTO the API publishes, and NOT by a shape retyped here.
     *
     * The local shape declared `revision: string`, and the DTO says it is a
     * `ContentRef` — an object. So the whole object was carried into
     * `NoteDetail.revision` and sent back as `baseRevision`, which the API
     * requires to be a string: every task-box write was refused at validation
     * and never reached the conflict check. The guidance and the template
     * read `.versionId` and worked, which is why only the note was broken.
     *
     * A hand-written mirror of a published contract is a claim the compiler
     * cannot check. Taking the DTO is what makes the next divergence a build
     * error instead of a screen that fails.
     */
    request<NoteDto>(`/knowledge/notebooks/${notebookId}/notes/${noteId}`),
    request<NotebookDetailDto>(`/knowledge/notebooks/${notebookId}`),
  ]);

  // The breadcrumb wants the names of the folders above it.
  const byId = new Map(detail.folders.map((folder) => [folder.folderId, folder]));
  const folderNames: string[] = [];
  let current = byId.get(note.folderId);
  while (current) {
    folderNames.unshift(current.name);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }

  const { frontmatter, lists, body } = splitFrontmatter(note.content);
  return {
    id: note.noteId,
    notebookId,
    folderId: note.folderId,
    name: note.name,
    folderNames,
    frontmatter,
    listProperties: [...lists],
    body,
    raw: note.content,
    // The version, which is what a write echoes back (RN-AGT-005).
    revision: note.revision.versionId,
  };
}

export async function getTemplate(
  notebookId: string,
  folderId: string,
): Promise<TemplateDetail | null> {
  /**
   * The route answers `{ content: null }` when the folder carries no template
   * yet, and the published `ContentDto` when it does. That union is the
   * contract, so it is written as one instead of as a shape with everything
   * made optional — which is how the note DTO drifted.
   */
  const template = await request<ContentDto | { content: null }>(
    `/knowledge/notebooks/${notebookId}/folders/${folderId}/template`,
  );
  return template.content === null
    ? null
    : { folderId, body: template.content, revision: template.revision.versionId };
}

/** The composed document the agent reads, shown in the connect screen. */
/** The two Discovery reads the dashboard aggregates. */
export async function getFacetsById(notebookId: string): Promise<FacetStatsDto> {
  return request<FacetStatsDto>(`/discovery/notebooks/${notebookId}/facets`);
}

export async function getHealthById(notebookId: string): Promise<NotebookHealthDto> {
  return request<NotebookHealthDto>(`/discovery/notebooks/${notebookId}/health`);
}

/**
 * The whole link graph of a notebook, drawn by the graph view. The API answers
 * with edges as index pairs, and the note identifiers it names are resolved
 * against the structure the screen already loaded, so a click can open a note
 * without another round trip.
 */
export async function getNotebookGraph(notebookId: string): Promise<NotebookGraphDto> {
  return request<NotebookGraphDto>(`/discovery/notebooks/${notebookId}/graph`);
}

/**
 * The export of a whole notebook, as a folder of Markdown inside a ZIP. The API
 * answers with a short-lived link rather than with the bytes, so what comes
 * back here is where to fetch it and until when.
 */
/** A short-lived address to upload a `.notebook` file to (RN-PRT-014). */
export async function prepareImport(): Promise<{ uploadKey: string; uploadUrl: string }> {
  return request<{ uploadKey: string; uploadUrl: string }>('/portability/imports', {
    method: 'POST',
    body: {},
  });
}

/** Reads what was uploaded and writes the notebook it describes. */
export async function applyImport(
  uploadKey: string,
  name: string,
): Promise<{ notebookId: string; noteCount: number; folderCount: number }> {
  return request<{ notebookId: string; noteCount: number; folderCount: number }>(
    '/portability/imports/apply',
    { method: 'POST', body: { uploadKey, name } },
  );
}

export async function exportNotebook(notebookId: string): Promise<ExportJobDto> {
  return request<ExportJobDto>(`/portability/notebooks/${notebookId}/export`, { method: 'POST' });
}

// ---- Writes ----------------------------------------------------------------

export async function createNotebook(input: {
  name: string;
  description: string;
}): Promise<NotebookSummary> {
  return toSummary(
    await request<NotebookSummaryDto>('/knowledge/notebooks', { method: 'POST', body: input }),
  );
}

export async function createFolder(
  notebookId: string,
  input: { parentFolderId: string | null; name: string; description: string },
): Promise<FolderDto> {
  return request<FolderDto>(`/knowledge/notebooks/${notebookId}/folders`, {
    method: 'POST',
    body: input,
  });
}

export async function putGuidance(
  notebookId: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  // The revision this write produced, which the next write has to name.
  const written = await request<{ revision: { versionId: string } }>(
    `/knowledge/notebooks/${notebookId}/guidance`,
    { method: 'PUT', body: { content, baseRevision }, ...options },
  );
  return written.revision.versionId;
}
export async function deleteGuidance(notebookId: string): Promise<void> {
  await request<void>(`/knowledge/notebooks/${notebookId}/guidance`, { method: 'DELETE' });
}

export async function putTemplate(
  notebookId: string,
  folderId: string,
  content: string,
  baseRevision: string | null,
  options: { keepalive?: boolean } = {},
): Promise<string> {
  const written = await request<{ revision: { versionId: string } }>(
    `/knowledge/notebooks/${notebookId}/folders/${folderId}/template`,
    { method: 'PUT', body: { content, baseRevision }, ...options },
  );
  return written.revision.versionId;
}

export async function deleteTemplate(notebookId: string, folderId: string): Promise<void> {
  await request<void>(`/knowledge/notebooks/${notebookId}/folders/${folderId}/template`, {
    method: 'DELETE',
  });
}

export async function createNote(
  notebookId: string,
  input: { folderId: string; name: string; content: string },
): Promise<NoteSummaryDto> {
  return request<NoteSummaryDto>(`/knowledge/notebooks/${notebookId}/notes`, {
    method: 'POST',
    body: input,
  });
}

export async function updateNote(
  notebookId: string,
  noteId: string,
  input: { content: string; baseRevision: string; name?: string },
  options: { keepalive?: boolean } = {},
): Promise<NoteDto> {
  // The answer carries the revision this write produced, which is what the
  // NEXT write has to be based on.
  return request<NoteDto>(`/knowledge/notebooks/${notebookId}/notes/${noteId}`, {
    method: 'PUT',
    body: input,
    ...options,
  });
}

// ---- Discovery and audit ----------------------------------------------------

export interface BacklinkDto {
  noteId: string;
  name: string;
  slug: string;
  folderId: string;
}

export async function backlinksOf(notebookId: string, noteId: string): Promise<BacklinkDto[]> {
  const found = await request<{ backlinks: BacklinkDto[] }>(
    `/discovery/notebooks/${notebookId}/notes/${noteId}/backlinks`,
  );
  return found.backlinks;
}

/**
 * The search of the Discovery context, which reads the text of the whole notebook
 * and answers the query language of `SearchQuery` (software-vision.md 10.2).
 * The screen sends what the person typed, verbatim: the fields, the quotes,
 * the exclusions and the facets are parsed by the backend, not here.
 */
export async function searchNotebook(
  notebookId: string,
  query: string,
  k: number,
): Promise<SearchHit[]> {
  const found = await request<{ mode: string; hits: SearchHit[] }>(
    `/discovery/notebooks/${notebookId}/search`,
    { method: 'POST', body: { query, k } },
  );
  return found.hits;
}

export interface HistoryEntryDto {
  occurredAt: string;
  type: string;
  authorship: { userId: string; agent: { clientName: string } | null };
  contentRef: { versionId: string } | null;
}

export async function noteHistory(noteId: string): Promise<HistoryEntryDto[]> {
  const history = await request<{ entries: HistoryEntryDto[] }>(`/audit/notes/${noteId}/history`);
  return history.entries;
}
