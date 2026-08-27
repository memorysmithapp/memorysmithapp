/**
 * AWS adapters of the Discovery projections, over mv-discovery
 * (architecture-guide.md, sections 11.1 and 11.3):
 *
 *   OUT#{from}#{to}        outgoing edge          IN#{to}#{from}   backlink
 *   PENDING#{slug}#{from}  link waiting for its target to exist
 *   FACET#{noteId}         the portrait of one note
 *   STAT#{facet}#{value}   one counter PER VALUE, never one item per vault
 *   FDEF#{facet}           inferred kind, distinct count, discarded flag
 *   STRUCT / SFOLDER#{id}  the local projection of the vault shape
 *
 * A counter item per value, and not a single statistics item, for the same
 * reason the META rule exists: fifty notes written in parallel increment
 * different items instead of queuing behind one (PE8).
 *
 * There is no content index here. CHUNK# items held one embedded vector each
 * and were removed in 0.2.0: scoring them meant reading every chunk of the
 * vault on every query, which does not scale in cost or in latency. Searching
 * what a note SAYS comes back behind a port, over a real index.
 */

import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import type { SubscriptionId } from '@memorysmith/kernel';
import type {
  BrokenLink,
  FacetIndex,
  FacetStats,
  GraphNode,
  LinkGraph,
  LinkTarget,
  NoteRef,
  VaultGraph,
} from '../domain/ports.js';
import { GRAPH_LIMITS } from '../domain/ports.js';
import { facetDelta, type FacetSnapshot } from '../domain/FacetExtractor.js';
import type { StructureProjection, VaultStructure } from '../application/projections.js';

type Item = Record<string, unknown>;

const MAX_DISTINCT_VALUES = 40;

/** Every key starts with the subscription, like everywhere else (PE2). */
function partition(subscriptionId: SubscriptionId, vaultId: string): string {
  return `S#${subscriptionId.value}#VAULT#${vaultId}`;
}

export class DynamoLinkGraph implements LinkGraph {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(vaultId: string): string {
    return partition(this.subscriptionId, vaultId);
  }

