/**
 * AWS adapters of the Discovery projections, over mv-discovery
 * (architecture-guide.md, sections 11.1 and 11.3):
 *
 *   OUT#{from}#{to}         outgoing edge         IN#{to}#{from}   backlink
 *   PENDING#{name}#{from}  link waiting for its target to exist
 *   ALIAS#{name}#{from}#{to}  an edge that exists because an ALIAS matched,
 *                              and that a note carrying that name takes away
 *   FACET#{noteId}         the portrait of one note
 *   STAT#{facet}#{value}   one counter PER VALUE, never one item per notebook
 *   FDEF#{facet}           inferred kind, distinct count, discarded flag
 *   TEXT#{noteId}          the searchable portrait of one note
 *   STRUCT / SFOLDER#{id}  the local projection of the notebook shape
 *
 * A counter item per value, and not a single statistics item, for the same
 * reason the META rule exists: fifty notes written in parallel increment
 * different items instead of queuing behind one (PE8).
 *
 * The content index is the TEXT# item, and it is deliberately not an inverted
 * index. CHUNK# items held one embedded vector each and were removed in 0.2.0:
 * they cost 14 KB apiece, ten times the note itself, and scoring them meant
 * reading all of them on every query. TEXT# costs about what the note costs,
 * and the notebook ceiling of 2.000 notes (RN-KNW-010) keeps the scan bounded.
 */

import { resolveTarget, notebookNames } from '../domain/LinkResolver.js';
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
  PendingLink,
  ContentIndex,
  IndexedNote,
  FacetIndex,
  FacetStats,
  GraphNode,
  LinkGraph,
  LinkTarget,
  NoteRef,
  ResolvedTarget,
  NotebookGraph,
} from '../domain/ports.js';
import { GRAPH_LIMITS } from '../domain/ports.js';
import { facetDelta, valuesOf, type FacetSnapshot } from '../domain/FacetExtractor.js';
import type { StructureProjection, NotebookStructure } from '../application/projections.js';

type Item = Record<string, unknown>;

const MAX_DISTINCT_VALUES = 40;

/** What a single TransactWriteItems carries, per the DynamoDB service limit. */
const MAX_TRANSACTION_ITEMS = 100;

/** Splits a list into batches of at most `size`, keeping the order. */
function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let at = 0; at < items.length; at += size) batches.push(items.slice(at, at + size));
  return batches;
}

/** Every key starts with the subscription, like everywhere else (PE2). */
function partition(subscriptionId: SubscriptionId, notebookId: string): string {
  return `S#${subscriptionId.value}#NOTEBOOK#${notebookId}`;
}

export class DynamoLinkGraph implements LinkGraph {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(notebookId: string): string {
    return partition(this.subscriptionId, notebookId);
  }

