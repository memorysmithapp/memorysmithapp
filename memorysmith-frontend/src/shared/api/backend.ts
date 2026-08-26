// The HTTP-backed source. It answers exactly the same shapes the seed source
// answers, which is what lets the components stay unchanged: swapping the
// backend in is choosing a different implementation of this contract, not
// rewriting the screens.
//
// The frontend navigates by SLUG, because that is what a link and a URL carry,
// while the API addresses by identifier. Resolving one to the other happens
// here, once, and is cached by the query client above it.

import type {
  FolderDto,
  NoteSummaryDto,
  SessionDto,
  FacetStatsDto,
  VaultDetailDto,
  VaultGraphDto,
  VaultHealthDto,
  VaultSummaryDto,
} from '@memorysmith/contracts';
import type {
  FolderNode,
  NoteDetail,
  TemplateDetail,
  VaultStructure,
  VaultSummary,
} from '../types/api';
import { splitFrontmatter } from './markdown';
import { request } from './http';
import { ApiError } from './error-mapper';

export async function getSession(): Promise<SessionDto> {
  return request<SessionDto>('/access/session');
}

export async function requestSubscription(name: string): Promise<{ subscriptionId: string }> {
  return request<{ subscriptionId: string }>('/access/subscriptions', {
    method: 'POST',
    body: { name },
  });
}

function toSummary(vault: VaultSummaryDto): VaultSummary {
  return {
    id: vault.vaultId,
    slug: vault.slug,
    name: vault.name,
    description: vault.description,
    noteCount: vault.noteCount,
  };
}

export async function listVaults(): Promise<VaultSummary[]> {
  const vaults = await request<VaultSummaryDto[]>('/knowledge/vaults');
  return vaults.map(toSummary);
}

/** Slug to identifier, from the listing the shell already loads. */
async function vaultIdOf(vaultSlug: string): Promise<string> {
  const vaults = await request<VaultSummaryDto[]>('/knowledge/vaults');
  const found = vaults.find((vault) => vault.slug === vaultSlug || vault.vaultId === vaultSlug);
  if (!found) throw new ApiError('NOT_FOUND', 'Vault not found', 404);
  return found.vaultId;
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

  const build = (parentId: string | null, parentSlugPath: string): FolderNode[] =>
    (byParent.get(parentId) ?? []).map((folder, index) => {
      const slugPath = parentSlugPath ? `${parentSlugPath}/${folder.slug}` : folder.slug;
      return {
        id: folder.folderId,
        parentId: folder.parentFolderId,
        name: folder.name,
        slug: folder.slug,
        slugPath,
        description: folder.description,
        position: index,
        hasTemplate: folder.hasTemplate,
        noteCount: folder.noteCount,
        notes: notes
          .filter((note) => note.folderId === folder.folderId)
          .map((note) => ({
            id: note.noteId,
            slug: note.slug,
            title: note.title,
            folderId: note.folderId,
          })),
        children: build(folder.folderId, slugPath),
      };
    });

  return build(null, '');
}

export async function getVaultStructure(vaultSlug: string): Promise<VaultStructure> {
  const vaultId = await vaultIdOf(vaultSlug);
  const [detail, notes] = await Promise.all([
    request<VaultDetailDto>(`/knowledge/vaults/${vaultId}`),
    request<NoteSummaryDto[]>(`/knowledge/vaults/${vaultId}/notes`),
  ]);

  return {
    vault: toSummary(detail),
    guidance: detail.guidance?.content ?? null,
    folders: nest(detail.folders, notes),
  };
}

export async function getNote(vaultSlug: string, noteSlug: string): Promise<NoteDetail> {
  const vaultId = await vaultIdOf(vaultSlug);
  const [note, detail] = await Promise.all([
    request<{ noteId: string; title: string; slug: string; folderId: string; content: string }>(
      `/knowledge/vaults/${vaultId}/notes/by-slug/${encodeURIComponent(noteSlug)}`,
    ),
    request<VaultDetailDto>(`/knowledge/vaults/${vaultId}`),
  ]);

  // The breadcrumb wants the names of the folders above it.
  const byId = new Map(detail.folders.map((folder) => [folder.folderId, folder]));
  const folderNames: string[] = [];
  let current = byId.get(note.folderId);
  while (current) {
    folderNames.unshift(current.name);
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined;
  }

  const { frontmatter, body } = splitFrontmatter(note.content);
  return {
    id: note.noteId,
    vaultSlug,
    slug: note.slug,
    title: note.title,
    folderNames,
    frontmatter,
    body,
    raw: note.content,
  };
}

