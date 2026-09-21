/**
 * The Guidance and the Templates of a notebook written before they had a life
 * of their own (#159, RN-KNW-044).
 *
 * They used to be FIELDS of the things they belonged to: `guidanceRef` on the
 * item of the notebook and `templateRef` on the item of each folder. `3f8d8e3`
 * made each one an aggregate with an item of its own — `GUIDANCE` and
 * `FTPL#{folderId}` — and nothing carried over what was already written. So a
 * notebook written before that deploy answers `guidance: null` and
 * `hasTemplate: false` on every folder, for ever, while its content sits in the
 * table under the old names and its trail records every write of it.
 *
 * This reads the old shape and writes the new one. It is the same content: the
 * `ContentRef` each field carried is copied as it is, so **not one byte of the
 * object store is written or read** — what is migrated is where the product
 * looks for it.
 *
 * Three things it deliberately does not do:
 *
 *   - **It writes no event.** Nobody wrote anything: the Guidance the trail
 *     names is the one being pointed at again. An event here would say a person
 *     did something they did not do (rule 7).
 *   - **It removes no old field.** Until this has run everywhere, the old field
 *     is the only copy of where the content is. A later cycle takes them.
 *   - **It overwrites no new item.** A slot written after the deploy is the
 *     live one; the old field beside it is a fossil, and the fossil never wins.
 *
 * Running it twice writes nothing the second time, which is what lets an
 * operator run it, read the report, and run it again.
 */

