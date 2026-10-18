/**
 * Rebuilding the link projection of every notebook, after 0.6.0 is deployed
 * (#102).
 *
 * Every projection of this service is derived and rebuildable from zero (PE5),
 * and this is that answer for the link graph — the same answer `StorageRecount`
 * is for the storage counter, and it exists for the same reason: the one in the
 * table was built by a rule that has just retired. A link resolved against a
 * slug that folded case, accents and punctuation; it now resolves against the
 * name a note states, exactly, and against the aliases it declares. Every
 * edge in the table is an assertion the current rule never made.
 *
 * So it is not repaired, it is rebuilt: the edges are forgotten, what the notebook
 * answers to is restated from the notes, and the ordinary write path resolves
 * every target again. An edge then exists because the new rule says so, and
 * not because an old projection said so.
 *
 * **The check after a run is not equality.** Any note carrying `aliases:`
 * starts answering targets that no name matched (RN-DSC-052), which under the
 * retired rule resolved to nothing at all. So the expectation is that NO EDGE
 * IS LOST, and that every edge gained is one an alias explains — which is why
 * the report below names each gained edge together with the target that
 * produced it and whether a name or an alias answered.
 *
 * WHY THIS IS NOT A ROUTE, and why it reads the table rather than the API: a
 * platform session carries no subscription, so no repository can be built
 * under it (INV-12, RN-SUB-016) and rebuilding every account cannot be an
 * authenticated operation at all. It also writes nothing a person authored —
 * a projection has no author — so unlike the retitling migration it owes
 * nothing to the audit trail. It runs as maintenance, against the tables,
 * under IAM.
 */

import { QueryCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { noteName, SubscriptionId } from '@memorysmithapp/kernel';

import { extractReferences } from '../domain/LinkExtractor.js';
import { extractFrontmatterAliases } from '../domain/Aliases.js';
import { resolveReference, notebookNames } from '../domain/LinkResolver.js';
import type { LinkTarget, NoteRef } from '../domain/ports.js';
import type { ContentReader } from '../application/projections.js';
import type { DynamoLinkGraph } from './aws.js';

/** `S#{subscriptionId}#NOTEBOOK#{notebookId}`, which is where a note item lives. */
const NOTEBOOK_PARTITION = /^S#([^#]+)#NOTEBOOK#(.+)$/;

export interface ReprojectionDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly knowledgeTable: string;
  /** Every projection is built per subscription, like every repository (PE2). */
  readonly graphFor: (subscriptionId: SubscriptionId) => DynamoLinkGraph;
  readonly contentFor: (subscriptionId: SubscriptionId) => ContentReader;
}

/** One note, as the rebuild reads it: what it answers to and what it points at. */
export interface ReadNote extends NoteRef {
  /** Each with the form it was written in, which decides what it reaches (#305). */
  readonly targets: readonly LinkTarget[];
}

/** An edge, and the target that produced it. */
export interface PlannedEdge {
  readonly from: string;
  readonly to: string;
  readonly target: string;
  readonly by: 'name' | 'alias';
}

/** What one notebook held, what it will hold, and the difference between them. */
export interface NotebookPlan {
  readonly subscriptionId: string;
  readonly notebookId: string;
  readonly notes: readonly ReadNote[];
  /**
   * The names of the files the notebook keeps, read from the table that keeps
   * them (#185). Until 0.6.2 no `FileKept` reached this projection in AWS, so
   * every notebook that kept a file before it holds no `ATTACH#` item at all.
   */
  readonly files: readonly string[];
  readonly before: number;
  readonly after: readonly PlannedEdge[];
  /** Edges the new rule finds and the old projection did not hold. */
  readonly gained: readonly PlannedEdge[];
  /** Edges the old projection held and the new rule does not find. */
  readonly lost: ReadonlyArray<{ from: string; to: string }>;
  readonly pending: number;
}