  /**
   * Every page, not the first one. A Query answers at most 1 MB, and a vault
   * with a few thousand notes passes that easily: stopping at the first page
   * would silently hide half the graph, and the caller would have no way to
   * tell a small vault from a truncated answer.
   */
  private async query(vaultId: string, prefix: string): Promise<Item[]> {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response: {
        Items?: Record<string, unknown>[] | undefined;
        LastEvaluatedKey?: Record<string, unknown> | undefined;
      } = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.pk(vaultId), ':prefix': prefix },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  private async put(items: Item[]): Promise<void> {
    for (let index = 0; index < items.length; index += 25) {
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: items
              .slice(index, index + 25)
              .map((item) => ({ PutRequest: { Item: item } })),
          },
        }),
      );
    }
  }

  private async remove(vaultId: string, sortKeys: string[]): Promise<void> {
    for (let index = 0; index < sortKeys.length; index += 25) {
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: sortKeys.slice(index, index + 25).map((sk) => ({
              DeleteRequest: { Key: { PK: this.pk(vaultId), SK: sk } },
            })),
          },
        }),
      );
    }
  }

  async replaceOutgoing(vaultId: string, note: NoteRef, links: LinkTarget[]): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: this.pk(vaultId), SK: `NOTE#${note.noteId}`, entity: 'GNOTE', ...note },
      }),
    );

    const existing = await this.query(vaultId, `OUT#${note.noteId}#`);
    const pending = await this.query(vaultId, 'PENDING#');
    await this.remove(vaultId, [
      ...existing.map((item) => String(item['SK'])),
      ...existing.map((item) => `IN#${String(item['toNoteId'])}#${note.noteId}`),
      ...pending
        .filter((item) => String(item['fromNoteId']) === note.noteId)
        .map((item) => String(item['SK'])),
    ]);

    const notes = await this.query(vaultId, 'NOTE#');
    const bySlug = new Map(notes.map((item) => [String(item['slug']), item]));
    const writes: Item[] = [];

    for (const link of links) {
      const target = bySlug.get(link.slug);
      const targetId = target ? String(target['noteId']) : null;
      if (targetId && targetId !== note.noteId) {
        // The edge is written in BOTH directions, so a backlink is a Query
        // rather than a scan.
        writes.push(
          {
            PK: this.pk(vaultId),
            SK: `OUT#${note.noteId}#${targetId}`,
            entity: 'EDGE',
            fromNoteId: note.noteId,
            toNoteId: targetId,
          },
          {
            PK: this.pk(vaultId),
            SK: `IN#${targetId}#${note.noteId}`,
            entity: 'EDGE',
            fromNoteId: note.noteId,
            toNoteId: targetId,
          },
        );
      } else if (!targetId) {
        writes.push({
          PK: this.pk(vaultId),
          SK: `PENDING#${link.slug}#${note.noteId}`,
          entity: 'PENDING',
          fromNoteId: note.noteId,
          slug: link.slug,
        });
      }
    }
    await this.put(writes);
  }

  async removeNote(vaultId: string, noteId: string): Promise<void> {
    const noteItem = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(vaultId), SK: `NOTE#${noteId}` },
      }),
    );
    const slug = noteItem.Item ? String(noteItem.Item['slug']) : null;

    const outgoing = await this.query(vaultId, `OUT#${noteId}#`);
    const incoming = await this.query(vaultId, `IN#${noteId}#`);

    await this.remove(vaultId, [
      `NOTE#${noteId}`,
      ...outgoing.map((item) => String(item['SK'])),
      ...outgoing.map((item) => `IN#${String(item['toNoteId'])}#${noteId}`),
      ...incoming.map((item) => String(item['SK'])),
      ...incoming.map((item) => `OUT#${String(item['fromNoteId'])}#${noteId}`),
    ]);

    if (slug) {
      // The backlinks that pointed here go back to pending (RN-DSC-005).
      await this.put(
        incoming.map((item) => ({
          PK: this.pk(vaultId),
          SK: `PENDING#${slug}#${String(item['fromNoteId'])}`,
          entity: 'PENDING',
          fromNoteId: String(item['fromNoteId']),
          slug,
        })),
      );
    }
  }

  async resolvePending(vaultId: string, note: NoteRef): Promise<number> {
    const waiting = await this.query(vaultId, `PENDING#${note.slug}#`);
    if (waiting.length === 0) return 0;

    await this.put(
      waiting.flatMap((item) => {
        const from = String(item['fromNoteId']);
        if (from === note.noteId) return [];
        return [
          {
            PK: this.pk(vaultId),
            SK: `OUT#${from}#${note.noteId}`,
            entity: 'EDGE',
            fromNoteId: from,
            toNoteId: note.noteId,
          },
          {
            PK: this.pk(vaultId),
            SK: `IN#${note.noteId}#${from}`,
            entity: 'EDGE',
            fromNoteId: from,
            toNoteId: note.noteId,
          },
        ];
      }),
    );
    await this.remove(
      vaultId,
      waiting.map((item) => String(item['SK'])),
    );
    return waiting.length;
  }

  async dependencyTree(
    vaultId: string,
    rootNoteId: string,
    depth: number,
  ): Promise<GraphNode | null> {
    const notes = new Map(
      (await this.query(vaultId, 'NOTE#')).map((item) => [
        String(item['noteId']),
        {
          noteId: String(item['noteId']),
          title: String(item['title']),
          slug: String(item['slug']),
          folderId: String(item['folderId']),
        },
      ]),
    );
    const root = notes.get(rootNoteId);
    if (!root) return null;

    const seen = new Set([rootNoteId]);
    let budget = GRAPH_LIMITS.maxNodes;

    const walk = async (note: NoteRef, level: number): Promise<GraphNode> => {
      if (level >= depth || budget <= 0) return { note, depth: level, children: [] };
      const edges = await this.query(vaultId, `OUT#${note.noteId}#`);
      const children: GraphNode[] = [];
      for (const edge of edges) {
        const targetId = String(edge['toNoteId']);
        if (seen.has(targetId) || budget <= 0) continue;
        const target = notes.get(targetId);
        if (!target) continue;
        seen.add(targetId);
        budget -= 1;
        children.push(await walk(target, level + 1));
      }
      return { note, depth: level, children };
    };

    return walk(root, 0);
  }

  async backlinks(vaultId: string, noteId: string): Promise<NoteRef[]> {
    const incoming = await this.query(vaultId, `IN#${noteId}#`);
    const notes = new Map(
      (await this.query(vaultId, 'NOTE#')).map((item) => [String(item['noteId']), item]),
    );
    return incoming
      .map((edge) => notes.get(String(edge['fromNoteId'])))
      .filter((item): item is Item => item !== undefined)
      .map((item) => ({
        noteId: String(item['noteId']),
        title: String(item['title']),
        slug: String(item['slug']),
        folderId: String(item['folderId']),
      }));
  }

  async broken(vaultId: string): Promise<BrokenLink[]> {
    const pending = await this.query(vaultId, 'PENDING#');
    const notes = new Map(
      (await this.query(vaultId, 'NOTE#')).map((item) => [String(item['noteId']), item]),
    );
    return pending
      .map((item) => {
        const from = notes.get(String(item['fromNoteId']));
        return from
          ? {
              fromNote: {
                noteId: String(from['noteId']),
                title: String(from['title']),
                slug: String(from['slug']),
                folderId: String(from['folderId']),
              },
              targetSlug: String(item['slug']),
            }
          : null;
      })
      .filter((link): link is BrokenLink => link !== null);
  }

  async orphans(vaultId: string, allNotes: NoteRef[]): Promise<NoteRef[]> {
    const edges = await this.query(vaultId, 'OUT#');
    const linked = new Set(
      edges.flatMap((edge) => [String(edge['fromNoteId']), String(edge['toNoteId'])]),
    );
    return allNotes.filter((note) => !linked.has(note.noteId));
  }

  /**
   * Three prefix queries in ONE partition, which is the whole reason the
   * projection is keyed by vault: the graph of a vault is a scan of its own
   * partition and never reaches another one.
   */
  async wholeGraph(vaultId: string): Promise<VaultGraph> {
    const noteItems = await this.query(vaultId, 'NOTE#');
    const truncated = noteItems.length > GRAPH_LIMITS.maxVaultNodes;
    const kept = truncated ? noteItems.slice(0, GRAPH_LIMITS.maxVaultNodes) : noteItems;

    const nodes: NoteRef[] = kept.map((item) => ({
      noteId: String(item['noteId']),
      title: String(item['title']),
      slug: String(item['slug']),
      folderId: String(item['folderId']),
    }));
    const indexOf = new Map(nodes.map((note, index) => [note.noteId, index]));

    // An edge with either end outside the ceiling is dropped: it would index
    // past the end of `nodes`, and a dangling index is worse than a lost edge.
    const edges: Array<[number, number]> = [];
    for (const item of await this.query(vaultId, 'OUT#')) {
      const from = indexOf.get(String(item['fromNoteId']));
      const to = indexOf.get(String(item['toNoteId']));
      if (from !== undefined && to !== undefined) edges.push([from, to]);
    }

    const pending: Array<{ from: number; targetSlug: string }> = [];
    for (const item of await this.query(vaultId, 'PENDING#')) {
      const from = indexOf.get(String(item['fromNoteId']));
      if (from !== undefined) pending.push({ from, targetSlug: String(item['slug']) });
    }

    return { nodes, edges, pending, truncated };
  }
}


