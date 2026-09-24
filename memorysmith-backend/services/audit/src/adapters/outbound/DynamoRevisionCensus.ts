/**
 * How many revisions each subscription keeps, read off the trail (#197,
 * RN-SUB-024).
 *
 * The count the product shows is kept by the relay of Knowledge, a revision at
 * a time; this is how it is rebuilt when it is wrong or was never built (PE5).
 * It is answered HERE, from the trail, and not from the object store, because
 * a revision is a version of an object and listing those belongs to the purge
 * alone (rule 8). The trail names every revision anyway: each write of content
 * records the exact pair — the content and its version — it produced.
 *
 * A revision is kept while its content exists, so the census is every pair a
 * write named, less the contents a purge destroyed — which the trail also
 * names, one entry per unit, carrying the reference of what went. A purged
 * notebook took its whole trail with it (RN-AUD-011), and its revisions leave
 * the census with it, which is the truth: they were destroyed too.
 *
 * It runs as maintenance, against the table, under IAM, from the entrypoint
 * that recounts the storage: no session and no route reaches it.
 */

import { ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/** The entries whose reference is a revision somebody wrote. */
const WRITES = new Set(['NoteCreated', 'NoteUpdated', 'GuidanceUpdated', 'TemplateUpdated']);
/** The entries whose reference names content the purge destroyed. */
const PURGES = new Set(['NotePurged', 'GuidancePurged', 'TemplatePurged']);

function pairOf(ref: unknown): { contentId: string; versionId: string } | null {
  if (typeof ref !== 'object' || ref === null) return null;
  const record = ref as Record<string, unknown>;
  const contentId = typeof record['contentId'] === 'string' ? record['contentId'] : '';
  const versionId = typeof record['versionId'] === 'string' ? record['versionId'] : '';
  return contentId && versionId ? { contentId, versionId } : null;
}

export class DynamoRevisionCensus {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** Walks the whole trail once and answers the revisions of every subscription. */
  async count(): Promise<Map<string, number>> {
    const written = new Map<string, Set<string>>();
    const destroyed = new Map<string, Set<string>>();
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await this.db.send(
        new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: 'entity, subscriptionId, #type, contentRef',
          ExpressionAttributeNames: { '#type': 'type' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      for (const item of page.Items ?? []) {
        census(written, destroyed, item);
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return tally(written, destroyed);
  }
}

/** One entry of the trail, taken into the census. Exported for the tests. */
export function census(
  written: Map<string, Set<string>>,
  destroyed: Map<string, Set<string>>,
  item: Record<string, unknown>,
): void {
  if (item['entity'] !== 'AUDIT') return;
  const subscriptionId = typeof item['subscriptionId'] === 'string' ? item['subscriptionId'] : '';
  const pair = pairOf(item['contentRef']);
  if (!subscriptionId || !pair) return;
  const type = String(item['type'] ?? '');

  if (WRITES.has(type)) {
    const pairs = written.get(subscriptionId) ?? new Set<string>();
    pairs.add(`${pair.contentId}@${pair.versionId}`);
    written.set(subscriptionId, pairs);
  } else if (PURGES.has(type)) {
    const contents = destroyed.get(subscriptionId) ?? new Set<string>();
    contents.add(pair.contentId);
    destroyed.set(subscriptionId, contents);
  }
}

/** The revisions still kept, per subscription. Exported for the tests. */
export function tally(
  written: ReadonlyMap<string, ReadonlySet<string>>,
  destroyed: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, number> {
  const answer = new Map<string, number>();
  for (const [subscriptionId, pairs] of written) {
    const gone = destroyed.get(subscriptionId) ?? new Set<string>();
    let kept = 0;
    for (const pair of pairs) {
      if (!gone.has(pair.slice(0, pair.indexOf('@')))) kept += 1;
    }
    answer.set(subscriptionId, kept);
  }
  return answer;
}
