/**
 * Recount of the stored bytes of every subscription (RN-SUB-021), and of what
 * fills them, by kind and by notebook (RN-SUB-024).
 *
 * The counters are maintained by the outbox relay, one delta at a time and
 * outside the user transaction (section 10.3). That makes them DERIVED
 * numbers, and every derived number in this system owes an answer to the same
 * question: how is it rebuilt when it is wrong or was never built (PE5)? This
 * is that answer for the storage counters, and the one way of recounting them.
 *
 * It is needed at least once for real, twice now: the total started existing
 * after the notebooks did, so every subscription written before it began at
 * zero while holding a notebook full of notes; and the split by kind and by
 * notebook started existing after the total, so every subscription written
 * before it holds a total the split does not add up to. It is also the repair
 * for the ordinary ways a delta can be lost — a stream record dropped past its
 * retries, a relay bug — and it costs nothing to keep around.
 *
 * WHY THIS IS NOT A ROUTE. A platform session carries no subscription, so no
 * Knowledge repository can be built under it (PE12, RN-SUB-016): an
 * administrator CANNOT read another account's notes, by construction, and that
 * is a guarantee rather than an inconvenience to work around. Recounting every
 * account therefore cannot be an authenticated operation at all. It runs as
 * maintenance, against the table, under IAM.
 *
 * WHAT IT COUNTS is what RN-SUB-021 defines as live content, and nothing else:
 * the current revision of every note that is not deleted, every file that is
 * not deleted, and each guidance and each template. A notebook that was
 * deleted still holds its bytes until the purge completes, which is both the
 * rule and the truth: the space is given back when the content stops existing,
 * not at the click (RN-KNW-047). Its folders and the notebook itself are
 * counted until then too, exactly as the relay counts them.
 *
 * WHAT IT DOES NOT COUNT, besides, is a file whose notebook is gone. Until
 * 0.7.0 the purge of a notebook left its files behind (#202): the item, the
 * guard of its name and the bytes, still counted against the quota by a
 * notebook that no longer exists. Nobody can reach such a file, so it is not
 * live content, and the recount leaves it out of every number and REPORTS it
 * instead (`orphanFiles`), without destroying anything: destroying content is
 * the purge's alone (rule 8), and nothing here holds a port that could.
 *
 * WHAT IT DOES NOT COUNT is the revisions: a revision is a version of an
 * object in the store, and listing those belongs to the purge alone (rule 8).
 * How many there are is a question for the trail, which names every one of
 * them, and the entrypoint that runs this job is where the two contexts meet
 * (`revisions` below).
 */

import {
  DeleteCommand,
  PutCommand,
  ScanCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import {
  EMPTY_NOTEBOOK_USAGE,
  type NotebookUsageCounters,
} from '../../domain/services/StorageUsage.js';
import { NOTEBOOK_USAGE_PREFIX } from '../outbound/dynamodb/keys.js';

export interface RecountDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
  /**
   * How many revisions each subscription keeps, when whoever runs the job can
   * say (RN-SUB-024). It is not Knowledge's to answer — the trail names every
   * revision — so it is handed in; without it the counter of revisions is left
   * as the relay kept it.
   */
  readonly revisions?: () => Promise<ReadonlyMap<string, number>>;
}

/** What one subscription turned out to be holding. */
export interface SubscriptionUsage {
  readonly subscriptionId: string;
  readonly storedBytes: number;
  readonly notes: number;
  readonly guidances: number;
  readonly templates: number;
  readonly noteBytes: number;
  readonly files: number;
  readonly fileBytes: number;
  readonly otherBytes: number;
  readonly folders: number;
  readonly notebooks: number;
  /**
   * From whoever could count them, or what the counter already held when
   * nobody could: a recount that cannot count revisions leaves them alone.
   */
  readonly revisions: number | null;
  /** What each notebook holds, by its identifier. */
  readonly byNotebook: ReadonlyMap<string, NotebookUsageCounters>;
  /** Lines the table holds for a notebook that no longer exists. */
  readonly stale: readonly string[];
  /**
   * Files left behind by the deletion of their notebook before the purge took
   * files with it (#202), by notebook: counted in nothing above, reported so
   * somebody can see what the store still holds for nobody.
   */
  readonly orphanFiles: ReadonlyArray<OrphanFiles>;
}

/** The files a notebook that no longer exists left behind. */
export interface OrphanFiles {
  readonly notebookId: string;
  readonly files: number;
  readonly bytes: number;
}