const edgeKey = (edge: { from: string; to: string }): string => `${edge.from} -> ${edge.to}`;

/**
 * One edge per pair, however many targets point along it (§5.4).
 *
 * `resolveAll` answers one entry per TARGET, because the report names the
 * target that produced each edge — and a note reaching one note by its name
 * and by a spelling of it, which is how anybody writes about a source they
 * quote, produces two entries for one edge. Counting them as two made a
 * healthy notebook report a difference no rebuild could ever close, and a
 * difference nobody can close is a report nobody reads (#163).
 *
 * The first entry of a pair is kept, and `resolveAll` walks the targets in
 * the order the note wrote them.
 */
export function distinctEdges(edges: readonly PlannedEdge[]): PlannedEdge[] {
  const found = new Map<string, PlannedEdge>();
  for (const edge of edges) {
    if (!found.has(edgeKey(edge))) found.set(edgeKey(edge), edge);
  }
  return [...found.values()];
}

/**
 * The subscription a note item belongs to, read off the partition it sits in.
 *
 * `fromClaim` is the only door into the type and it is named after where the
 * value legitimately comes from — never a path, a query or a body. This is
 * neither: it is the key the product itself wrote, read back the way every
 * repository reads its own items back, and it is the only thing this job could
 * possibly trust, since no session is involved at all.
 */
function subscriptionOf(raw: string): SubscriptionId {
  const parsed = SubscriptionId.fromClaim(raw);
  if (!parsed.ok) throw new Error(`Not a subscription identifier: ${raw}`);
  return parsed.value;
}

/** A notebook the rebuild reaches, by the partition its notes sit in. */
export interface NotebookAddress {
  readonly subscriptionId: string;
  readonly notebookId: string;
}

/** What one partition holds, as the rebuild decides what is live in it. */
interface HeldPartition {
  notes: Array<Record<string, unknown>>;
  files: string[];
  folders: Set<string>;
  deleted: boolean;
}

const emptyPartition = (): HeldPartition => ({
  notes: [],
  files: [],
  folders: new Set<string>(),
  deleted: false,
});

/** Sorts one item into what its partition holds. */
function hold(held: HeldPartition, item: Record<string, unknown>): void {
  if (item['entity'] === 'NOTEBOOK') {
    if (item['deletedAt']) held.deleted = true;
    return;
  }
  if (item['entity'] === 'FOLDER') {
    held.folders.add(String(item['folderId']));
    return;
  }
  // A deleted note takes no part in the graph, exactly as its delete
  // event took it out (RN-DSC-013), and a deleted file answers nothing.
  if (item['deletedAt']) return;
  if (item['entity'] === 'FILE') held.files.push(String(item['name']));
  else held.notes.push(item);
}

/**
 * What of a partition is live, or null when nothing in it takes part in a graph.
 *
 * **Live is decided the way Knowledge decides it**, by inheritance
 * (RN-KNW-046): deleting a notebook writes its `META` item and nothing under
 * it, and removing a folder takes the folder and leaves its notes as they
 * were, so a note with no `deletedAt` of its own may still be gone — and the
 * purge destroys its bytes. Reading only the note's own mark made the rebuild
 * of staging stop at the first such note, on a version the store no longer
 * holds. A note is live when it, its notebook and its folder are. A notebook
 * that keeps files and no note yet is included, since the note written
 * tomorrow resolves against them.
 */
function liveOf(
  held: HeldPartition,
): { notes: Array<Record<string, unknown>>; files: string[] } | null {
  if (held.deleted) return null;
  const notes = held.notes.filter((note) => held.folders.has(String(note['folderId'])));
  if (notes.length === 0 && held.files.length === 0) return null;
  return { notes, files: held.files };
}

const ENTITIES = {
  FilterExpression: '#entity IN (:note, :file, :folder, :notebook)',
  ExpressionAttributeValues: {
    ':note': 'NOTE',
    ':file': 'FILE',
    ':folder': 'FOLDER',
    ':notebook': 'NOTEBOOK',
  },
} as const;