  /**
   * Every page, not the first one. A Query answers at most 1 MB, and a notebook
   * with a few thousand notes passes that easily: stopping at the first page
   * would silently hide half the graph, and the caller would have no way to
   * tell a small notebook from a truncated answer.
   */
  private async query(notebookId: string, prefix: string): Promise<Item[]> {
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
          ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': prefix },
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

  private async remove(notebookId: string, sortKeys: string[]): Promise<void> {
    for (let index = 0; index < sortKeys.length; index += 25) {
      await this.db.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: sortKeys.slice(index, index + 25).map((sk) => ({
              DeleteRequest: { Key: { PK: this.pk(notebookId), SK: sk } },
            })),
          },
        }),
      );
    }
  }

  async replaceOutgoing(notebookId: string, note: NoteRef, links: LinkTarget[]): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { PK: this.pk(notebookId), SK: `NOTE#${note.noteId}`, entity: 'GNOTE', ...note },
      }),
    );

    const existing = await this.query(notebookId, `OUT#${note.noteId}#`);
    const pending = await this.query(notebookId, 'PENDING#');
    const aliasEdges = await this.query(notebookId, 'ALIAS#');
    await this.remove(notebookId, [
      ...existing.map((item) => String(item['SK'])),
      ...existing.map((item) => `IN#${String(item['toNoteId'])}#${note.noteId}`),
      ...pending
        .filter((item) => String(item['fromNoteId']) === note.noteId)
        .map((item) => String(item['SK'])),
      ...aliasEdges
        .filter((item) => String(item['fromNoteId']) === note.noteId)
        .map((item) => String(item['SK'])),
    ]);

    const names = this.namesOf(await this.query(notebookId, 'NOTE#'));
    const writes: Item[] = [];

    for (const link of links) {
      const answer = resolveTarget(link.name, names);
      if (answer.kind === 'note') {
        // Every note whose name matches becomes an edge (RN-DSC-042), so a
        // target carried by two notes writes two.
        for (const targetId of answer.noteIds) {
          if (targetId === note.noteId) continue;
          writes.push(...this.edgeItems(notebookId, note.noteId, targetId));
          // An edge that exists because an ALIAS matched is marked, because a
          // note written later under that name takes it away (RN-DSC-053).
          if (answer.by === 'alias') {
            writes.push({
              PK: this.pk(notebookId),
              SK: `ALIAS#${link.name}#${note.noteId}#${targetId}`,
              entity: 'ALIASEDGE',
              fromNoteId: note.noteId,
              toNoteId: targetId,
              name: link.name,
            });
          }
        }
      } else if (answer.kind === 'pending') {
        writes.push({
          PK: this.pk(notebookId),
          SK: `PENDING#${link.name}#${note.noteId}`,
          entity: 'PENDING',
          fromNoteId: note.noteId,
          name: link.name,
        });
      }
      // An attachment renders and is never an edge (RN-DSC-044).
    }
    await this.put(writes);
  }

  /** The edge, written in BOTH directions so a backlink is a Query. */
  private edgeItems(notebookId: string, fromNoteId: string, toNoteId: string): Item[] {
    return [
      {
        PK: this.pk(notebookId),
        SK: `OUT#${fromNoteId}#${toNoteId}`,
        entity: 'EDGE',
        fromNoteId,
        toNoteId,
      },
      {
        PK: this.pk(notebookId),
        SK: `IN#${toNoteId}#${fromNoteId}`,
        entity: 'EDGE',
        fromNoteId,
        toNoteId,
      },
    ];
  }

  /** What the notebook answers to, out of the note items it already holds. */
  private namesOf(items: Item[]) {
    return notebookNames(
      items.map((item) => ({
        noteId: String(item['noteId']),
        name: item['name'] === undefined ? null : String(item['name']),
        aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
      })),
    );
  }

  async removeNote(notebookId: string, noteId: string): Promise<void> {
    const noteItem = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: `NOTE#${noteId}` },
      }),
    );
    const name = noteItem.Item?.['name'] === undefined ? null : String(noteItem.Item['name']);

    const outgoing = await this.query(notebookId, `OUT#${noteId}#`);
    const incoming = await this.query(notebookId, `IN#${noteId}#`);

    await this.remove(notebookId, [
      `NOTE#${noteId}`,
      ...outgoing.map((item) => String(item['SK'])),
      ...outgoing.map((item) => `IN#${String(item['toNoteId'])}#${noteId}`),
      ...incoming.map((item) => String(item['SK'])),
      ...incoming.map((item) => `OUT#${String(item['fromNoteId'])}#${noteId}`),
    ]);

    if (name) {
      // The backlinks that pointed here go back to pending (RN-DSC-005) —
      // unless somebody's alias answers that name, in which case the link
      // lands there, which is the other half of resolution not being
      // monotonic (RN-DSC-053).
      const names = this.namesOf(await this.query(notebookId, 'NOTE#'));
      const answer = resolveTarget(name, names);
      const writes: Item[] = [];

      for (const item of incoming) {
        const from = String(item['fromNoteId']);
        if (answer.kind === 'note') {
          for (const toNoteId of answer.noteIds) {
            if (toNoteId === from) continue;
            writes.push(...this.edgeItems(notebookId, from, toNoteId), {
              PK: this.pk(notebookId),
              SK: `ALIAS#${name}#${from}#${toNoteId}`,
              entity: 'ALIASEDGE',
              fromNoteId: from,
              toNoteId,
              name,
            });
          }
        } else {
          writes.push({
            PK: this.pk(notebookId),
            SK: `PENDING#${name}#${from}`,
            entity: 'PENDING',
            fromNoteId: from,
            name,
          });
        }
      }
      await this.put(writes);
    }
  }

  async resolvePending(notebookId: string, note: NoteRef): Promise<number> {
    if (note.name.length > 0) await this.takeBackFromAliases(notebookId, note);

    const waiting =
      note.name.length === 0 ? [] : await this.query(notebookId, `PENDING#${note.name}#`);
    if (waiting.length === 0) return 0;

    await this.put(
      waiting.flatMap((item) => {
        const from = String(item['fromNoteId']);
        if (from === note.noteId) return [];
        return [
          {
            PK: this.pk(notebookId),
            SK: `OUT#${from}#${note.noteId}`,
            entity: 'EDGE',
            fromNoteId: from,
            toNoteId: note.noteId,
          },
          {
            PK: this.pk(notebookId),
            SK: `IN#${note.noteId}#${from}`,
            entity: 'EDGE',
            fromNoteId: from,
            toNoteId: note.noteId,
          },
        ];
      }),
    );
    await this.remove(
      notebookId,
      waiting.map((item) => String(item['SK'])),
    );
    return waiting.length;
  }

  /**
   * The edges somebody's alias was holding for this name, moved to the note
   * that owns it (RN-DSC-053).
   *
   * This is the invalidation path resolution stopped being monotonic for: the
   * edge disappears from a note nobody touched, whose own bytes did not
   * change, so nothing but this rewrites it.
   */
  private async takeBackFromAliases(notebookId: string, note: NoteRef): Promise<void> {
    const held = await this.query(notebookId, `ALIAS#${note.name}#`);
    if (held.length === 0) return;

    await this.remove(notebookId, [
      ...held.map((item) => String(item['SK'])),
      ...held.map((item) => `OUT#${String(item['fromNoteId'])}#${String(item['toNoteId'])}`),
      ...held.map((item) => `IN#${String(item['toNoteId'])}#${String(item['fromNoteId'])}`),
    ]);

    await this.put(
      held.flatMap((item) => {
        const from = String(item['fromNoteId']);
        return from === note.noteId ? [] : this.edgeItems(notebookId, from, note.noteId);
      }),
    );
  }

  async resolveTarget(notebookId: string, target: string): Promise<ResolvedTarget> {
    const items = await this.query(notebookId, 'NOTE#');
    const answer = resolveTarget(target, this.namesOf(items));
    const byId = new Map(items.map((item) => [String(item['noteId']), item]));
    return {
      target: answer.target,
      kind: answer.kind,
      by: answer.by,
      notes: answer.noteIds.flatMap((noteId) => {
        const item = byId.get(noteId);
        return item
          ? [
              {
                noteId,
                name: item['name'] === undefined ? '' : String(item['name']),
                aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
                folderId: String(item['folderId']),
              },
            ]
          : [];
      }),
    };
  }

  async dependencyTree(
    notebookId: string,
    rootNoteId: string,
    depth: number,
  ): Promise<GraphNode | null> {
    const notes = new Map(
      (await this.query(notebookId, 'NOTE#')).map((item) => [
        String(item['noteId']),
        {
          noteId: String(item['noteId']),
          name: item['name'] === undefined ? '' : String(item['name']),
          aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
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
      const edges = await this.query(notebookId, `OUT#${note.noteId}#`);
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

  async backlinks(notebookId: string, noteId: string): Promise<NoteRef[]> {
    const incoming = await this.query(notebookId, `IN#${noteId}#`);
    const notes = new Map(
      (await this.query(notebookId, 'NOTE#')).map((item) => [String(item['noteId']), item]),
    );
    return incoming
      .map((edge) => notes.get(String(edge['fromNoteId'])))
      .filter((item): item is Item => item !== undefined)
      .map((item) => ({
        noteId: String(item['noteId']),
        name: item['name'] === undefined ? '' : String(item['name']),
        aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
        folderId: String(item['folderId']),
      }));
  }

  async pending(notebookId: string): Promise<PendingLink[]> {
    const pending = await this.query(notebookId, 'PENDING#');
    const notes = new Map(
      (await this.query(notebookId, 'NOTE#')).map((item) => [String(item['noteId']), item]),
    );
    return pending
      .map((item) => {
        const from = notes.get(String(item['fromNoteId']));
        return from
          ? {
              fromNote: {
                noteId: String(from['noteId']),
                name: from['name'] === undefined ? '' : String(from['name']),
                aliases: Array.isArray(from['aliases']) ? (from['aliases'] as string[]) : [],
                folderId: String(from['folderId']),
              },
              targetName: String(item['name']),
            }
          : null;
      })
      .filter((link) => link !== null) as PendingLink[];
  }

  async orphans(notebookId: string, allNotes: NoteRef[]): Promise<NoteRef[]> {
    const edges = await this.query(notebookId, 'OUT#');
    const linked = new Set(
      edges.flatMap((edge) => [String(edge['fromNoteId']), String(edge['toNoteId'])]),
    );
    return allNotes.filter((note) => !linked.has(note.noteId));
  }

  /**
   * Three prefix queries in ONE partition, which is the whole reason the
   * projection is keyed by notebook: the graph of a notebook is a scan of its own
   * partition and never reaches another one.
   */
  async wholeGraph(notebookId: string): Promise<NotebookGraph> {
    const noteItems = await this.query(notebookId, 'NOTE#');
    const truncated = noteItems.length > GRAPH_LIMITS.maxNotebookNodes;
    const kept = truncated ? noteItems.slice(0, GRAPH_LIMITS.maxNotebookNodes) : noteItems;

    const nodes: NoteRef[] = kept.map((item) => ({
      noteId: String(item['noteId']),
      name: item['name'] === undefined ? '' : String(item['name']),
      aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
      folderId: String(item['folderId']),
    }));
    const indexOf = new Map(nodes.map((note, index) => [note.noteId, index]));

    // An edge with either end outside the ceiling is dropped: it would index
    // past the end of `nodes`, and a dangling index is worse than a lost edge.
    const edges: Array<[number, number]> = [];
    for (const item of await this.query(notebookId, 'OUT#')) {
      const from = indexOf.get(String(item['fromNoteId']));
      const to = indexOf.get(String(item['toNoteId']));
      if (from !== undefined && to !== undefined) edges.push([from, to]);
    }

    const pending: Array<{ from: number; targetName: string }> = [];
    for (const item of await this.query(notebookId, 'PENDING#')) {
      const from = indexOf.get(String(item['fromNoteId']));
      if (from !== undefined) pending.push({ from, targetName: String(item['name']) });
    }

    return { nodes, edges, pending, truncated };
  }

  /*
   * The three below exist for the reprojection (#102) and for nothing else.
   *
   * A projection is derived and rebuildable from zero (PE5), and the one in
   * this table was built by a rule that retired: rebuilding it means forgetting
   * every edge, restating what the notebook answers to, and letting the ordinary
   * write path decide the edges again. They are not on the LinkGraph port,
   * because the projector never needs them and a port is what a caller needs.
   */

  /** Every edge the notebook holds right now, for the before and after of a run. */
  async currentEdges(notebookId: string): Promise<Array<{ from: string; to: string }>> {
    return (await this.query(notebookId, 'OUT#')).map((item) => ({
      from: String(item['fromNoteId']),
      to: String(item['toNoteId']),
    }));
  }

  /**
   * Every edge, backlink, pending link and alias edge of the notebook, forgotten.
   *
   * The NOTE# items stay: they are what the notebook answers to, and the seeding
   * below restates them before a single edge is resolved. Deleting them here
   * would make the first note of the rebuild resolve against an empty notebook.
   */
  async forgetLinks(notebookId: string): Promise<void> {
    for (const prefix of ['OUT#', 'IN#', 'PENDING#', 'ALIAS#']) {
      const items = await this.query(notebookId, prefix);
      await this.remove(
        notebookId,
        items.map((item) => String(item['SK'])),
      );
    }
  }

  /**
   * What the notebook answers to, restated from the notes themselves, and the
   * note items of whatever is no longer there taken away.
   *
   * It runs before the edges are rebuilt so that every note resolves against
   * the whole notebook rather than against however much of it had been written by
   * the time its turn came.
   */
  async seedNotes(notebookId: string, notes: readonly NoteRef[]): Promise<void> {
    const live = new Set(notes.map((note) => note.noteId));
    const stale = (await this.query(notebookId, 'NOTE#'))
      .map((item) => String(item['SK']))
      .filter((sk) => !live.has(sk.slice('NOTE#'.length)));
    await this.remove(notebookId, stale);
    await this.put(
      notes.map((note) => ({
        PK: this.pk(notebookId),
        SK: `NOTE#${note.noteId}`,
        entity: 'GNOTE',
        ...note,
      })),
    );
  }
}

/** How many times a cancelled transaction of the facet projection is tried. */
const TRANSACTION_ATTEMPTS = 5;

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * DynamoDB cancels a transaction when one of its conditions fails and when
 * another transaction holds one of its items in flight, under this one name.
 */
function cancelled(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'TransactionCanceledException';
}

export class DynamoFacetIndex implements FacetIndex {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly sleep: (milliseconds: number) => Promise<void> = wait,
  ) {}

  private pk(notebookId: string): string {
    return partition(this.subscriptionId, notebookId);
  }

  async replaceFacets(
    notebookId: string,
    noteId: string,
    facets: FacetSnapshot | null,
  ): Promise<void> {
    const { changes, rest } = await this.committed(() =>
      this.writePortrait(notebookId, noteId, facets),
    );
    for (const batch of rest) {
      await this.committed(() =>
        this.db.send(new TransactWriteCommand({ TransactItems: batch as never })),
      );
    }

    for (const facet of new Set(changes.map((change) => change.facet))) {
      await this.enforceCardinality(notebookId, facet);
    }
  }

  /**
   * Two notes of one notebook that share a value move the same counter, and
   * under a burst their transactions meet. DynamoDB cancels one of them, which
   * is an ordinary answer and not a failure, yet it failed the whole batch back
   * to the queue, and the six minutes the queue hides a message for became the
   * reindexing delay of every note in that batch. A cancelled transaction is
   * tried again after a jittered pause, and only one still cancelled at the
   * last attempt fails.
   */
  private async committed<T>(transaction: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await transaction();
      } catch (error) {
        if (!cancelled(error) || attempt === TRANSACTION_ATTEMPTS) throw error;
        await this.sleep(Math.random() * 50 * 2 ** attempt);
      }
    }
  }

  /**
   * One attempt at the portrait of a note and the first counters it moves. A
   * delta is only exact against the portrait it replaces, so every attempt
   * reads the portrait again, consistently, and writes the new one only over
   * the revision it read: a projection of the same note that wrote in between
   * cancels this attempt, instead of both counting one change.
   */
  private async writePortrait(
    notebookId: string,
    noteId: string,
    facets: FacetSnapshot | null,
  ): Promise<{ changes: ReturnType<typeof facetDelta>; rest: Item[][] }> {
    const key = { PK: this.pk(notebookId), SK: `FACET#${noteId}` };
    const previous = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }),
    );
    const before = (previous.Item?.['facets'] as FacetSnapshot | undefined) ?? null;
    const changes = facetDelta(before, facets);

    const read = previous.Item?.['revision'];
    const unchanged = !previous.Item
      ? { ConditionExpression: 'attribute_not_exists(SK)' }
      : typeof read === 'number'
        ? {
            ConditionExpression: '#revision = :revision',
            ExpressionAttributeNames: { '#revision': 'revision' },
            ExpressionAttributeValues: { ':revision': read },
          }
        : {
            // A portrait written before a portrait carried its revision.
            ConditionExpression: 'attribute_exists(SK) AND attribute_not_exists(#revision)',
            ExpressionAttributeNames: { '#revision': 'revision' },
          };

    const portrait =
      facets === null
        ? { Delete: { TableName: this.tableName, Key: key, ...unchanged } }
        : {
            Put: {
              TableName: this.tableName,
              Item: {
                ...key,
                entity: 'FACET',
                noteId,
                facets,
                revision: (typeof read === 'number' ? read : 0) + 1,
              },
              ...unchanged,
            },
          };

    const counters = changes.map((change) => ({
      Update: {
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: `STAT#${change.facet}#${change.value}` },
        UpdateExpression: 'ADD #count :delta SET #kind = :kind, facet = :facet, #value = :value',
        ExpressionAttributeNames: { '#count': 'count', '#kind': 'kind', '#value': 'value' },
        ExpressionAttributeValues: {
          ':delta': change.delta,
          ':kind': change.kind,
          ':facet': change.facet,
          ':value': change.value,
        },
      },
    }));

    // The new portrait travels with the counters it moved, in the same shape
    // as the folder counters of section 10.3. A note whose frontmatter holds
    // more distinct values than one transaction carries used to have the tail
    // of its counters dropped without a word: the portrait was right and the
    // panel counting it was quietly short, forever, because the next write of
    // that note computes its delta against the portrait and finds nothing
    // owing. Every delta is applied now, in as many transactions as it takes.
    const [first, ...rest] = chunk(counters, MAX_TRANSACTION_ITEMS - 1);
    await this.db.send(
      new TransactWriteCommand({ TransactItems: [portrait, ...(first ?? [])] as never }),
    );
    return { changes, rest };
  }

  /** The cardinality ceiling is the free-text detector (RN-DSC-024). */
  private async enforceCardinality(notebookId: string, facet: string): Promise<void> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': `STAT#${facet}#` },
      }),
    );
    const values = (response.Items ?? []) as Item[];
    if (values.length <= MAX_DISTINCT_VALUES) return;

    for (const item of values) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(notebookId), SK: String(item['SK']) },
        }),
      );
    }
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: `FDEF#${facet}` },
        UpdateExpression: 'SET discarded = :yes, facet = :facet',
        ExpressionAttributeValues: { ':yes': true, ':facet': facet },
      }),
    );
  }

  /**
   * The portrait of every note, the same items `notebookFacetStats` counts, read
   * per note instead of aggregated. One prefix query in the partition the
   * graph already reads, which is why the graph can be colored by an attribute
   * without a second projection existing anywhere.
   */
  async notebookNoteFacets(notebookId: string): Promise<Map<string, Record<string, string[]>>> {
    const portraits = await this.query(notebookId, 'FACET#');
    return new Map(
      portraits.map((item) => [
        String(item['noteId']),
        valuesOf((item['facets'] as FacetSnapshot | undefined) ?? {}),
      ]),
    );
  }

  async notebookFacetStats(notebookId: string): Promise<FacetStats> {
    const [stats, definitions, portraits] = await Promise.all([
      this.query(notebookId, 'STAT#'),
      this.query(notebookId, 'FDEF#'),
      this.query(notebookId, 'FACET#'),
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

  /**
   * Every page, for the same reason the link graph walks every page: a Query
   * answers at most 1 MB, and the portrait of a note is not a small item. A
   * first-page answer would drop the facets of the notes the paging cut off,
   * and the graph would show an attribute on some of the notes that carry it,
   * which is worse than showing it on none.
   */
  private async query(notebookId: string, prefix: string): Promise<Item[]> {
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
          ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': prefix },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return items;
  }
}

/** The local projection of the notebook shape, so the prefix costs no query. */
export class DynamoStructureProjection implements StructureProjection {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(notebookId: string): string {
    return partition(this.subscriptionId, notebookId);
  }

  async get(notebookId: string): Promise<NotebookStructure | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': 'S' },
      }),
    );
    const items = (response.Items ?? []) as Item[];
    const meta = items.find((item) => item['SK'] === 'STRUCT');
    if (!meta) return null;

    return {
      notebookId,
      notebookName: String(meta['notebookName'] ?? ''),
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

  async upsertNotebook(notebookId: string, name: string): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: 'STRUCT' },
        UpdateExpression: 'SET notebookName = :name, entity = :entity',
        ExpressionAttributeValues: { ':name': name, ':entity': 'STRUCT' },
      }),
    );
  }

  async upsertFolder(
    notebookId: string,
    folder: { folderId: string; name: string; description: string; parentFolderId: string | null },
  ): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(notebookId),
          SK: `SFOLDER#${folder.folderId}`,
          entity: 'SFOLDER',
          ...folder,
        },
      }),
    );
  }

  async removeFolders(notebookId: string, folderIds: string[]): Promise<void> {
    for (const folderId of folderIds) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(notebookId), SK: `SFOLDER#${folderId}` },
        }),
      );
    }
  }

  /** The whole portrait of the notebook: its name and every folder of it. */
  async removeNotebook(notebookId: string): Promise<void> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': 'S' },
      }),
    );
    for (const item of (response.Items ?? []) as Item[]) {
      await this.db.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { PK: this.pk(notebookId), SK: String(item['SK']) },
        }),
      );
    }
  }
}