export async function getTemplate(
  vaultSlug: string,
  folderId: string,
): Promise<TemplateDetail | null> {
  const vaultId = await vaultIdOf(vaultSlug);
  const template = await request<{ content: string | null }>(
    `/knowledge/vaults/${vaultId}/folders/${folderId}/template`,
  );
  return template.content === null ? null : { folderId, body: template.content };
}

/** The composed document the agent reads, shown in the connect screen. */
/**
 * The two Discovery reads the dashboard aggregates. Both take an identifier,
 * not a slug, because the caller already listed the vaults and holds it: going
 * back through the slug would be a second round trip for something it knows.
 */
export async function getFacetsById(vaultId: string): Promise<FacetStatsDto> {
  return request<FacetStatsDto>(`/discovery/vaults/${vaultId}/facets`);
}

export async function getHealthById(vaultId: string): Promise<VaultHealthDto> {
  return request<VaultHealthDto>(`/discovery/vaults/${vaultId}/health`);
}

/**
 * The whole link graph of a vault, drawn by the graph view. The API answers
 * with edges as index pairs, and the note identifiers it names are resolved
 * against the structure the screen already loaded, so a click can open a note
 * without another round trip.
 */
export async function getVaultGraph(vaultSlug: string): Promise<VaultGraphDto> {
  const vaultId = await vaultIdOf(vaultSlug);
  return request<VaultGraphDto>(`/discovery/vaults/${vaultId}/graph`);
}

export async function getVaultContext(vaultSlug: string): Promise<string> {
  const vaultId = await vaultIdOf(vaultSlug);
  return request<string>(`/knowledge/vaults/${vaultId}/context`, { accept: 'text' });
}

// ---- Writes ----------------------------------------------------------------

export async function createVault(input: {
  name: string;
  description: string;
}): Promise<VaultSummary> {
  return toSummary(
    await request<VaultSummaryDto>('/knowledge/vaults', { method: 'POST', body: input }),
  );
}

export async function putGuidance(vaultSlug: string, content: string): Promise<void> {
  const vaultId = await vaultIdOf(vaultSlug);
  await request(`/knowledge/vaults/${vaultId}/guidance`, { method: 'PUT', body: { content } });
}

export async function createFolder(
  vaultSlug: string,
  input: { parentFolderId: string | null; name: string; description: string },
): Promise<FolderDto> {
  const vaultId = await vaultIdOf(vaultSlug);
  return request<FolderDto>(`/knowledge/vaults/${vaultId}/folders`, {
    method: 'POST',
    body: input,
  });
}

export async function putTemplate(
  vaultSlug: string,
  folderId: string,
  content: string,
): Promise<void> {
  const vaultId = await vaultIdOf(vaultSlug);
  await request(`/knowledge/vaults/${vaultId}/folders/${folderId}/template`, {
    method: 'PUT',
    body: { content },
  });
}

export async function createNote(
  vaultSlug: string,
  input: { folderId: string; title: string; content: string },
): Promise<NoteSummaryDto> {
  const vaultId = await vaultIdOf(vaultSlug);
  return request<NoteSummaryDto>(`/knowledge/vaults/${vaultId}/notes`, {
    method: 'POST',
    body: input,
  });
}

export async function updateNote(
  vaultSlug: string,
  noteId: string,
  input: { content: string; baseRevision: string; title?: string },
): Promise<NoteSummaryDto> {
  const vaultId = await vaultIdOf(vaultSlug);
  return request<NoteSummaryDto>(`/knowledge/vaults/${vaultId}/notes/${noteId}`, {
    method: 'PUT',
    body: input,
  });
}

// ---- Discovery and audit ----------------------------------------------------

export interface BacklinkDto {
  noteId: string;
  title: string;
  slug: string;
  folderId: string;
}

export async function backlinksOf(vaultSlug: string, noteId: string): Promise<BacklinkDto[]> {
  const vaultId = await vaultIdOf(vaultSlug);
  const found = await request<{ backlinks: BacklinkDto[] }>(
    `/discovery/vaults/${vaultId}/notes/${noteId}/backlinks`,
  );
  return found.backlinks;
}

export async function searchVault(
  vaultSlug: string,
  query: string,
  mode: 'lexical' | 'semantic',
): Promise<Array<{ noteId: string; section: string | null; excerpt: string; score: number }>> {
  const vaultId = await vaultIdOf(vaultSlug);
  const found = await request<{
    hits: Array<{ noteId: string; section: string | null; excerpt: string; score: number }>;
  }>(`/discovery/vaults/${vaultId}/search`, { method: 'POST', body: { query, mode } });
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
