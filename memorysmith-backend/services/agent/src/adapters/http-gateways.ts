/**
 * HTTP implementations of the gateways. svc-agent is its own deployable, on
 * its own host (mcp.memorysmith.app), so it reaches the other contexts over
 * the internal API (architecture-guide.md, section 14.1).
 *
 * It forwards THE CALLER'S OWN TOKEN rather than acting as itself. Two things
 * follow, and both are properties we want:
 *
 *  - the subscription reaching the core is the one fixed at consent, carried
 *    by the claim, exactly as it is for a browser session (RN-SUB-014);
 *  - the core finds the connector that token was handed out to in the
 *    binding the proxy recorded at /token, so the authorship records the agent
 *    AND the human, and a token with no binding writes nothing (RN-AGT-001).
 */

import { pageOf } from '../mcp/note-pages.js';
import type {
  BacklinksDto,
  FileListDto,
  FolderDto,
  FolderNumberDto,
  GraphNodeDto,
  NoteLinksDto,
  NoteRefDto,
  NoteSummaryDto,
  NotebookDetailDto,
  NotebookFileDto,
  SearchResultDto,
} from '@memorysmith/contracts';
import {
  GatewayError,
  type AccessGateway,
  type AgentCaller,
  type ConnectorIdentity,
  type AuditGateway,
  type DiscoveryGateway,
  type FolderListing,
  type HistoryEntry,
  type KnowledgeGateway,
  type NoteContent,
  type NoteListing,
  type NotePage,
  type NoteReference,
  type RelatedNode,
  type SearchHit,
  type NotebookListing,
  type NotebookFileRef,
} from '../mcp/gateway.js';

/**
 * The answers of Discovery are read as the DTOs the contracts publish, and
 * turned into what the tools print here, in one place. They used to be retyped
 * by hand as the shape the tools wanted, so related_notes printed
 * "- undefined (undefined)" for every note and no test could see it.
 */
function referenceOf(note: NoteRefDto): NoteReference {
  return {
    noteId: note.noteId,
    name: note.name === '' ? null : note.name,
    folderId: note.folderId,
  };
}

function relatedNodeOf(node: GraphNodeDto): RelatedNode {
  return {
    noteId: node.note.noteId,
    name: node.note.name,
    folderId: node.note.folderId,
    depth: node.depth,
    children: (node.children as GraphNodeDto[]).map(relatedNodeOf),
  };
}

function folderListingOf(folder: FolderDto): FolderListing {
  return {
    folderId: folder.folderId,
    parentFolderId: folder.parentFolderId,
    name: folder.name,
    slug: folder.slug,
    description: folder.description,
    position: folder.position,
  };
}

/**
 * Siblings in the defined order, the moved one at the position its own write
 * answered. Only that item changed, so the order is right even when the rest
 * was read from an index that has not converged yet.
 */
function inDefinedOrder<T extends { position: string }>(
  siblings: readonly T[],
  idOf: (item: T) => string,
  moved: T,
): T[] {
  const others = siblings.filter((item) => idOf(item) !== idOf(moved));
  return [...others, moved].sort((left, right) => {
    if (left.position !== right.position) return left.position < right.position ? -1 : 1;
    return idOf(left).localeCompare(idOf(right));
  });
}

/** The bearer token travels with the caller, and only inside this process. */
export interface TokenCarrier extends AgentCaller {
  readonly bearerToken: string;
}