import {
  ScanCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';

type Item = Record<string, unknown>;

/** What one migration pass found and what it did about it. */
export interface SlotMigrationReport {
  /** Notebooks whose Guidance was a field of the notebook item. */
  readonly guidances: number;
  /** Folders whose Template was a field of the folder item. */
  readonly templates: number;
  /** Slots already written in the new shape, which were left alone. */
  readonly alreadyMigrated: number;
  /** Notebooks the pass walked, deleted ones included. */
  readonly notebooks: number;
  /** What it wrote, or nothing when it was only asked to look. */
  readonly written: number;
}

export interface SlotMigrationDependencies {
  readonly db: DynamoDBDocumentClient;
  readonly tableName: string;
}

/** The partition of a notebook carries every item of it (§9.3, rule 1). */
interface NotebookPartition {
  readonly pk: string;
  readonly notebookId: string;
  readonly meta: Item | null;
  readonly folders: Item[];
  readonly slots: Set<string>;
}

export class SlotMigration {
  constructor(private readonly deps: SlotMigrationDependencies) {}

  /** What it would write. Nothing is written unless `apply` is asked for. */
  async run(options: { apply: boolean }): Promise<SlotMigrationReport> {
    const partitions = await this.partitions();

    let guidances = 0;
    let templates = 0;
    let alreadyMigrated = 0;
    let written = 0;

    for (const partition of partitions) {
      const writes: Item[] = [];

      const guidanceRef = partition.meta?.['guidanceRef'];
      if (isRef(guidanceRef)) {
        if (partition.slots.has('GUIDANCE')) alreadyMigrated += 1;
        else {
          guidances += 1;
          writes.push(guidanceItem(partition, guidanceRef));
        }
      }

      for (const folder of partition.folders) {
        const templateRef = folder['templateRef'];
        if (!isRef(templateRef)) continue;
        const sk = `FTPL#${String(folder['folderId'])}`;
        if (partition.slots.has(sk)) {
          alreadyMigrated += 1;
          continue;
        }
        templates += 1;
        writes.push(templateItem(partition, folder, templateRef, sk));
      }

      if (options.apply && writes.length > 0) written += await this.write(writes);
    }

    return {
      guidances,
      templates,
      alreadyMigrated,
      notebooks: partitions.length,
      written,
    };
  }

  /**
   * Every notebook of the table, with the items the migration reads. A scan,
   * because this runs once over everything an environment holds and there is
   * no key that answers "every notebook of every subscription".
   */
  private async partitions(): Promise<NotebookPartition[]> {
    const byPartition = new Map<string, NotebookPartition>();
    let startKey: Record<string, unknown> | undefined;

    do {
      const page = await this.deps.db.send(
        new ScanCommand({
          TableName: this.deps.tableName,
          FilterExpression:
            'SK = :meta OR begins_with(SK, :folder) OR SK = :guidance OR begins_with(SK, :template)',
          ExpressionAttributeValues: {
            ':meta': 'META',
            ':folder': 'FOLDER#',
            ':guidance': 'GUIDANCE',
            ':template': 'FTPL#',
          },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );

      for (const item of (page.Items ?? []) as Item[]) {
        const pk = String(item['PK']);
        if (!pk.includes('#NOTEBOOK#')) continue;
        const partition = byPartition.get(pk) ?? {
          pk,
          notebookId: pk.slice(pk.lastIndexOf('#') + 1),
          meta: null,
          folders: [],
          slots: new Set<string>(),
        };
        const sk = String(item['SK']);
        if (sk === 'META') byPartition.set(pk, { ...partition, meta: item });
        else {
          if (sk.startsWith('FOLDER#')) partition.folders.push(item);
          else partition.slots.add(sk);
          byPartition.set(pk, partition);
        }
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);

    return [...byPartition.values()];
  }

  /**
   * One transaction per notebook: either a notebook comes across whole or it
   * does not come across at all, so a run interrupted halfway leaves no
   * notebook with half of its design readable.
   */
  private async write(items: Item[]): Promise<number> {
    for (let index = 0; index < items.length; index += MAX_TRANSACT_ITEMS) {
      const chunk = items.slice(index, index + MAX_TRANSACT_ITEMS);
      await this.deps.db.send(
        new TransactWriteCommand({
          TransactItems: chunk.map((item) => ({
            Put: {
              TableName: this.deps.tableName,
              Item: item,
              // Another pass, or a write of the product between the read and
              // this, already claimed the key: the live slot always wins.
              ConditionExpression: 'attribute_not_exists(SK)',
            },
          })),
        }),
      );
    }
    return items.length;
  }
}

const MAX_TRANSACT_ITEMS = 100;

/** Whether a field of the old shape is a content reference and not a leftover. */
function isRef(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['contentId'] === 'string'
  );
}

/**
 * The authorship of a migrated slot is the one the old field travelled with:
 * whoever last wrote the thing it was a field of. It is the closest true answer
 * — the trail holds the exact one — and it is never this migration, which
 * wrote nothing anybody asked for.
 */
function authorshipOf(item: Item, key: 'createdBy' | 'updatedBy'): unknown {
  return item[key] ?? item['createdBy'] ?? item['updatedBy'] ?? null;
}

function guidanceItem(partition: NotebookPartition, ref: Record<string, unknown>): Item {
  const meta = partition.meta as Item;
  return {
    PK: partition.pk,
    SK: 'GUIDANCE',
    entity: 'GUIDANCE',
    notebookId: partition.notebookId,
    contentRef: ref,
    createdBy: authorshipOf(meta, 'createdBy'),
    updatedBy: authorshipOf(meta, 'updatedBy'),
    updatedAt: String(meta['updatedAt'] ?? ''),
    // The first version of the slot, as the first write of one would leave it.
    version: 1,
    // A Guidance is projected into GSI1 so that listing the notebooks answers
    // which of them have one, from the partition it already reads.
    GSI1PK: `${partition.pk.slice(0, partition.pk.indexOf('#NOTEBOOK#'))}#NOTEBOOKS`,
    GSI1SK: `NBGUID#${partition.notebookId}`,
  };
}

function templateItem(
  partition: NotebookPartition,
  folder: Item,
  ref: Record<string, unknown>,
  sk: string,
): Item {
  return {
    PK: partition.pk,
    SK: sk,
    entity: 'TEMPLATE',
    notebookId: partition.notebookId,
    folderId: String(folder['folderId']),
    contentRef: ref,
    createdBy: authorshipOf(folder, 'createdBy'),
    updatedBy: authorshipOf(folder, 'updatedBy'),
    updatedAt: String(folder['updatedAt'] ?? ''),
    version: 1,
  };
}