/**
 * The content index over `mv-discovery`, one item per note:
 *
 *   TEXT#{noteId}   the searchable portrait: name, folder, headings, the body
 *                   normalized for matching and the body as written for the excerpt
 *
 * The whole notebook is read on every search. That is affordable because the
 * product caps a notebook at 2.000 notes (RN-KNW-010), roughly 8 MB, and it is
 * far simpler than an inverted index that would need to stay in step with
 * every write.
 *
 * `scanNotebook` walks EVERY page. The search this one replaced answered from the
 * first megabyte and dropped the rest without a word, which in a notebook of 8 MB
 * meant deciding over an eighth of it. A partial scan that claims to be whole
 * is worse than no search, so the loop below is not an optimization detail: it
 * is the correctness of the feature.
 */
export class DynamoContentIndex implements ContentIndex {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(notebookId: string): string {
    return partition(this.subscriptionId, notebookId);
  }

  async replaceNote(notebookId: string, note: IndexedNote): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(notebookId),
          SK: `TEXT#${note.noteId}`,
          entity: 'text',
          noteId: note.noteId,
          name: note.name,
          folderId: note.folderId,
          folderName: note.folderName,
          sections: note.sections,
          normalized: note.normalized,
          original: note.original,
          facets: note.facets,
          aliases: note.aliases ?? [],
          facetKinds: note.facetKinds ?? {},
        },
      }),
    );
  }

  async removeNote(notebookId: string, noteId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: `TEXT#${noteId}` },
      }),
    );
  }

  async scanNotebook(notebookId: string): Promise<IndexedNote[]> {
    const notes: IndexedNote[] = [];
    let startKey: Record<string, unknown> | undefined;

    do {
      const response: {
        Items?: Record<string, unknown>[] | undefined;
        LastEvaluatedKey?: Record<string, unknown> | undefined;
      } = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': 'TEXT#' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      for (const item of (response.Items ?? []) as Item[]) {
        notes.push({
          noteId: String(item['noteId']),
          name: String(item['name'] ?? ''),
          folderId: String(item['folderId'] ?? ''),
          folderName: String(item['folderName'] ?? ''),
          sections: (item['sections'] as string[]) ?? [],
          normalized: String(item['normalized'] ?? ''),
          original: String(item['original'] ?? ''),
          facets: (item['facets'] as Record<string, string[]>) ?? {},
          // Absent on an item written before these were carried: the
          // search answers without them until the projection is rebuilt.
          aliases: (item['aliases'] as string[]) ?? [],
          facetKinds: (item['facetKinds'] as Record<string, string>) ?? {},
        });
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey);

    return notes;
  }
}