/** `S#{subscriptionId}#NOTEBOOK#{notebookId}` and `S#{subscriptionId}#NOTEBOOKS`. */
const SUBSCRIPTION_OF_KEY = /^S#([^#]+)#/;
const NOTEBOOK_OF_KEY = /^S#[^#]+#NOTEBOOK#([^#]+)$/;

/** Reads `bytes` off a serialized ContentRef, tolerating a missing pointer. */
function bytesOf(ref: unknown): number {
  if (typeof ref !== 'object' || ref === null) return 0;
  const bytes = Number((ref as Record<string, unknown>)['bytes']);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

interface Tally {
  noteBytes: number;
  notes: number;
  fileBytes: number;
  files: number;
  otherBytes: number;
  guidances: number;
  templates: number;
  folders: number;
  notebooks: Set<string>;
  byNotebook: Map<string, { bytes: number; notes: number; folders: number; files: number }>;
  lines: Set<string>;
  /**
   * The live files of each notebook, apart: whether their notebook still
   * exists is known only once the whole table was read.
   */
  filesByNotebook: Map<string, { files: number; bytes: number }>;
  /** What the counter held before, which is kept when nobody counts them. */
  revisions: number | null;
}

function emptyTally(): Tally {
  return {
    noteBytes: 0,
    notes: 0,
    fileBytes: 0,
    files: 0,
    otherBytes: 0,
    guidances: 0,
    templates: 0,
    folders: 0,
    notebooks: new Set(),
    byNotebook: new Map(),
    lines: new Set(),
    filesByNotebook: new Map(),
    revisions: null,
  };
}

export class StorageRecount {
  constructor(private readonly deps: RecountDependencies) {}

  /**
   * Walks the whole table once and returns what each subscription holds.
   *
   * A Scan, deliberately: there is no index that lists subscriptions, and
   * inventing one to serve a maintenance job would put a cost on every write
   * to save a job that runs by hand. It projects only the attributes it reads,
   * so the pages stay small.
   */
  async measure(): Promise<SubscriptionUsage[]> {
    const totals = new Map<string, Tally>();
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await this.deps.db.send(
        new ScanCommand({
          TableName: this.deps.tableName,
          ProjectionExpression:
            'PK, SK, entity, bodyRef, contentRef, deletedAt, notebookId, revisions',
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      for (const item of page.Items ?? []) {
        const key = String(item['PK'] ?? '');
        const subscriptionId = SUBSCRIPTION_OF_KEY.exec(key)?.[1];
        if (!subscriptionId) continue;

        const current = totals.get(subscriptionId) ?? emptyTally();
        const notebookId = NOTEBOOK_OF_KEY.exec(key)?.[1] ?? '';
        const line = (): { bytes: number; notes: number; folders: number; files: number } => {
          const found = current.byNotebook.get(notebookId) ?? { ...EMPTY_NOTEBOOK_USAGE };
          current.byNotebook.set(notebookId, found);
          return found;
        };

        switch (String(item['entity'] ?? '')) {
          case 'NOTEBOOK':
            // A deleted notebook waiting for its purge is still an item, and
            // still counted, exactly as the relay counts it (RN-KNW-047).
            if (notebookId) {
              current.notebooks.add(notebookId);
              line();
            }
            break;
          case 'FOLDER':
            current.folders += 1;
            if (notebookId) line().folders += 1;
            break;
          case 'NOTE': {
            // A deleted note is not live content and its bytes are not counted,
            // exactly as the delete event released them.
            if (item['deletedAt']) break;
            const bytes = bytesOf(item['bodyRef']);
            current.noteBytes += bytes;
            current.notes += 1;
            if (notebookId) {
              line().bytes += bytes;
              line().notes += 1;
            }
            break;
          }
          // A file deleted and waiting for its purge released its bytes at the
          // deletion (RN-KNW-051), as a note does.
          case 'FILE': {
            if (item['deletedAt']) break;
            const bytes = bytesOf(item['contentRef']);
            const files = current.filesByNotebook.get(notebookId) ?? { files: 0, bytes: 0 };
            files.files += 1;
            files.bytes += bytes;
            current.filesByNotebook.set(notebookId, files);
            break;
          }
          // A Guidance and a Template are items of their own since
          // RN-KNW-044, each pointing at its content with the same attribute.
          case 'GUIDANCE':
          case 'TEMPLATE': {
            const bytes = bytesOf(item['contentRef']);
            current.otherBytes += bytes;
            if (item['entity'] === 'GUIDANCE') current.guidances += 1;
            else current.templates += 1;
            if (notebookId) line().bytes += bytes;
            break;
          }
          case 'USAGE': {
            const held = Number(item['revisions']);
            current.revisions = Number.isFinite(held) && held > 0 ? held : null;
            break;
          }
          case 'NBUSAGE': {
            const sortKey = String(item['SK'] ?? '');
            if (sortKey.startsWith(NOTEBOOK_USAGE_PREFIX)) {
              current.lines.add(sortKey.slice(NOTEBOOK_USAGE_PREFIX.length));
            }
            break;
          }
          default:
            break;
        }

        totals.set(subscriptionId, current);
      }

      startKey = page.LastEvaluatedKey;
    } while (startKey);

    const revisions = this.deps.revisions ? await this.deps.revisions() : null;

    return [...totals.entries()]
      .map(([subscriptionId, t]) => {
        // The files are added only now, when it is known which notebooks
        // exist: the Scan reads items in no order, so a file may come before
        // the `META` of its notebook, or with no `META` at all to come.
        const orphanFiles: OrphanFiles[] = [];
        for (const [notebookId, files] of t.filesByNotebook) {
          if (notebookId && !t.notebooks.has(notebookId)) {
            orphanFiles.push({ notebookId, ...files });
            continue;
          }
          t.fileBytes += files.bytes;
          t.files += files.files;
          const line = t.byNotebook.get(notebookId);
          if (line) {
            line.bytes += files.bytes;
            line.files += files.files;
          }
        }
        // A line for a notebook whose items are all gone is left over, and a
        // line that exists only because of an item outside any notebook is
        // not a notebook at all.
        const byNotebook = new Map(
          [...t.byNotebook].filter(([notebookId]) => t.notebooks.has(notebookId)),
        );
        return {
          subscriptionId,
          storedBytes: t.noteBytes + t.fileBytes + t.otherBytes,
          notes: t.notes,
          guidances: t.guidances,
          templates: t.templates,
          noteBytes: t.noteBytes,
          files: t.files,
          fileBytes: t.fileBytes,
          otherBytes: t.otherBytes,
          folders: t.folders,
          notebooks: t.notebooks.size,
          revisions: revisions ? (revisions.get(subscriptionId) ?? 0) : t.revisions,
          byNotebook,
          stale: [...t.lines].filter((notebookId) => !byNotebook.has(notebookId)).sort(),
          orphanFiles: orphanFiles.sort((left, right) =>
            left.notebookId.localeCompare(right.notebookId),
          ),
        };
      })
      .sort((left, right) => right.storedBytes - left.storedBytes);
  }

  /**
   * Writes what was measured, replacing the counters instead of adding to
   * them, and removes the lines of notebooks that are gone.
   *
   * A write landing DURING the scan can be counted by the scan and applied by
   * the relay as well, and this Put then drops the relay's delta. The error is
   * bounded by what was written while the job ran and is corrected by the next
   * recount; the alternative, reconciling against a moving number, is not more
   * correct, only more elaborate. Run it when the account is quiet.
   */
  async apply(usage: readonly SubscriptionUsage[]): Promise<void> {
    const now = new Date().toISOString();
    for (const each of usage) {
      const partition = `S#${each.subscriptionId}#NOTEBOOKS`;
      const revisions = each.revisions;
      await this.deps.db.send(
        new PutCommand({
          TableName: this.deps.tableName,
          Item: {
            PK: partition,
            SK: 'USAGE',
            entity: 'USAGE',
            storedBytes: each.storedBytes,
            // What fills it, by kind (RN-SUB-024), under the names the relay
            // adds into.
            notebooks: each.notebooks,
            folders: each.folders,
            noteCount: each.notes,
            noteBytes: each.noteBytes,
            fileCount: each.files,
            fileBytes: each.fileBytes,
            otherCount: each.guidances + each.templates,
            otherBytes: each.otherBytes,
            ...(revisions === null ? {} : { revisions }),
            updatedAt: now,
            /** Says these numbers came from a recount and not from the relay. */
            recountedAt: now,
          },
        }),
      );
      for (const [notebookId, line] of each.byNotebook) {
        await this.deps.db.send(
          new PutCommand({
            TableName: this.deps.tableName,
            Item: {
              PK: partition,
              SK: `${NOTEBOOK_USAGE_PREFIX}${notebookId}`,
              entity: 'NBUSAGE',
              notebookId,
              ...line,
              updatedAt: now,
              recountedAt: now,
            },
          }),
        );
      }
      for (const notebookId of each.stale) {
        await this.deps.db.send(
          new DeleteCommand({
            TableName: this.deps.tableName,
            Key: { PK: partition, SK: `${NOTEBOOK_USAGE_PREFIX}${notebookId}` },
          }),
        );
      }
    }
  }
}