export class DynamoFacetIndex implements FacetIndex {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(vaultId: string): string {
    return partition(this.subscriptionId, vaultId);
  }

  async replaceFacets(
    vaultId: string,
    noteId: string,
    facets: FacetSnapshot | null,
  ): Promise<void> {
    const previous = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(vaultId), SK: `FACET#${noteId}` },
      }),
    );
    const before = (previous.Item?.['facets'] as FacetSnapshot | undefined) ?? null;
    const changes = facetDelta(before, facets);

    // One transaction: the new portrait plus the deltas of the counters it
    // moved, in the same shape as the folder counters of section 10.3.
    const items: Array<Record<string, unknown>> = [
      facets === null
        ? {
            Delete: {
              TableName: this.tableName,
              Key: { PK: this.pk(vaultId), SK: `FACET#${noteId}` },
            },
          }
        : {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: this.pk(vaultId),
                SK: `FACET#${noteId}`,
                entity: 'FACET',
                noteId,
                facets,
              },
            },
          },
      ...changes.slice(0, 90).map((change) => ({
        Update: {
          TableName: this.tableName,
          Key: { PK: this.pk(vaultId), SK: `STAT#${change.facet}#${change.value}` },
          UpdateExpression: 'ADD #count :delta SET #kind = :kind, facet = :facet, #value = :value',
          ExpressionAttributeNames: { '#count': 'count', '#kind': 'kind', '#value': 'value' },
          ExpressionAttributeValues: {
            ':delta': change.delta,
            ':kind': change.kind,
            ':facet': change.facet,
            ':value': change.value,
          },
        },
      })),
    ];

    await this.db.send(new TransactWriteCommand({ TransactItems: items as never }));

    for (const facet of new Set(changes.map((change) => change.facet))) {
      await this.enforceCardinality(vaultId, facet);
    }
  }

  /** The cardinality ceiling is the free-text detector (RN-DSC-024). */
  private async enforceCardinality(vaultId: string, facet: string): Promise<void> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(vaultId), ':prefix': `STAT#${facet}#` },
      }),
    );
    const values = (response.Items ?? []) as Item[];
    if (values.length <= MAX_DISTINCT_VALUES) return;

    for (const item of values) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(vaultId), SK: String(item['SK']) },
        }),
      );
    }
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(vaultId), SK: `FDEF#${facet}` },
        UpdateExpression: 'SET discarded = :yes, facet = :facet',
        ExpressionAttributeValues: { ':yes': true, ':facet': facet },
      }),
    );
  }

  async vaultFacetStats(vaultId: string): Promise<FacetStats> {
    const [stats, definitions, portraits] = await Promise.all([
      this.query(vaultId, 'STAT#'),
      this.query(vaultId, 'FDEF#'),
      this.query(vaultId, 'FACET#'),
    ]);

    const grouped = new Map<
      string,
      { kind: string; values: Array<{ value: string; count: number }> }
    >();
    for (const item of stats) {
      const facet = String(item['facet']);
      const entry = grouped.get(facet) ?? { kind: String(item['kind'] ?? 'enum'), values: [] };
      entry.values.push({ value: String(item['value']), count: Number(item['count'] ?? 0) });
      grouped.set(facet, entry);
    }

    return {
      noteCount: portraits.length,
      facets: [
        ...[...grouped.entries()].map(([facet, entry]) => ({
          facet,
          kind: entry.kind as FacetStats['facets'][number]['kind'],
          values: entry.values.sort((left, right) => right.count - left.count),
          discarded: false,
        })),
        ...definitions
          .filter((item) => item['discarded'] === true)
          .map((item) => ({
            facet: String(item['facet']),
            kind: 'enum' as const,
            values: [],
            discarded: true,
          })),
      ],
    };
  }

  private async query(vaultId: string, prefix: string): Promise<Item[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(vaultId), ':prefix': prefix },
      }),
    );
    return (response.Items ?? []) as Item[];
  }
}

