/**
 * The Dashboards of a notebook (#368), in its partition after `META`: one item
 * holding the definition as JSON text, beside the guard of its name. A
 * dashboard holds no data, so deleting one removes its item and its name in
 * the write that deletes it, with its event.
 */

import {
  DashboardId,
  DomainError,
  err,
  NotebookId,
  ok,
  type Result,
  type SubscriptionContext,
} from '@memorysmithapp/kernel';
import type { DynamoDBDocumentClient, TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Dashboard } from '../../../domain/dashboard/Dashboard.js';
import type { Definition } from '../../../domain/dashboard/DashboardDefinition.js';
import type { DashboardRepository } from '../../../domain/ports/index.js';
import { KnowledgeKeys } from './keys.js';
import { isTransactionCanceled } from './DynamoNotebookRepository.js';
import {
  outboxItem,
  parseAuthorship,
  serializeAuthorship,
  unwrapOrThrow,
  type Item,
} from './items.js';

type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

export class DynamoDashboardRepository implements DashboardRepository {
  private readonly keys: KnowledgeKeys;

  constructor(
    private readonly context: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {
    this.keys = new KnowledgeKeys(context.subscriptionId);
  }

  async findById(notebook: NotebookId, dashboard: DashboardId): Promise<Dashboard | null> {
    const found = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.dashboard(dashboard) },
        ConsistentRead: true,
      }),
    );
    return found.Item ? this.parse(found.Item as Item) : null;
  }

  async findByName(notebook: NotebookId, name: string): Promise<Dashboard | null> {
    const guard = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: this.keys.notebook(notebook), SK: this.keys.dashboardNameGuard(name) },
        ConsistentRead: true,
      }),
    );
    const held = guard.Item?.['dashboardId'];
    if (!held) return null;
    return this.findById(notebook, unwrapOrThrow(DashboardId.create(String(held))));
  }

  async list(notebook: NotebookId): Promise<Dashboard[]> {
    const items: Item[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const response = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': this.keys.notebook(notebook), ':prefix': 'DASH#' },
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      startKey = response.LastEvaluatedKey;
    } while (startKey);
    return items.map((item) => this.parse(item)).sort((a, b) => a.name.localeCompare(b.name));
  }

  async save(dashboard: Dashboard): Promise<Result<void, DomainError>> {
    const pk = this.keys.notebook(dashboard.notebookId);
    const sk = this.keys.dashboard(dashboard.id);
    const writes: TransactItem[] = [];
    const guard = (name: string): TransactItem => ({
      Put: {
        TableName: this.tableName,
        Item: {
          PK: pk,
          SK: this.keys.dashboardNameGuard(name),
          entity: 'DASHBOARD_NAME',
          dashboardId: dashboard.id.value,
          name,
        },
        ConditionExpression: 'attribute_not_exists(PK) OR dashboardId = :id',
        ExpressionAttributeValues: { ':id': dashboard.id.value },
      },
    });

    let was = dashboard.name;
    if (dashboard.version > 0) {
      const before = await this.db.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { PK: pk, SK: sk },
          ConsistentRead: true,
        }),
      );
      was = String(before.Item?.['name'] ?? dashboard.name);
    }

    if (dashboard.isDeleted) {
      writes.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: pk, SK: sk },
          ConditionExpression: 'version = :v',
          ExpressionAttributeValues: { ':v': dashboard.version },
        },
      });
      writes.push({
        Delete: {
          TableName: this.tableName,
          Key: { PK: pk, SK: this.keys.dashboardNameGuard(was) },
        },
      });
    } else {
      writes.push({
        Put: {
          TableName: this.tableName,
          Item: {
            PK: pk,
            SK: sk,
            entity: 'DASHBOARD',
            dashboardId: dashboard.id.value,
            notebookId: dashboard.notebookId.value,
            name: dashboard.name,
            description: dashboard.description,
            // The definition as text: it is read whole and written whole.
            definition: JSON.stringify(dashboard.definition),
            createdBy: serializeAuthorship(dashboard.createdBy),
            updatedBy: serializeAuthorship(dashboard.updatedBy),
            updatedAt: dashboard.updatedBy.at.toISOString(),
            version: dashboard.nextVersion(),
          },
          ConditionExpression:
            dashboard.version === 0 ? 'attribute_not_exists(PK)' : 'version = :v',
          ...(dashboard.version === 0
            ? {}
            : { ExpressionAttributeValues: { ':v': dashboard.version } }),
        },
      });
      const renamed =
        this.keys.dashboardNameGuard(was) !== this.keys.dashboardNameGuard(dashboard.name);
      if (dashboard.version === 0) writes.push(guard(dashboard.name));
      else if (renamed) {
        writes.push({
          Delete: {
            TableName: this.tableName,
            Key: { PK: pk, SK: this.keys.dashboardNameGuard(was) },
          },
        });
        writes.push(guard(dashboard.name));
      }
    }
    for (const event of dashboard.pullEvents()) {
      writes.push({
        Put: {
          TableName: this.tableName,
          Item: outboxItem(event, pk, this.keys.event(event.eventId)),
        },
      });
    }

    try {
      await this.db.send(new TransactWriteCommand({ TransactItems: writes }));
      return ok(undefined);
    } catch (error) {
      if (isTransactionCanceled(error)) {
        const holder = await this.findByName(dashboard.notebookId, dashboard.name);
        if (holder && !holder.id.equals(dashboard.id)) {
          return err(
            DomainError.conflict(
              `This notebook already has a dashboard called "${dashboard.name}"`,
              holder.id.value,
            ),
          );
        }
        return err(DomainError.conflict('The dashboard changed while this write was in flight'));
      }
      throw error;
    }
  }

  private parse(item: Item): Dashboard {
    return Dashboard.rehydrate({
      id: unwrapOrThrow(DashboardId.create(String(item['dashboardId']))),
      subscriptionId: this.context.subscriptionId,
      notebookId: unwrapOrThrow(NotebookId.create(String(item['notebookId']))),
      name: String(item['name']),
      description: String(item['description'] ?? ''),
      definition: JSON.parse(String(item['definition'] ?? '{}')) as Definition,
      createdBy: parseAuthorship(item['createdBy']),
      updatedBy: parseAuthorship(item['updatedBy']),
      version: Number(item['version'] ?? 0),
    });
  }
}