async function callApi<T>(
  origin: string,
  caller: AgentCaller,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const token = (caller as TokenCarrier).bearerToken;
  const response = await fetch(`${origin}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    // The taxonomy travels intact, so the tool can say something actionable
    // instead of "request failed" (section 15).
    throw new GatewayError(
      String(payload['code'] ?? 'INTERNAL'),
      String(payload['message'] ?? `The request to ${path} failed`),
      payload['details'],
    );
  }
  return payload as T;
}

export class HttpAccessGateway implements AccessGateway {
  constructor(private readonly origin: string) {}

  async connector(caller: AgentCaller): Promise<ConnectorIdentity | null> {
    try {
      const found = await callApi<ConnectorIdentity>(this.origin, caller, '/access/connector');
      return { clientId: found.clientId, clientName: found.clientName };
    } catch (error) {
      // An unidentified connector is an answer, and whoami says it.
      if (error instanceof GatewayError && error.code === 'NOT_FOUND') return null;
      throw error;
    }
  }
}

export class HttpKnowledgeGateway implements KnowledgeGateway {
  constructor(private readonly origin: string) {}

  async listNotebooks(caller: AgentCaller): Promise<NotebookListing[]> {
    const notebooks = await callApi<
      Array<{ notebookId: string; name: string; description: string; noteCount: number }>
    >(this.origin, caller, '/knowledge/notebooks');
    return notebooks.map((notebook) => ({
      notebookId: notebook.notebookId,
      name: notebook.name,
      description: notebook.description,
      noteCount: notebook.noteCount,
    }));
  }

  async createNotebook(
    caller: AgentCaller,
    input: { name: string; description: string },
  ): Promise<NotebookListing> {
    const created = await callApi<{ notebookId: string; name: string; description: string }>(
      this.origin,
      caller,
      '/knowledge/notebooks',
      { method: 'POST', body: input },
    );
    return {
      notebookId: created.notebookId,
      name: created.name,
      description: created.description,
      noteCount: 0,
    };
  }

  async deleteNotebook(caller: AgentCaller, notebookId: string): Promise<void> {
    await callApi(this.origin, caller, `/knowledge/notebooks/${notebookId}`, { method: 'DELETE' });
  }

  async keptExportsOf(caller: AgentCaller, notebookId: string): Promise<number> {
    try {
      const listed = await callApi<{
        transfers: Array<{ kind: string; status: string; notebookId: string | null }>;
      }>(this.origin, caller, '/portability/transfers');
      return listed.transfers.filter(
        (transfer) =>
          transfer.kind === 'export' &&
          transfer.status === 'ready' &&
          transfer.notebookId === notebookId,
      ).length;
    } catch {
      // The deletion happened either way, and a sentence about the exports is
      // not worth turning a successful deletion into an error.
      return 0;
    }
  }

  async setGuidance(
    caller: AgentCaller,
    notebookId: string,
    content: string,
    baseRevision: string | null,
  ): Promise<string> {
    // The route answers the revision this write produced; dropping it here
    // left an agent nothing to base its next write on.
    const written = await callApi<{ revision: { versionId: string } }>(
      this.origin,
      caller,
      `/knowledge/notebooks/${notebookId}/guidance`,
      { method: 'PUT', body: { content, baseRevision } },
    );
    return written.revision.versionId;
  }

  async deleteGuidance(caller: AgentCaller, notebookId: string): Promise<void> {
    await callApi(this.origin, caller, `/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'DELETE',
    });
  }

  /**
   * The guidance with its revision. The Notebook Context is a document and cannot
   * carry one, so a write that has to echo the revision back needs this.
   */
  async guidance(
    caller: AgentCaller,
    notebookId: string,
  ): Promise<{ content: string; revision: string } | null> {
    const detail = await callApi<{
      guidance: { content: string; revision: { versionId: string } } | null;
    }>(this.origin, caller, `/knowledge/notebooks/${notebookId}`);
    return detail.guidance
      ? { content: detail.guidance.content, revision: detail.guidance.revision.versionId }
      : null;
  }

  async createFolder(
    caller: AgentCaller,
    input: {
      notebookId: string;
      name: string;
      description: string;
      parentFolderId?: string;
      afterFolderId?: string;
    },
  ): Promise<FolderListing> {
    const created = await callApi<FolderDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders`,
      {
        method: 'POST',
        body: {
          name: input.name,
          description: input.description,
          parentFolderId: input.parentFolderId ?? null,
          afterFolderId: input.afterFolderId ?? null,
        },
      },
    );
    return folderListingOf(created);
  }

  async reorderFolder(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; afterFolderId: string | null },
  ): Promise<FolderListing[]> {
    const moved = await callApi<FolderDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders/${input.folderId}/reorder`,
      { method: 'POST', body: { afterFolderId: input.afterFolderId } },
    );
    const detail = await callApi<NotebookDetailDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}`,
    );
    const level = detail.folders
      .filter((folder) => folder.parentFolderId === moved.parentFolderId)
      .map(folderListingOf);
    return inDefinedOrder(level, (folder) => folder.folderId, folderListingOf(moved));
  }

  async deleteFolder(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; policy: string },
  ): Promise<{ removedFolderIds: string[] }> {
    // The policy travels in the query, and there is no default (RN-KNW-007).
    return callApi<{ removedFolderIds: string[] }>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders/${input.folderId}?policy=${encodeURIComponent(input.policy)}`,
      { method: 'DELETE' },
    );
  }

  async setTemplate(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; content: string; baseRevision: string | null },
  ): Promise<string> {
    const written = await callApi<{ revision: { versionId: string } }>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders/${input.folderId}/template`,
      { method: 'PUT', body: { content: input.content, baseRevision: input.baseRevision } },
    );
    return written.revision.versionId;
  }

  async nextNumber(caller: AgentCaller, notebookId: string, folderId: string): Promise<number> {
    const issued = await callApi<FolderNumberDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${notebookId}/folders/${folderId}/numbers`,
      { method: 'POST' },
    );
    return issued.number;
  }

  async deleteTemplate(caller: AgentCaller, notebookId: string, folderId: string): Promise<void> {
    await callApi(
      this.origin,
      caller,
      `/knowledge/notebooks/${notebookId}/folders/${folderId}/template`,
      { method: 'DELETE' },
    );
  }

  async keepFile(
    caller: AgentCaller,
    notebookId: string,
    file: {
      name: string;
      description: string;
      mimeType: string;
      tags: string[];
      path: string;
      contentBase64: string;
    },
  ): Promise<NotebookFileRef> {
    const kept = await callApi<NotebookFileDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${notebookId}/files`,
      { method: 'POST', body: file },
    );
    return fileRefOf(kept);
  }

  async listFiles(caller: AgentCaller, notebookId: string): Promise<NotebookFileRef[]> {
    const listed = await callApi<FileListDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${notebookId}/files`,
    );
    return listed.files.map(fileRefOf);
  }

  async deleteFile(caller: AgentCaller, notebookId: string, fileId: string): Promise<void> {
    await callApi(this.origin, caller, `/knowledge/notebooks/${notebookId}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  async deleteNote(caller: AgentCaller, notebookId: string, noteId: string): Promise<void> {
    await callApi(this.origin, caller, `/knowledge/notebooks/${notebookId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async notebookContext(caller: AgentCaller, notebookId: string): Promise<string> {
    const token = (caller as TokenCarrier).bearerToken;
    const response = await fetch(`${this.origin}/knowledge/notebooks/${notebookId}/context`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      throw new GatewayError(
        String(payload['code'] ?? 'INTERNAL'),
        String(payload['message'] ?? 'Notebook not found'),
      );
    }
    return response.text();
  }

  async template(
    caller: AgentCaller,
    notebookId: string,
    folderId: string,
  ): Promise<{ content: string; folderName: string; revision: string } | null> {
    // The route answers `{ content: null }` for a folder with no Template, and
    // the whole Template with its revision otherwise. Written as that union, so
    // a revision missing from the answer is a type error here rather than an
    // empty string an agent echoes back into a write that conflicts.
    const found = await callApi<
      { content: null } | { content: string; folderName: string; revision: { versionId: string } }
    >(this.origin, caller, `/knowledge/notebooks/${notebookId}/folders/${folderId}/template`);
    return found.content === null
      ? null
      : {
          content: found.content,
          folderName: found.folderName,
          revision: found.revision.versionId,
        };
  }

  /**
   * The index, in pages (RN-AGT-031). The route answers every note with its
   * size, instant and authorship, which the interface uses; an agent receives
   * the four fields of an index, one page at a time, in the defined order —
   * which across folders is the order of the tree, read from the notebook.
   */
  async listNotes(
    caller: AgentCaller,
    input: { notebookId: string; folderId?: string; limit?: number; cursor?: string },
  ): Promise<NotePage> {
    const query = input.folderId ? `?folderId=${encodeURIComponent(input.folderId)}` : '';
    const [notes, detail] = await Promise.all([
      callApi<Array<{ noteId: string; name: string | null; folderId: string; position: string }>>(
        this.origin,
        caller,
        `/knowledge/notebooks/${input.notebookId}/notes${query}`,
      ),
      input.folderId
        ? Promise.resolve({ folders: [{ folderId: input.folderId }] })
        : callApi<{ folders: Array<{ folderId: string }> }>(
            this.origin,
            caller,
            `/knowledge/notebooks/${input.notebookId}`,
          ),
    ]);
    return pageOf(
      notes,
      detail.folders.map((folder) => folder.folderId),
      { limit: input.limit, cursor: input.cursor },
    );
  }

  /**
   * The note, where it lives and where its links go (RN-AGT-033, RN-AGT-034).
   * The links come from Discovery in the same breath, so an agent sees that a
   * target reaches two notes the moment it reads the note, with no further call.
   */
  async readNote(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteContent> {
    const [note, found] = await Promise.all([
      this.noteOf(caller, notebookId, noteId),
      callApi<NoteLinksDto>(
        this.origin,
        caller,
        `/discovery/notebooks/${notebookId}/notes/${noteId}/links`,
      ),
    ]);
    return {
      ...note,
      links: found.links.map((link) => ({
        target: link.target,
        resolvedBy: link.by ?? (link.kind === 'attachment' ? 'attachment' : 'pending'),
        notes: link.notes.map((each) => ({
          noteId: each.noteId,
          name: each.name === '' ? null : each.name,
          folder: each.folderTrail,
        })),
      })),
    };
  }

  /**
   * The note alone, which is what a write answers: the links of a note just
   * written are not projected yet, and answering them would answer the ones
   * from before the write.
   */
  private async noteOf(
    caller: AgentCaller,
    notebookId: string,
    noteId: string,
  ): Promise<NoteContent> {
    const note = await callApi<{
      noteId: string;
      name: string | null;
      folderId: string;
      folderTrail?: string[];
      position: string;
      content: string;
      revision: { versionId: string };
      updatedAt: string;
    }>(this.origin, caller, `/knowledge/notebooks/${notebookId}/notes/${noteId}`);
    return {
      noteId: note.noteId,
      name: note.name,
      folderId: note.folderId,
      position: note.position,
      ...(note.folderTrail ? { folder: note.folderTrail } : {}),
      content: note.content,
      revision: note.revision.versionId,
      updatedAt: note.updatedAt,
    };
  }

  async createNote(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; content: string; afterNoteId?: string },
  ): Promise<NoteContent> {
    const created = await callApi<NoteSummaryDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/notes`,
      {
        method: 'POST',
        body: {
          folderId: input.folderId,
          content: input.content,
          afterNoteId: input.afterNoteId ?? null,
        },
      },
    );
    return this.noteOf(caller, input.notebookId, created.noteId);
  }

  async reorderNote(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; afterNoteId: string | null },
  ): Promise<NoteListing[]> {
    const moved = await callApi<NoteSummaryDto>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/notes/${input.noteId}/reorder`,
      { method: 'POST', body: { afterNoteId: input.afterNoteId } },
    );
    const listingOf = (note: NoteListing): NoteListing => ({
      noteId: note.noteId,
      name: note.name,
      folderId: note.folderId,
      position: note.position,
    });
    // Every sibling, not a page of them: the answer is the whole folder in
    // its new order.
    const siblings = (
      await callApi<NoteListing[]>(
        this.origin,
        caller,
        `/knowledge/notebooks/${input.notebookId}/notes?folderId=${encodeURIComponent(moved.folderId)}`,
      )
    ).map(listingOf);
    return inDefinedOrder(siblings, (note) => note.noteId, listingOf(moved));
  }

  async updateNote(
    caller: AgentCaller,
    input: {
      notebookId: string;
      noteId: string;
      content: string;
      baseRevision: string;
      message?: string | null;
    },
  ): Promise<NoteContent> {
    await callApi(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/notes/${input.noteId}`,
      {
        method: 'PUT',
        body: {
          content: input.content,
          baseRevision: input.baseRevision,
          // Only when there is one: an empty line is no line, and the entry
          // is written without it (RN-AUD-012).
          ...(input.message ? { message: input.message } : {}),
        },
      },
    );
    return this.noteOf(caller, input.notebookId, input.noteId);
  }

  async searchNotes(caller: AgentCaller, notebookId: string, query: string): Promise<SearchHit[]> {
    const found = await callApi<SearchResultDto>(
      this.origin,
      caller,
      `/discovery/notebooks/${notebookId}/search`,
      { method: 'POST', body: { query } },
    );
    return found.hits.map((hit) => ({
      noteId: hit.note.noteId,
      name: hit.note.name,
      folderId: hit.note.folderId,
      section: hit.section,
      excerpt: hit.excerpt,
      score: hit.score,
    }));
  }
}

export class HttpDiscoveryGateway implements DiscoveryGateway {
  constructor(private readonly origin: string) {}

  async relatedNotes(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; depth?: number },
  ): Promise<RelatedNode> {
    const depth = input.depth ? `?depth=${input.depth}` : '';
    const tree = await callApi<GraphNodeDto>(
      this.origin,
      caller,
      `/discovery/notebooks/${input.notebookId}/notes/${input.noteId}/graph${depth}`,
    );
    return relatedNodeOf(tree);
  }

  async backlinks(
    caller: AgentCaller,
    notebookId: string,
    noteId: string,
  ): Promise<NoteReference[]> {
    const found = await callApi<BacklinksDto>(
      this.origin,
      caller,
      `/discovery/notebooks/${notebookId}/notes/${noteId}/backlinks`,
    );
    return found.backlinks.map(referenceOf);
  }
}

export class HttpAuditGateway implements AuditGateway {
  constructor(private readonly origin: string) {}

  async noteHistory(
    caller: AgentCaller,
    notebookId: string,
    noteId: string,
  ): Promise<HistoryEntry[]> {
    const history = await callApi<{
      entries: Array<{
        occurredAt: string;
        type: string;
        authorship: { userId: string; agent: { clientId: string; clientName: string } | null };
        contentRef: { versionId: string } | null;
        message: string | null;
      }>;
    }>(this.origin, caller, `/audit/notebooks/${notebookId}/notes/${noteId}/history`);

    return history.entries.map((entry) => ({
      occurredAt: entry.occurredAt,
      type: entry.type,
      userId: entry.authorship.userId,
      agentName: entry.authorship.agent?.clientName ?? null,
      agentClientId: entry.authorship.agent?.clientId ?? null,
      revision: entry.contentRef?.versionId ?? null,
      message: entry.message ?? null,
    }));
  }

  async revisionAt(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; asOf: string },
  ): Promise<NoteContent> {
    const revision = await callApi<{
      noteId: string;
      occurredAt: string;
      contentRef: { versionId: string };
      content: string;
    }>(
      this.origin,
      caller,
      `/audit/notebooks/${input.notebookId}/notes/${input.noteId}/revisions?asOf=${encodeURIComponent(input.asOf)}`,
    );
    return {
      noteId: revision.noteId,
      // A revision answers content, not identity: what the note is called now
      // is what its current content says, and this is an older one.
      name: null,
      content: revision.content,
      revision: revision.contentRef.versionId,
      updatedAt: revision.occurredAt,
    };
  }
}

/** A file as the API answers it, as the connector says it. */
function fileRefOf(file: NotebookFileDto): NotebookFileRef {
  return {
    fileId: file.fileId,
    name: file.name,
    description: file.description,
    mimeType: file.mimeType,
    tags: file.tags,
    path: file.path,
    bytes: file.bytes,
  };
}