/**
 * The rebuild, split by notebook (#311): the graph of a notebook is rebuilt
 * from that notebook alone, so a run lists the notebooks once and plans and
 * writes each one on its own, wherever and in whatever order it is run.
 */
export class LinkReprojection {
  constructor(private readonly deps: ReprojectionDependencies) {}

  /**
   * Every live notebook of every subscription.
   *
   * A Scan, deliberately, and for the reason the recount scans: there is no
   * index that lists notebooks, and inventing one to serve a maintenance job
   * would put a cost on every write to save a job that runs by hand. It
   * projects only what decides whether a notebook is live; its notes are read
   * again, whole, by the plan of each one.
   */
  async notebooks(): Promise<NotebookAddress[]> {
    const byPartition = new Map<string, HeldPartition>();
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.deps.db.send(
        new ScanCommand({
          TableName: this.deps.knowledgeTable,
          ...ENTITIES,
          ExpressionAttributeNames: { '#entity': 'entity' },
          ProjectionExpression: 'PK, #entity, folderId, deletedAt',
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of page.Items ?? []) {
        const partition = String(item['PK'] ?? '');
        if (!NOTEBOOK_PARTITION.test(partition)) continue;
        const held = byPartition.get(partition) ?? emptyPartition();
        byPartition.set(partition, held);
        hold(held, item);
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    const addresses: NotebookAddress[] = [];
    for (const [partition, held] of byPartition) {
      if (!liveOf(held)) continue;
      const match = NOTEBOOK_PARTITION.exec(partition);
      addresses.push({
        subscriptionId: subscriptionOf(match?.[1] ?? '').value,
        notebookId: match?.[2] ?? '',
      });
    }
    return addresses;
  }

  /**
   * What one notebook will hold, worked out without writing anything, or null
   * when it stopped being live between the listing and now.
   *
   * The after-state is computed here with the same two functions the adapter
   * resolves with, so the report and the write cannot disagree about what the
   * rule says: what differs is only who performs it.
   */
  async planNotebook(address: NotebookAddress): Promise<NotebookPlan | null> {
    const subscriptionId = subscriptionOf(address.subscriptionId);
    const live = await this.partition(subscriptionId, address.notebookId);
    if (!live) return null;

    const read = await this.readNotes(subscriptionId, live.notes);
    const after = resolveAll(read, live.files);
    const before = await this.deps.graphFor(subscriptionId).currentEdges(address.notebookId);
    const edges = distinctEdges(after.edges);

    const held = new Set(before.map(edgeKey));
    const found = new Set(edges.map(edgeKey));
    return {
      subscriptionId: subscriptionId.value,
      notebookId: address.notebookId,
      notes: read,
      files: live.files,
      before: before.length,
      after: edges,
      gained: edges.filter((edge) => !held.has(edgeKey(edge))),
      lost: before.filter((edge) => !found.has(edgeKey(edge))),
      pending: after.pending,
    };
  }

  /**
   * Writes one notebook's plan: the edges are forgotten, what the notebook answers to
   * is restated, and every note is re-resolved by the ordinary write path.
   *
   * The last step is deliberately the product's own code and not a shortcut
   * that writes the computed edges directly. A rebuild that took its own path
   * to the table would be a second implementation of the projection, and the
   * day the two disagreed the rebuild would be the one nobody tested.
   */
  async apply(plan: NotebookPlan): Promise<void> {
    const graph = this.deps.graphFor(subscriptionOf(plan.subscriptionId));
    // The note item carries what the notebook ANSWERS to and nothing else: the
    // targets belong to this plan, not to the projection.
    const refs = plan.notes.map(({ noteId, name, aliases, folderId }): NoteRef => ({
      noteId,
      name,
      aliases,
      folderId,
    }));
    await graph.forgetLinks(plan.notebookId);
    await graph.seedNotes(plan.notebookId, refs);
    // No link is left and every spelling is indexed: from here on the partition
    // is in the layout every write below keeps whole, and each note is answered
    // from what is keyed under it instead of from the whole notebook (#328).
    await graph.markIndexed(plan.notebookId);
    await graph.seedAttachments(plan.notebookId, plan.files);
    for (const note of plan.notes) {
      const { targets, ...ref } = note;
      await graph.replaceOutgoing(plan.notebookId, ref, [...targets]);
    }
  }

  /** The live notes and kept files of one notebook, read from its own partition. */
  private async partition(
    subscriptionId: SubscriptionId,
    notebookId: string,
  ): Promise<{ notes: Array<Record<string, unknown>>; files: string[] } | null> {
    const held = emptyPartition();
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await this.deps.db.send(
        new QueryCommand({
          TableName: this.deps.knowledgeTable,
          KeyConditionExpression: 'PK = :pk',
          ...ENTITIES,
          ExpressionAttributeNames: { '#entity': 'entity', '#name': 'name' },
          ExpressionAttributeValues: {
            ...ENTITIES.ExpressionAttributeValues,
            ':pk': `S#${subscriptionId.value}#NOTEBOOK#${notebookId}`,
          },
          ProjectionExpression: 'PK, #entity, noteId, folderId, bodyRef, #name, deletedAt',
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of page.Items ?? []) hold(held, item);
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return liveOf(held);
  }

  /** What each note is called, answers to and points at, read from its bytes. */
  private async readNotes(
    subscriptionId: SubscriptionId,
    items: ReadonlyArray<Record<string, unknown>>,
  ): Promise<ReadNote[]> {
    const content = this.deps.contentFor(subscriptionId);
    const notes: ReadNote[] = [];
    for (const item of items) {
      const ref = item['bodyRef'] as { contentId?: string; versionId?: string } | undefined;
      const markdown =
        ref?.contentId && ref.versionId
          ? await content.read({ contentId: ref.contentId, versionId: ref.versionId })
          : '';
      notes.push({
        noteId: String(item['noteId']),
        folderId: String(item['folderId']),
        name: noteName(markdown) ?? '',
        aliases: extractFrontmatterAliases(markdown),
        targets: extractReferences(markdown),
      });
    }
    return notes;
  }
}

/**
 * Every edge the current rule finds in a notebook, and how many targets found
 * none. It is exported because it is where the whole difference between the
 * two rules lands, and the difference is what the report is about.
 */
export function resolveAll(
  notes: readonly ReadNote[],
  files: readonly string[] = [],
): { edges: PlannedEdge[]; pending: number } {
  const names = notebookNames(
    notes.map((note) => ({ ...note, name: note.name || null })),
    [...files],
  );
  const edges: PlannedEdge[] = [];
  let pending = 0;

  for (const note of notes) {
    for (const { name: target, form } of note.targets) {
      const answer = resolveReference(target, names, form);
      if (answer.kind === 'pending') {
        pending += 1;
        continue;
      }
      if (answer.kind !== 'note' || answer.by === null) continue;
      // Every note whose name matches is an edge (RN-DSC-042), and a note
      // never links to itself.
      for (const to of answer.noteIds) {
        if (to === note.noteId) continue;
        edges.push({ from: note.noteId, to, target, by: answer.by });
      }
    }
  }
  return { edges, pending };
}

/**
 * What the rebuild of one notebook answers, in identifiers and counts only:
 * the answer travels through the history of a run and lands in its summary,
 * and neither may carry what a note is called.
 */
export interface NotebookOutcome extends NotebookAddress {
  readonly notes: number;
  readonly files: number;
  readonly before: number;
  readonly after: number;
  readonly gained: number;
  /** Of the edges gained, the ones an alias answered and no name did. */
  readonly gainedByAlias: number;
  readonly lost: ReadonlyArray<{ from: string; to: string }>;
  readonly pending: number;
}

/** A notebook whose rebuild kept failing after its retries. */
export interface NotebookFailure extends NotebookAddress {
  readonly failed: true;
  readonly error: string;
}

/**
 * A notebook that stopped being live between the listing and its turn, which
 * is not a failure: there is no graph left to rebuild.
 */
export interface NotebookGone extends NotebookAddress {
  readonly gone: true;
}

export type NotebookResult = NotebookOutcome | NotebookFailure | NotebookGone;

export function outcomeOf(plan: NotebookPlan): NotebookOutcome {
  return {
    subscriptionId: plan.subscriptionId,
    notebookId: plan.notebookId,
    notes: plan.notes.length,
    files: plan.files.length,
    before: plan.before,
    after: plan.after.length,
    gained: plan.gained.length,
    gainedByAlias: plan.gained.filter((edge) => edge.by === 'alias').length,
    lost: plan.lost.map(({ from, to }) => ({ from, to })),
    pending: plan.pending,
  };
}

/** What a whole run found, summed from the answer of every notebook. */
export interface RunSummary {
  readonly mode: 'report' | 'apply';
  readonly notebooks: number;
  readonly rebuilt: number;
  readonly gone: number;
  readonly notes: number;
  readonly files: number;
  readonly edgesBefore: number;
  readonly edgesAfter: number;
  readonly gained: number;
  readonly gainedByAlias: number;
  readonly lost: number;
  readonly pending: number;
  /** Every notebook that gained or lost an edge, so the report names where the difference is. */
  readonly changed: ReadonlyArray<NotebookAddress & { gained: number; lost: number }>;
  readonly lostEdges: ReadonlyArray<NotebookAddress & { from: string; to: string }>;
  readonly failed: readonly NotebookFailure[];
  /**
   * A run is good when no notebook failed and no edge was lost. A lost edge is
   * not a reason to refuse the rebuild — the projection was already wrong —
   * but it IS the one number whoever ran it has to look at.
   */
  readonly good: boolean;
}

export function summarise(
  mode: 'report' | 'apply',
  results: readonly NotebookResult[],
): RunSummary {
  const outcomes = results.filter(
    (result): result is NotebookOutcome => !('failed' in result) && !('gone' in result),
  );
  const failed = results.filter((result): result is NotebookFailure => 'failed' in result);
  const sum = (pick: (outcome: NotebookOutcome) => number): number =>
    outcomes.reduce((total, outcome) => total + pick(outcome), 0);
  const lost = sum((outcome) => outcome.lost.length);
  return {
    mode,
    notebooks: results.length,
    rebuilt: outcomes.length,
    gone: results.length - outcomes.length - failed.length,
    notes: sum((outcome) => outcome.notes),
    files: sum((outcome) => outcome.files),
    edgesBefore: sum((outcome) => outcome.before),
    edgesAfter: sum((outcome) => outcome.after),
    gained: sum((outcome) => outcome.gained),
    gainedByAlias: sum((outcome) => outcome.gainedByAlias),
    lost,
    pending: sum((outcome) => outcome.pending),
    changed: outcomes
      .filter((outcome) => outcome.gained > 0 || outcome.lost.length > 0)
      .map(({ subscriptionId, notebookId, gained, lost: edges }) => ({
        subscriptionId,
        notebookId,
        gained,
        lost: edges.length,
      })),
    lostEdges: outcomes.flatMap(({ subscriptionId, notebookId, lost: edges }) =>
      edges.map((edge) => ({ subscriptionId, notebookId, ...edge })),
    ),
    failed: failed.map(({ subscriptionId, notebookId, error }) => ({
      subscriptionId,
      notebookId,
      failed: true as const,
      error,
    })),
    good: failed.length === 0 && lost === 0,
  };
}
