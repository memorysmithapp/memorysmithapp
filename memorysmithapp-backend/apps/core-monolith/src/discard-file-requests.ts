/**
 * The discard of what `request_file` and the inline transport left open
 * (#469, #468), which the function of `forget-model-versions.handler.ts` runs
 * in AWS when it is invoked with `job: "discard-file-requests"`, started by
 * `pnpm tools data discard-file-requests` in staging and by the workflow of
 * production maintenance (ADR-028, ADR-017).
 *
 * A file request was a transfer of its own kind, holding no bytes and no room;
 * the product reads none since #469, so it is its record that goes. An upload
 * opened inline before #468 can never be finished: its parts are destroyed by
 * the exact revision written, its record goes, and the room it reserved is
 * given back (RN-SUB-025), as the person deleting it would.
 *
 * It reports before it writes, and only `apply` discards. A second run finds
 * nothing left. A note that named a requested file keeps a pending link, which
 * `check_notebook` shows.
 */

import { DeleteCommand, ScanCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoTransferStore } from '@memorysmithapp/svc-portability/adapters/dynamo';
import { uploadPartKeyOf } from '@memorysmithapp/svc-portability/domain/transfer';

/** A transfer record is `S#{subscription}#USER#{user}` / `TRANSFER#{id}`. */
const TRANSFER_KEY = /^S#([^#]+)#USER#(.+)$/;

/** One record the run found. */
export interface LeftOpen {
  readonly kind: 'request' | 'inline';
  readonly subscriptionId: string;
  readonly userId: string;
  readonly transferId: string;
  readonly notebookId: string | null;
  readonly bytes: number;
  /** The revision of each part an inline upload kept, by number. */
  readonly parts: Readonly<Record<string, string>>;
  readonly key: { PK: string; SK: string };
}

/** Destroys one revision of an object: its bytes, not a marker hiding them. */
export type DestroyObject = (key: string, versionId: string) => Promise<void>;

/** The open requests and the open inline uploads, read off the portability table. */
export async function leftOpen(db: DynamoDBDocumentClient, tableName: string): Promise<LeftOpen[]> {
  const found: LeftOpen[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          'entity = :transfer AND (#kind = :request OR (#kind = :agent AND #status = :running AND #upload.#transport = :inline))',
        ExpressionAttributeNames: {
          '#kind': 'kind',
          '#status': 'status',
          '#upload': 'upload',
          '#transport': 'transport',
        },
        ExpressionAttributeValues: {
          ':transfer': 'TRANSFER',
          ':request': 'request',
          ':agent': 'agent',
          ':running': 'running',
          ':inline': 'inline',
        },
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    for (const item of page.Items ?? []) {
      const owner = TRANSFER_KEY.exec(String(item['PK'] ?? ''));
      const sortKey = String(item['SK'] ?? '');
      if (!owner || !sortKey.startsWith('TRANSFER#')) continue;
      const upload = (item['upload'] ?? {}) as { parts?: Record<string, unknown> };
      const parts: Record<string, string> = {};
      for (const [part, version] of Object.entries(upload.parts ?? {})) {
        parts[part] = String(version);
      }
      found.push({
        kind: item['kind'] === 'request' ? 'request' : 'inline',
        subscriptionId: owner[1] ?? '',
        userId: owner[2] ?? '',
        transferId: sortKey.slice('TRANSFER#'.length),
        notebookId: item['notebookId'] ? String(item['notebookId']) : null,
        bytes: Number(item['bytes'] ?? 0),
        parts,
        key: { PK: String(item['PK']), SK: sortKey },
      });
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return found;
}

/** What a run found, and what it discarded when it was asked to apply. */
export interface DiscardSummary {
  readonly job: 'discard-file-requests';
  readonly mode: 'report' | 'apply';
  readonly requests: number;
  readonly inlineUploads: number;
  readonly subscriptions: number;
  /** What the inline uploads reserved, given back on apply. */
  readonly reservedBytes: number;
  readonly discarded: number;
  /** Each record that could not be discarded, and why. */
  readonly failures: readonly string[];
}

export async function discardFileRequests(input: {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
  readonly destroy: DestroyObject;
  readonly apply: boolean;
}): Promise<DiscardSummary> {
  const found = await leftOpen(input.db, input.tableName);
  const failures: string[] = [];
  let discarded = 0;
  if (input.apply) {
    for (const each of found) {
      try {
        if (each.kind === 'inline') {
          for (const [part, versionId] of Object.entries(each.parts)) {
            await input.destroy(
              uploadPartKeyOf(each.subscriptionId, each.transferId, Number(part)),
              versionId,
            );
          }
        }
        await input.db.send(new DeleteCommand({ TableName: input.tableName, Key: each.key }));
        if (each.kind === 'inline') {
          await new DynamoTransferStore(
            input.db,
            input.tableName,
            each.subscriptionId,
          ).addTransitBytes(-each.bytes, each.notebookId);
        }
        discarded += 1;
      } catch (error) {
        failures.push(`${each.transferId}: ${(error as Error).message}`);
      }
    }
  }
  const inline = found.filter((each) => each.kind === 'inline');
  return {
    job: 'discard-file-requests',
    mode: input.apply ? 'apply' : 'report',
    requests: found.length - inline.length,
    inlineUploads: inline.length,
    subscriptions: new Set(found.map((each) => each.subscriptionId)).size,
    reservedBytes: inline.reduce((total, each) => total + each.bytes, 0),
    discarded,
    failures,
  };
}