/** The local projection of the vault shape, so the prefix costs no query. */
export class DynamoStructureProjection implements StructureProjection {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(vaultId: string): string {
    return partition(this.subscriptionId, vaultId);
  }

  async get(vaultId: string): Promise<VaultStructure | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(vaultId), ':prefix': 'S' },
      }),
    );
    const items = (response.Items ?? []) as Item[];
    const meta = items.find((item) => item['SK'] === 'STRUCT');
    if (!meta) return null;

    return {
      vaultId,
      vaultName: String(meta['vaultName'] ?? ''),
      folders: new Map(
        items
          .filter((item) => String(item['SK']).startsWith('SFOLDER#'))
          .map((item) => [
            String(item['folderId']),
            {
              name: String(item['name']),
              description: String(item['description']),
              parentFolderId: item['parentFolderId'] ? String(item['parentFolderId']) : null,
            },
          ]),
      ),
    };
  }

  async upsertVault(vaultId: string, name: string): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(vaultId), SK: 'STRUCT' },
        UpdateExpression: 'SET vaultName = :name, entity = :entity',
        ExpressionAttributeValues: { ':name': name, ':entity': 'STRUCT' },
      }),
    );
  }

  async upsertFolder(
    vaultId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(vaultId),
          SK: `SFOLDER#${folder.folderId}`,
          entity: 'SFOLDER',
          ...folder,
        },
      }),
    );
  }

  async removeFolders(vaultId: string, folderIds: string[]): Promise<void> {
    for (const folderId of folderIds) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(vaultId), SK: `SFOLDER#${folderId}` },
        }),
      );
    }
  }
}
