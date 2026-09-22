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
 * and, in a partition of the subscription and not of a notebook, because a note
 * keeps its identifier when it moves between notebooks:
 *
 *   S#{s}#PROJECTED / NOTE#{noteId}   the version of the note last projected (#141)
 *
 * A counter item per value, and not a single statistics item, for the same
 * reason the META rule exists: fifty notes written in parallel increment
 * different items instead of queuing behind one (PE8).
 *
 * The content index is the TEXT# item, and it is deliberately not an inverted
 * index. CHUNK# items held one embedded vector each and were removed in 0.2.0:
 * they cost 14 KB apiece, ten times the note itself, and scoring them meant
 * reading all of them on every query. TEXT# costs about what the note costs,
 * and every search is measured, because nothing bounds the notebook any more
 * but the storage of its subscription (RN-KNW-010, RN-DSC-027).
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
import { Instant, ulid, type SubscriptionId } from '@memorysmith/kernel';
import type {
  PendingLink,
  OutgoingTarget,
  ScanMeter,
  ProjectedNote,
  ProjectedVersions,
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

/**
 * Every item of a partition whose sort key begins with one of these prefixes,
 * deleted. It is what a notebook deletion does to each projection: the notebook
 * is gone and everything under it with it, so there is nothing to recompute,
 * only bytes to stop paying for (RN-KNW-047).
 *
 * The keys are read in pages and deleted in batches of twenty-five, the two
 * limits DynamoDB imposes, so a notebook of any size is swept whole.
 */
async function sweep(
  db: DynamoDBDocumentClient,
  tableName: string,
  pk: string,
  prefixes: readonly string[],
): Promise<void> {
  for (const prefix of prefixes) {
    let startKey: Record<string, unknown> | undefined;
    do {
      const response: {
        Items?: Record<string, unknown>[] | undefined;
        LastEvaluatedKey?: Record<string, unknown> | undefined;
      } = await db.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': pk, ':prefix': prefix },
          ProjectionExpression: 'SK',
          /**
           * What was written a moment ago is exactly what a deletion must not
           * miss. A `Query` that has not caught up answers fewer items than
           * exist, and what it did not answer is never deleted: nothing walks
           * these again, because what named them is gone (#152).
           */
          ConsistentRead: true,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      const keys = ((response.Items ?? []) as Item[]).map((item) => String(item['SK']));
      for (const batch of chunk(keys, 25)) {
        await db.send(
          new BatchWriteCommand({
            RequestItems: {
              [tableName]: batch.map((SK) => ({ DeleteRequest: { Key: { PK: pk, SK } } })),
            },
          }),
        );
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey);
  }
}

/**
 * The version each note was last projected at. The claim is ONE conditional
 * write, so two projectors racing for one note cannot both believe they are
 * the newest: DynamoDB settles it.
 */
/**
 * How long the marker of a DELETED note is kept. It is what stops an event of
 * that note, delivered late, from projecting it back into the search
 * (#141) — so it has to outlive every delivery it defends against, and no
 * longer: one per note ever deleted, in a single partition, with nothing to
 * collect them, is a partition that grows for ever (#147).
 *
 * The queue of the projector retains a message for fourteen days, and a message
 * moved to its dead letter queue may be redriven within fourteen more, so
 * thirty days covers the latest arrival the system can produce, with room to
 * spare. A marker of a note still in use carries no deadline: it is replaced by
 * every write of that note.
 */
const GONE_MARKER_TTL_DAYS = 30;
export class DynamoProjectedVersions implements ProjectedVersions {
  constructor(
    private readonly subscriptionId: SubscriptionId,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private key(noteId: string): Item {
    return { PK: `S#${this.subscriptionId.value}#PROJECTED`, SK: `NOTE#${noteId}` };
  }

  async claim(noteId: string, state: ProjectedNote): Promise<boolean> {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...this.key(noteId),
            entity: 'PROJECTED',
            noteId,
            ...state,
            ...(state.gone
              ? { ttl: Instant.now().plusDays(GONE_MARKER_TTL_DAYS).toEpochSeconds() }
              : {}),
          },
          ConditionExpression: 'attribute_not_exists(SK) OR version < :version',
          ExpressionAttributeValues: { ':version': state.version },
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async current(noteId: string): Promise<ProjectedNote | null> {
    const response = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: this.key(noteId), ConsistentRead: true }),
    );
    const item = response.Item as Item | undefined;
    if (!item) return null;
    return {
      version: Number(item['version']),
      notebookId: String(item['notebookId']),
      folderId: String(item['folderId']),
      contentRef: (item['contentRef'] as ProjectedNote['contentRef']) ?? null,
      gone: Boolean(item['gone']),
    };
  }
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
  /**
   * `consistent` is for the walks of a DELETION and for nothing else: an edge
   * written a moment before is one this must not miss, and what it misses
   * nothing walks again (#152). A read that answers a person stays eventual,
   * where consistency costs double and buys nothing.
   */
  private async query(notebookId: string, prefix: string, consistent = false): Promise<Item[]> {
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
          ...(consistent ? { ConsistentRead: true } : {}),
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return items;
  }

  /**
   * A batch write of this projection, and the ONE place a key is made unique
   * (#163).
   *
   * An edge is keyed by the pair it joins and never by the target that was
   * written, which is what §5.4 asks for: one edge per pair, however many
   * links point along it. So two targets of one note that reach one note — a
   * name and an alias of it, the ordinary way to write about a source you are
   * quoting — build the same key twice, and **DynamoDB refuses a batch
   * carrying a key twice, whole**. Every link of that note was lost, the ones
   * that had nothing to do with the repetition included.
   *
   * It is deduplicated here rather than in each caller because four different
   * places build these items, and each of them could produce the pair again.
   */
  private async put(items: Item[]): Promise<void> {
    const unique = new Map(items.map((item) => [`${String(item['SK'])}`, item]));
    for (const batch of chunk([...unique.values()], 25)) {
      await this.writeAll(batch.map((item) => ({ PutRequest: { Item: item } })));
    }
  }

  private async remove(notebookId: string, sortKeys: string[]): Promise<void> {
    for (const batch of chunk([...new Set(sortKeys)], 25)) {
      await this.writeAll(
        batch.map((sk) => ({ DeleteRequest: { Key: { PK: this.pk(notebookId), SK: sk } } })),
      );
    }
  }

  /**
   * A batch write, sent again until DynamoDB has taken every request of it.
   *
   * A throttled batch answers `UnprocessedItems` rather than an error, so
   * ignoring it loses edges in silence — which is what this projection did
   * where the content index already retried.
   */
  private async writeAll(requests: Array<Record<string, unknown>>): Promise<void> {
    let pending = requests;
    for (let attempt = 0; pending.length > 0 && attempt < 8; attempt++) {
      const answer = await this.db.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: pending as never } }),
      );
      pending = (answer.UnprocessedItems?.[this.tableName] as Array<Record<string, unknown>>) ?? [];
      if (pending.length > 0)
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
    if (pending.length > 0) {
      throw new Error(`The link graph left ${pending.length} writes unprocessed`);
    }
  }

  /**
   * The targets of one note, out of the projection alone and never out of its
   * content (rule 5): an `OUT#` edge is a target by name, under the name of the
   * note it reaches; an `ALIAS#` item turns that edge into a target by alias,
   * under the name the link wrote; a `PENDING#` item is a target that reaches
   * nothing yet (RN-AGT-034).
   */
  async outgoingOf(notebookId: string, noteId: string): Promise<OutgoingTarget[]> {
    const [edges, aliases, pending, noteItems, attachments] = await Promise.all([
      this.query(notebookId, `OUT#${noteId}#`),
      this.query(notebookId, 'ALIAS#'),
      this.query(notebookId, 'PENDING#'),
      this.query(notebookId, 'NOTE#'),
      this.attachmentsOf(notebookId),
    ]);
    const kept = new Set(attachments.map((name) => name.normalize('NFC')));
    const notes = new Map(
      noteItems.map((item) => [
        String(item['noteId']),
        {
          noteId: String(item['noteId']),
          name: String(item['name'] ?? ''),
          aliases: (item['aliases'] as string[]) ?? [],
          folderId: String(item['folderId'] ?? ''),
        } satisfies NoteRef,
      ]),
    );
    const byAlias = new Map(
      aliases
        .filter((item) => String(item['fromNoteId']) === noteId)
        .map((item) => [String(item['toNoteId']), String(item['name'])]),
    );

    const targets = new Map<string, { by: 'name' | 'alias'; notes: NoteRef[] }>();
    for (const edge of edges) {
      const to = notes.get(String(edge['toNoteId']));
      if (!to) continue;
      const alias = byAlias.get(to.noteId);
      const target = alias ?? to.name;
      const entry = targets.get(target) ?? { by: alias ? 'alias' : 'name', notes: [] };
      entry.notes.push(to);
      targets.set(target, entry);
    }
    return [
      ...[...targets].map(([target, entry]) => ({
        target,
        kind: 'note' as const,
        by: entry.by,
        notes: entry.notes,
      })),
      // A target no note answers may still be a FILE the notebook keeps: it
      // renders, it is no edge, and it is not nothing (§5.8, #166).
      ...pending
        .filter((item) => String(item['fromNoteId']) === noteId)
        .map((item) => {
          const target = String(item['name']);
          return {
            target,
            kind: kept.has(target.normalize('NFC'))
              ? ('attachment' as const)
              : ('pending' as const),
            by: null,
            notes: [],
          };
        }),
    ];
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
    const stale = [
      ...existing.map((item) => String(item['SK'])),
      ...existing.map((item) => `IN#${String(item['toNoteId'])}#${note.noteId}`),
      ...pending
        .filter((item) => String(item['fromNoteId']) === note.noteId)
        .map((item) => String(item['SK'])),
      ...aliasEdges
        .filter((item) => String(item['fromNoteId']) === note.noteId)
        .map((item) => String(item['SK'])),
    ];

    const names = this.namesOf(
      await this.query(notebookId, 'NOTE#'),
      await this.attachmentsOf(notebookId),
    );
    const writes: Item[] = [];

    /**
     * The notes this note reaches BY NAME, which is what decides whether an
     * edge may be marked as held by an alias below: an edge a name also
     * reaches is not the alias's to lose (RN-DSC-053).
     */
    const byName = new Set<string>();
    for (const link of links) {
      const answer = resolveTarget(link.name, names);
      if (answer.kind === 'note' && answer.by === 'name') {
        for (const targetId of answer.noteIds) byName.add(targetId);
      }
    }

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
          if (answer.by === 'alias' && !byName.has(targetId)) {
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
      } else {
        /**
         * A target NO NOTE answers is written as pending whether or not a file
         * of that name is kept today, and the file is decided when it is read
         * (#185). An attachment renders and is never an edge (RN-DSC-044), and
         * which names are files changes on its own: `FileKept` and
         * `FileDeleted` write only the `ATTACH#` item and rewrite no note. So
         * deciding it here froze the answer at the instant of the write — a
         * note written before its picture was kept stayed pending for ever,
         * and one written after it was never pending again once the picture
         * was deleted. The in-memory graph resolves on every read, and this is
         * the same answer.
         */
        writes.push({
          PK: this.pk(notebookId),
          SK: `PENDING#${link.name}#${note.noteId}`,
          entity: 'PENDING',
          fromNoteId: note.noteId,
          name: link.name,
        });
      }
    }

    /**
     * Written first, and only then is what is no longer there taken away
     * (#163). It used to delete first, so a write that failed left the note
     * with NO edges instead of with the ones it had — and the retry cannot
     * repair that, because the projected version was claimed before applying:
     * only a later write of that note would have.
     */
    await this.put(writes);
    const written = new Set(writes.map((item) => String(item['SK'])));
    await this.remove(
      notebookId,
      stale.filter((sk) => !written.has(sk)),
    );
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

  /**
   * What the notebook answers to, out of the items it already holds: the names
   * of its notes, the spellings they declare, and the names of the files it
   * keeps (#166).
   */
  private namesOf(items: Item[], attachments: string[] = []) {
    return notebookNames(
      items.map((item) => ({
        noteId: String(item['noteId']),
        name: item['name'] === undefined ? null : String(item['name']),
        aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
      })),
      attachments,
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

    const outgoing = await this.query(notebookId, `OUT#${noteId}#`, true);
    const incoming = await this.query(notebookId, `IN#${noteId}#`, true);
    /**
     * The targets of the note that reached nothing, and the marks on the edges
     * an alias answered for. Neither is keyed by the note, so neither comes out
     * of a prefix query: they are found by the note they belong to. They used
     * to be left behind, and a `PENDING#` whose source is gone is invisible to
     * every reader — a listing and a backlink both join against the `NOTE#`
     * item — which is how it went unnoticed and stored for ever.
     */
    const mine = (item: Item): boolean =>
      String(item['fromNoteId']) === noteId || String(item['toNoteId']) === noteId;
    const pending = (await this.query(notebookId, 'PENDING#', true)).filter(mine);
    const aliasEdges = (await this.query(notebookId, 'ALIAS#', true)).filter(mine);

    await this.remove(notebookId, [
      `NOTE#${noteId}`,
      ...outgoing.map((item) => String(item['SK'])),
      ...outgoing.map((item) => `IN#${String(item['toNoteId'])}#${noteId}`),
      ...incoming.map((item) => String(item['SK'])),
      ...incoming.map((item) => `OUT#${String(item['fromNoteId'])}#${noteId}`),
      ...pending.map((item) => String(item['SK'])),
      ...aliasEdges.map((item) => String(item['SK'])),
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

  async removeNotebook(notebookId: string): Promise<void> {
    await sweep(this.db, this.tableName, this.pk(notebookId), [
      'NOTE#',
      'OUT#',
      'IN#',
      'PENDING#',
      'ALIAS#',
    ]);
  }

  /**
   * The links that were waiting for this note, turned into edges: §5.5 says a
   * pending link resolves on its own when a note carrying that name **or that
   * alias** is later written.
   *
   * The alias half was missing, so a note written under an alias somebody had
   * already linked left that link pending until its source was rewritten. An
   * alias only ever answers what no name did, so a pending target a note is
   * NAMED after is never taken by an alias: those pending items are gone by
   * the time this runs, taken by the name (§5.2, step 8).
   */
  async resolvePending(notebookId: string, note: NoteRef): Promise<number> {
    if (note.name.length > 0) await this.takeBackFromAliases(notebookId, note);

    const byName =
      note.name.length === 0 ? [] : await this.query(notebookId, `PENDING#${note.name}#`);
    const byAlias: Array<{ item: Item; alias: string }> = [];
    for (const alias of note.aliases ?? []) {
      if (alias.length === 0) continue;
      for (const item of await this.query(notebookId, `PENDING#${alias}#`)) {
        byAlias.push({ item, alias });
      }
    }
    const waiting = [...byName, ...byAlias.map((each) => each.item)];
    if (waiting.length === 0) return 0;

    const edgeFrom = (from: string): Item[] => [
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

    await this.put([
      ...byName.flatMap((item) => {
        const from = String(item['fromNoteId']);
        return from === note.noteId ? [] : edgeFrom(from);
      }),
      // An edge an alias answered for is marked, because a note written later
      // under that name takes it away (RN-DSC-053).
      ...byAlias.flatMap(({ item, alias }) => {
        const from = String(item['fromNoteId']);
        if (from === note.noteId) return [];
        return [
          ...edgeFrom(from),
          {
            PK: this.pk(notebookId),
            SK: `ALIAS#${alias}#${from}#${note.noteId}`,
            entity: 'ALIASEDGE',
            fromNoteId: from,
            toNoteId: note.noteId,
            name: alias,
          },
        ];
      }),
    ]);
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

  /**
   * The `PENDING#` items whose target no file answers either: what a reader
   * of the notebook calls a pending link (#185). A `PENDING#` item is a
   * target no NOTE answers, and whether a file does is asked here, at the
   * moment of reading, against the files kept now.
   */
  private async unanswered(notebookId: string): Promise<Item[]> {
    const [pending, attachments] = await Promise.all([
      this.query(notebookId, 'PENDING#'),
      this.attachmentsOf(notebookId),
    ]);
    const kept = new Set(attachments.map((name) => name.normalize('NFC')));
    return pending.filter((item) => !kept.has(String(item['name']).normalize('NFC')));
  }

  /** The names of the files the notebook keeps (#166). */
  async attachmentsOf(notebookId: string): Promise<string[]> {
    return (await this.query(notebookId, 'ATTACH#')).map((item) => String(item['name']));
  }

  async keepAttachment(notebookId: string, name: string): Promise<void> {
    await this.put([{ PK: this.pk(notebookId), SK: `ATTACH#${name}`, entity: 'ATTACHMENT', name }]);
  }

  async forgetAttachment(notebookId: string, name: string): Promise<void> {
    await this.remove(notebookId, [`ATTACH#${name}`]);
  }

  async notesOf(notebookId: string): Promise<NoteRef[]> {
    return (await this.query(notebookId, 'NOTE#')).map((item) => ({
      noteId: String(item['noteId']),
      name: String(item['name'] ?? ''),
      aliases: Array.isArray(item['aliases']) ? (item['aliases'] as string[]) : [],
      folderId: String(item['folderId'] ?? ''),
    }));
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
    const pending = await this.unanswered(notebookId);
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
    for (const item of await this.unanswered(notebookId)) {
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
  /**
   * The files the notebook keeps, restated from the table that keeps them,
   * and the `ATTACH#` items of whatever is no longer kept taken away (#185).
   */
  async seedAttachments(notebookId: string, names: readonly string[]): Promise<void> {
    const live = new Set(names);
    const stale = (await this.query(notebookId, 'ATTACH#'))
      .map((item) => String(item['SK']))
      .filter((sk) => !live.has(sk.slice('ATTACH#'.length)));
    await this.remove(notebookId, stale);
    await this.put(
      names.map((name) => ({
        PK: this.pk(notebookId),
        SK: `ATTACH#${name}`,
        entity: 'ATTACHMENT',
        name,
      })),
    );
  }

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

  async removeNotebook(notebookId: string): Promise<void> {
    await sweep(this.db, this.tableName, this.pk(notebookId), ['FACET#', 'STAT#', 'FDEF#']);
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
 * How much text one part of a portrait carries, in UTF-16 code units. A
 * DynamoDB item holds 400 KB, and a code unit is at most three bytes in UTF-8
 * (a pair of them, four), so 60,000 units stay under 180 KB with room for the
 * key and the attribute names. A note holds 1 MB (RN-KNW-025) and its portrait
 * holds the body twice, so the largest note becomes about thirty-five parts.
 */
const PART_UNITS = 60_000;

/**
 * Cuts a string into pieces of at most `size` code units, never between the
 * two halves of a surrogate pair: the pieces joined are the string, byte for
 * byte, which is what keeps the positions the excerpt is cut by (§11.2).
 */
export function partsOf(text: string, size = PART_UNITS): string[] {
  const parts: string[] = [];
  let at = 0;
  while (at < text.length) {
    let cut = Math.min(at + size, text.length);
    const last = text.charCodeAt(cut - 1);
    if (cut < text.length && last >= 0xd800 && last <= 0xdbff) cut -= 1;
    parts.push(text.slice(at, cut));
    at = cut;
  }
  return parts.length === 0 ? [''] : parts;
}

/**
 * The content index over `mv-discovery`. A note is a HEAD item and its PARTS:
 *
 *   TEXT#{noteId}                            name, folder, headings, facets, and
 *                                            which generation of parts is whole
 *   TEXT#{noteId}#{generation}#N{nnnn}       the normalized body, in order
 *   TEXT#{noteId}#{generation}#O{nnnn}       the body as written, in order
 *
 * It used to be one item carrying the body twice, and a DynamoDB item holds
 * 400 KB: a note past about 200 KB never reached the search, and one that grew
 * past it kept answering from the revision before (#135).
 *
 * A rewrite puts the parts of a NEW generation first and the head last, so the
 * head only ever names parts that are all there; the parts of the generation it
 * replaced go afterwards. A reader follows the head: a note whose parts are not
 * all there is never answered as if it were whole.
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
    const generation = ulid();
    const normalized = partsOf(note.normalized);
    const original = partsOf(note.original);
    const part = (kind: 'N' | 'O', index: number) =>
      `TEXT#${note.noteId}#${generation}#${kind}${String(index).padStart(4, '0')}`;

    // 1. The parts, each an item of its own and none of them the head.
    const writes = [
      ...normalized.map((text, index) => ({ SK: part('N', index), text })),
      ...original.map((text, index) => ({ SK: part('O', index), text })),
    ];
    for (const batch of chunk(writes, 25)) {
      await this.writeAll(
        batch.map((each) => ({
          PutRequest: {
            Item: {
              PK: this.pk(notebookId),
              SK: each.SK,
              entity: 'text-part',
              noteId: note.noteId,
              text: each.text,
            },
          },
        })),
      );
    }

    // 2. The head, which is what makes this generation the one a search reads.
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
          facets: note.facets,
          aliases: note.aliases ?? [],
          facetKinds: note.facetKinds ?? {},
          generation,
          normalizedParts: normalized.length,
          originalParts: original.length,
        },
      }),
    );

    // 3. What the head no longer names.
    await this.removeParts(notebookId, note.noteId, generation);
  }

  async removeNote(notebookId: string, noteId: string): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: this.pk(notebookId), SK: `TEXT#${noteId}` },
      }),
    );
    await this.removeParts(notebookId, noteId, null);
  }

  async removeNotebook(notebookId: string): Promise<void> {
    await sweep(this.db, this.tableName, this.pk(notebookId), ['TEXT#']);
  }

  async scanNotebook(notebookId: string, meter?: ScanMeter): Promise<IndexedNote[]> {
    const heads: Item[] = [];
    const parts = new Map<string, string>();
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
          ...(meter ? { ReturnConsumedCapacity: 'TOTAL' } : {}),
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      if (meter) {
        meter.readUnits += Number(
          (response as { ConsumedCapacity?: { CapacityUnits?: number } }).ConsumedCapacity
            ?.CapacityUnits ?? 0,
        );
      }
      for (const item of (response.Items ?? []) as Item[]) {
        if (meter) {
          meter.items += 1;
          meter.bytes += Buffer.byteLength(JSON.stringify(item), 'utf8');
        }
        if (item['entity'] === 'text-part') parts.set(String(item['SK']), String(item['text']));
        else heads.push(item);
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey);

    const notes: IndexedNote[] = [];
    for (const item of heads) {
      const body = this.bodyOf(item, parts);
      // A head whose parts are not all there is a rewrite in flight or a
      // failed one, and answering from half a body would be a search that
      // claims to be whole and is not.
      if (!body) continue;
      notes.push({
        noteId: String(item['noteId']),
        name: String(item['name'] ?? ''),
        folderId: String(item['folderId'] ?? ''),
        folderName: String(item['folderName'] ?? ''),
        sections: (item['sections'] as string[]) ?? [],
        normalized: body.normalized,
        original: body.original,
        facets: (item['facets'] as Record<string, string[]>) ?? {},
        aliases: (item['aliases'] as string[]) ?? [],
        facetKinds: (item['facetKinds'] as Record<string, string>) ?? {},
      });
    }
    return notes;
  }

  /** The body a head names, joined from its parts, or `null` when one is missing. */
  private bodyOf(
    head: Item,
    parts: Map<string, string>,
  ): { normalized: string; original: string } | null {
    // A head written before the portrait was split carries the body itself.
    if (head['generation'] === undefined) {
      return {
        normalized: String(head['normalized'] ?? ''),
        original: String(head['original'] ?? ''),
      };
    }
    const join = (kind: 'N' | 'O', count: number): string | null => {
      const pieces: string[] = [];
      for (let index = 0; index < count; index++) {
        const key = `TEXT#${String(head['noteId'])}#${String(head['generation'])}#${kind}${String(index).padStart(4, '0')}`;
        const piece = parts.get(key);
        if (piece === undefined) return null;
        pieces.push(piece);
      }
      return pieces.join('');
    };
    const normalized = join('N', Number(head['normalizedParts'] ?? 0));
    const original = join('O', Number(head['originalParts'] ?? 0));
    return normalized === null || original === null ? null : { normalized, original };
  }

  /** Every part of a note, or every part of a generation other than `keep`. */
  private async removeParts(
    notebookId: string,
    noteId: string,
    keep: string | null,
  ): Promise<void> {
    const stale: string[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response: {
        Items?: Record<string, unknown>[] | undefined;
        LastEvaluatedKey?: Record<string, unknown> | undefined;
      } = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.pk(notebookId), ':prefix': `TEXT#${noteId}#` },
          ProjectionExpression: 'SK',
          // The parts of a note that was just written are the ones a delete
          // must not miss, and nothing walks them again (#152).
          ConsistentRead: true,
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of (response.Items ?? []) as Item[]) {
        const sk = String(item['SK']);
        if (keep === null || !sk.startsWith(`TEXT#${noteId}#${keep}#`)) stale.push(sk);
      }
      startKey = response.LastEvaluatedKey;
    } while (startKey);

    for (const batch of chunk(stale, 25)) {
      await this.writeAll(
        batch.map((sk) => ({ DeleteRequest: { Key: { PK: this.pk(notebookId), SK: sk } } })),
      );
    }
  }

  /** A batch write, sent again until DynamoDB has taken every request of it. */
  private async writeAll(requests: Array<Record<string, unknown>>): Promise<void> {
    let pending = requests;
    for (let attempt = 0; pending.length > 0 && attempt < 8; attempt++) {
      const answer = await this.db.send(
        new BatchWriteCommand({ RequestItems: { [this.tableName]: pending as never } }),
      );
      pending = (answer.UnprocessedItems?.[this.tableName] as Array<Record<string, unknown>>) ?? [];
      if (pending.length > 0)
        await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
    }
    if (pending.length > 0) {
      throw new Error(`The content index left ${pending.length} writes unprocessed`);
    }
  }
}
