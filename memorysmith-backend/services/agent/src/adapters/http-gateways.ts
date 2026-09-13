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
  type RelatedNode,
  type SearchHit,
  type NotebookListing,
} from '../mcp/gateway.js';

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

  async setGuidance(
    caller: AgentCaller,
    notebookId: string,
    content: string,
    baseRevision: string | null,
  ): Promise<void> {
    await callApi(this.origin, caller, `/knowledge/notebooks/${notebookId}/guidance`, {
      method: 'PUT',
      body: { content, baseRevision },
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
    input: { notebookId: string; name: string; description: string; parentFolderId?: string },
  ): Promise<FolderListing> {
    return callApi<FolderListing>(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders`,
      {
        method: 'POST',
        body: {
          name: input.name,
          description: input.description,
          parentFolderId: input.parentFolderId ?? null,
        },
      },
    );
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
  ): Promise<void> {
    await callApi(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/folders/${input.folderId}/template`,
      { method: 'PUT', body: { content: input.content, baseRevision: input.baseRevision } },
    );
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
    const found = await callApi<{
      content: string | null;
      folderName?: string;
      revision?: { versionId: string };
    }>(this.origin, caller, `/knowledge/notebooks/${notebookId}/folders/${folderId}/template`);
    return found.content === null
      ? null
      : {
          content: found.content,
          folderName: found.folderName ?? '',
          revision: found.revision?.versionId ?? '',
        };
  }

  async listNotes(
    caller: AgentCaller,
    notebookId: string,
    folderId?: string,
  ): Promise<NoteListing[]> {
    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : '';
    const notes = await callApi<
      Array<{ noteId: string; name: string | null; folderId: string; position: string }>
    >(this.origin, caller, `/knowledge/notebooks/${notebookId}/notes${query}`);
    return notes;
  }

  async readNote(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteContent> {
    const note = await callApi<{
      noteId: string;
      name: string | null;
      content: string;
      revision: { versionId: string };
      updatedAt: string;
    }>(this.origin, caller, `/knowledge/notebooks/${notebookId}/notes/${noteId}`);
    return {
      noteId: note.noteId,
      name: note.name,
      content: note.content,
      revision: note.revision.versionId,
      updatedAt: note.updatedAt,
    };
  }

  async createNote(
    caller: AgentCaller,
    input: { notebookId: string; folderId: string; content: string },
  ): Promise<NoteContent> {
    const created = await callApi<{
      noteId: string;
      name: string | null;
      updatedAt: string;
    }>(this.origin, caller, `/knowledge/notebooks/${input.notebookId}/notes`, {
      method: 'POST',
      body: { folderId: input.folderId, content: input.content },
    });
    return this.readNote(caller, input.notebookId, created.noteId);
  }

  async updateNote(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; content: string; baseRevision: string },
  ): Promise<NoteContent> {
    await callApi(
      this.origin,
      caller,
      `/knowledge/notebooks/${input.notebookId}/notes/${input.noteId}`,
      {
        method: 'PUT',
        body: { content: input.content, baseRevision: input.baseRevision },
      },
    );
    return this.readNote(caller, input.notebookId, input.noteId);
  }

  async searchNotes(caller: AgentCaller, notebookId: string, query: string): Promise<SearchHit[]> {
    const found = await callApi<{ hits: SearchHit[] }>(
      this.origin,
      caller,
      `/discovery/notebooks/${notebookId}/search`,
      { method: 'POST', body: { query } },
    );
    return found.hits;
  }
}

export class HttpDiscoveryGateway implements DiscoveryGateway {
  constructor(private readonly origin: string) {}

  async relatedNotes(
    caller: AgentCaller,
    input: { notebookId: string; noteId: string; depth?: number },
  ): Promise<RelatedNode> {
    const depth = input.depth ? `?depth=${input.depth}` : '';
    return callApi<RelatedNode>(
      this.origin,
      caller,
      `/discovery/notebooks/${input.notebookId}/notes/${input.noteId}/graph${depth}`,
    );
  }

  async backlinks(caller: AgentCaller, notebookId: string, noteId: string): Promise<NoteListing[]> {
    const found = await callApi<{ backlinks: NoteListing[] }>(
      this.origin,
      caller,
      `/discovery/notebooks/${notebookId}/notes/${noteId}/backlinks`,
    );
    return found.backlinks;
  }
}

export class HttpAuditGateway implements AuditGateway {
  constructor(private readonly origin: string) {}

  async noteHistory(
    caller: AgentCaller,
    _notebookId: string,
    noteId: string,
  ): Promise<HistoryEntry[]> {
    const history = await callApi<{
      entries: Array<{
        occurredAt: string;
        type: string;
        authorship: { userId: string; agent: { clientId: string; clientName: string } | null };
        contentRef: { versionId: string } | null;
      }>;
    }>(this.origin, caller, `/audit/notes/${noteId}/history`);

    return history.entries.map((entry) => ({
      occurredAt: entry.occurredAt,
      type: entry.type,
      userId: entry.authorship.userId,
      agentName: entry.authorship.agent?.clientName ?? null,
      agentClientId: entry.authorship.agent?.clientId ?? null,
      revision: entry.contentRef?.versionId ?? null,
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
      `/audit/notes/${input.noteId}/revisions?asOf=${encodeURIComponent(input.asOf)}`,
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
