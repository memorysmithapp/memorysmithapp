/**
 * DynamoDB adapters of the Access context, over mv-access
 * (architecture-guide.md, section 9.4).
 *
 *   S#{s}          / META                  subscription
 *   S#{s}          / INVITE#{token}        pending invite, ttl = expiresAt
 *   S#{s}#WS#{ws}  / META                  workspace
 *   S#{s}#WS#{ws}  / MEMBER#{userId}       membership (EDITOR | VIEWER)
 *   USER#{u}       / SUB#{s}               the link, exception 1 of section 8.3
 *
 *   GSI1: USER#{u}        -> S#{s}#WS#{ws}                        my workspaces
 *   GSI2: PLATFORM#{st}   -> REQUESTED#{ts}#{s}                   platform queue
 *
 * The OWNER is not a MEMBER item: ownership is the `ownerId` field of the META
 * item, which is how "exactly one OWNER" becomes the shape of the data.
 * The invite carries a TTL equal to its expiry, so an expired invite vanishes
 * on its own, with no cleanup job and no date check spread across every read.
 */

import {
  ConcurrencyError,
  Instant,
  ok,
  Role,
  Slug,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
  WorkspaceId,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { Subscription } from '../../../domain/subscription/Subscription.js';
import { Workspace, type Membership } from '../../../domain/workspace/Workspace.js';
import { Invite, type InviteStatus } from '../../../domain/invite/Invite.js';
import {
  Email,
  InviteToken,
  RejectionReason,
  SubscriptionName,
  WorkspaceName,
} from '../../../domain/values.js';
import type {
  InviteRepository,
  PlatformSubscriptionAdmin,
  PlatformSubscriptionView,
  SubscriptionLink,
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
  WorkspaceRepository,
} from '../../../domain/ports/index.js';
import { outboxItemFor, type Item, type OutboxSink } from './items.js';

function need<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(`Corrupted item in mv-access: ${result.error.message}`);
  return result.value;
}

function subscriptionItem(subscription: Subscription): Item {
  return {
    PK: `S#${subscription.id.value}`,
    SK: 'META',
    entity: 'SUBSCRIPTION',
    subscriptionId: subscription.id.value,
    name: subscription.name.value,
    slug: subscription.slug.value,
    ownerId: subscription.ownerId.value,
    ownerEmail: subscription.ownerEmail,
    status: subscription.status.name,
    requestedAt: subscription.requestedAt.toISOString(),
    reviewedBy: subscription.reviewedBy?.value ?? null,
    reviewedAt: subscription.reviewedAt?.toISOString() ?? null,
    rejectionReason: subscription.rejectionReason?.value ?? null,
    legalHold: subscription.legalHold,
    version: subscription.version + 1,
    // The platform queue reads this and nothing else (exception 2).
    GSI2PK: `PLATFORM#${subscription.status.name}`,
    GSI2SK: `REQUESTED#${subscription.requestedAt.toISOString()}#${subscription.id.value}`,
  };
}

function parseSubscription(item: Item): Subscription {
  return Subscription.rehydrate({
    id: need(SubscriptionId.fromClaim(String(item['subscriptionId']))),
    name: need(SubscriptionName.create(String(item['name']))),
    slug: need(Slug.create(String(item['slug']))),
    ownerId: need(UserId.create(String(item['ownerId']))),
    ownerEmail: String(item['ownerEmail']),
    status: need(SubscriptionStatus.create(String(item['status']))),
    requestedAt: need(Instant.fromISO(String(item['requestedAt']))),
    reviewedBy: item['reviewedBy'] ? need(UserId.create(String(item['reviewedBy']))) : null,
    reviewedAt: item['reviewedAt'] ? need(Instant.fromISO(String(item['reviewedAt']))) : null,
    rejectionReason: item['rejectionReason']
      ? need(RejectionReason.create(String(item['rejectionReason'])))
      : null,
    legalHold: Boolean(item['legalHold']),
    version: Number(item['version'] ?? 0),
  });
}

function workspaceItem(workspace: Workspace, subscriptionId: SubscriptionId): Item {
  return {
    PK: `S#${subscriptionId.value}#WS#${workspace.id.value}`,
    SK: 'META',
    entity: 'WORKSPACE',
    workspaceId: workspace.id.value,
    subscriptionId: subscriptionId.value,
    name: workspace.name.value,
    slug: workspace.slug.value,
    isDefault: workspace.isDefault,
    createdAt: workspace.createdAt.toISOString(),
    version: workspace.version + 1,
  };
}

function memberItem(
  member: Membership,
  subscriptionId: SubscriptionId,
  workspaceId: WorkspaceId,
): Item {
  return {
    PK: `S#${subscriptionId.value}#WS#${workspaceId.value}`,
    SK: `MEMBER#${member.userId.value}`,
    entity: 'MEMBER',
    userId: member.userId.value,
    email: member.email.value,
    role: member.role.name,
    invitedBy: member.invitedBy?.value ?? null,
    joinedAt: member.joinedAt.toISOString(),
    // "Which workspaces do I have" is answered by GSI1 (exception 1 adjacent).
    GSI1PK: `USER#${member.userId.value}`,
    GSI1SK: `S#${subscriptionId.value}#WS#${workspaceId.value}`,
  };
}

export class DynamoSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  async find(): Promise<Subscription | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.sub.subscriptionId.value}`, SK: 'META' },
      }),
    );
    return response.Item ? parseSubscription(response.Item as Item) : null;
  }

  async save(subscription: Subscription): Promise<Result<void, ConcurrencyError>> {
    return saveSubscription(this.db, this.tableName, this.outbox, subscription);
  }
}

async function saveSubscription(
  db: DynamoDBDocumentClient,
  tableName: string,
  outbox: OutboxSink,
  subscription: Subscription,
): Promise<Result<void, ConcurrencyError>> {
  const events = subscription.pullEvents();
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: subscriptionItem(subscription),
              ConditionExpression: 'attribute_not_exists(PK) OR version = :expected',
              ExpressionAttributeValues: { ':expected': subscription.version },
            },
          },
          ...events.map((event) => ({
            Put: {
              TableName: tableName,
              Item: outboxItemFor(event, `S#${subscription.id.value}`),
            },
          })),
        ],
      }),
    );
  } catch (error) {
    const name = (error as { name?: string })?.name ?? '';
    if (name === 'TransactionCanceledException')
      return { ok: false, error: new ConcurrencyError() };
    throw error;
  }
  subscription.markPersisted();
  await outbox.published(events);
  return ok();
}

export class DynamoWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  private partition(id: WorkspaceId): string {
    return `S#${this.sub.subscriptionId.value}#WS#${id.value}`;
  }

  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': this.partition(id) },
      }),
    );
    return this.assemble((response.Items ?? []) as Item[]);
  }

  async listAll(): Promise<Workspace[]> {
    // Workspaces of the subscription, found through the membership index of
    // the current user plus the ownership shortcut resolved by the caller.
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${this.sub.userId.value}`,
          ':prefix': `S#${this.sub.subscriptionId.value}#WS#`,
        },
      }),
    );
    const ids = new Set(
      ((response.Items ?? []) as Item[]).map((item) => String(item['GSI1SK']).split('#WS#')[1]),
    );

    // The owner reaches every workspace of the subscription without being a
    // member of any (RN-ACC-013), so the owner path scans the ownership index.
    const owned = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `SUBWS#${this.sub.subscriptionId.value}`,
          ':prefix': 'WS#',
        },
      }),
    );
    for (const item of (owned.Items ?? []) as Item[]) {
      ids.add(String(item['workspaceId']));
    }

    const workspaces: Workspace[] = [];
    for (const id of ids) {
      if (!id) continue;
      const parsed = WorkspaceId.create(id);
      if (!parsed.ok) continue;
      const workspace = await this.findById(parsed.value);
      if (workspace) workspaces.push(workspace);
    }
    return workspaces;
  }

  async findDefault(): Promise<Workspace | null> {
    return (await this.listAll()).find((workspace) => workspace.isDefault) ?? null;
  }

  async save(workspace: Workspace): Promise<Result<void, ConcurrencyError>> {
    const events = workspace.pullEvents();
    const partition = this.partition(workspace.id);
    const existingMembers = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': partition, ':prefix': 'MEMBER#' },
        ProjectionExpression: 'SK',
      }),
    );
    const current = new Set(workspace.members.map((member) => `MEMBER#${member.userId.value}`));
    const removed = ((existingMembers.Items ?? []) as Item[])
      .map((item) => String(item['SK']))
      .filter((sk) => !current.has(sk));

    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  ...workspaceItem(workspace, this.sub.subscriptionId),
                  // Lets the owner list every workspace of the subscription.
                  GSI1PK: `SUBWS#${this.sub.subscriptionId.value}`,
                  GSI1SK: `WS#${workspace.id.value}`,
                },
                ConditionExpression: 'attribute_not_exists(PK) OR version = :expected',
                ExpressionAttributeValues: { ':expected': workspace.version },
              },
            },
            ...workspace.members.map((member) => ({
              Put: {
                TableName: this.tableName,
                Item: memberItem(member, this.sub.subscriptionId, workspace.id),
              },
            })),
            ...removed.map((sk) => ({
              Delete: { TableName: this.tableName, Key: { PK: partition, SK: sk } },
            })),
            ...events.map((event) => ({
              Put: { TableName: this.tableName, Item: outboxItemFor(event, partition) },
            })),
          ],
        }),
      );
    } catch (error) {
      const name = (error as { name?: string })?.name ?? '';
      if (name === 'TransactionCanceledException') {
        return { ok: false, error: new ConcurrencyError() };
      }
      throw error;
    }
    workspace.markPersisted();
    await this.outbox.published(events);
    return ok();
  }

  private assemble(items: Item[]): Workspace | null {
    const meta = items.find((item) => item['SK'] === 'META');
    if (!meta) return null;
    const members: Membership[] = items
      .filter((item) => String(item['SK']).startsWith('MEMBER#'))
      .map((item) => ({
        userId: need(UserId.create(String(item['userId']))),
        email: need(Email.create(String(item['email']))),
        role: need(Role.membership(String(item['role']))),
        invitedBy: item['invitedBy'] ? need(UserId.create(String(item['invitedBy']))) : null,
        joinedAt: need(Instant.fromISO(String(item['joinedAt']))),
      }));

    return Workspace.rehydrate({
      id: need(WorkspaceId.create(String(meta['workspaceId']))),
      subscriptionId: this.sub.subscriptionId,
      name: need(WorkspaceName.create(String(meta['name']))),
      slug: need(Slug.create(String(meta['slug']))),
      isDefault: Boolean(meta['isDefault']),
      members,
      createdAt: need(Instant.fromISO(String(meta['createdAt']))),
      version: Number(meta['version'] ?? 0),
    });
  }
}

export class DynamoInviteRepository implements InviteRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  async findByToken(token: InviteToken): Promise<Invite | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.sub.subscriptionId.value}`, SK: `INVITE#${token.value}` },
      }),
    );
    return response.Item ? this.parse(response.Item as Item) : null;
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<Invite[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `S#${this.sub.subscriptionId.value}`,
          ':prefix': 'INVITE#',
        },
      }),
    );
    return ((response.Items ?? []) as Item[])
      .map((item) => this.parse(item))
      .filter((invite) => invite.workspaceId.equals(workspaceId));
  }

  async save(invite: Invite): Promise<Result<void, ConcurrencyError>> {
    const events = invite.pullEvents();
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `S#${this.sub.subscriptionId.value}`,
          SK: `INVITE#${invite.token.value}`,
          entity: 'INVITE',
          inviteId: invite.id,
          workspaceId: invite.workspaceId.value,
          email: invite.email.value,
          role: invite.role.name,
          invitedBy: invite.invitedBy.value,
          status: invite.status,
          sentAt: invite.sentAt.toISOString(),
          expiresAt: invite.expiresAt.toISOString(),
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          // TTL equal to the expiry: an expired invite disappears on its own.
          ttl: invite.expiresAt.toEpochSeconds(),
        },
      }),
    );
    await this.outbox.published(events);
    return ok();
  }

  private parse(item: Item): Invite {
    return Invite.rehydrate({
      id: String(item['inviteId']),
      subscriptionId: this.sub.subscriptionId,
      workspaceId: need(WorkspaceId.create(String(item['workspaceId']))),
      email: need(Email.create(String(item['email']))),
      role: need(Role.membership(String(item['role']))),
      invitedBy: need(UserId.create(String(item['invitedBy']))),
      token: need(InviteToken.create(String(item['SK']).slice('INVITE#'.length))),
      status: String(item['status']) as InviteStatus,
      sentAt: need(Instant.fromISO(String(item['sentAt']))),
      expiresAt: need(Instant.fromISO(String(item['expiresAt']))),
      acceptedAt: item['acceptedAt'] ? need(Instant.fromISO(String(item['acceptedAt']))) : null,
    });
  }
}

/** Exception 1: identity is global, so this repository holds no context. */
export class DynamoUserLinkRepository implements UserLinkRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async linksOf(user: UserId): Promise<SubscriptionLink[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${user.value}`, ':prefix': 'SUB#' },
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => ({
      userId: user,
      subscriptionId: need(SubscriptionId.fromClaim(String(item['subscriptionId']))),
      isOwner: Boolean(item['isOwner']),
      isDefault: Boolean(item['isDefault']),
      joinedAt: String(item['joinedAt']),
    }));
  }

  async link(link: SubscriptionLink): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: `USER#${link.userId.value}`,
          SK: `SUB#${link.subscriptionId.value}`,
          entity: 'LINK',
          subscriptionId: link.subscriptionId.value,
          isOwner: link.isOwner,
          isDefault: link.isDefault,
          joinedAt: link.joinedAt,
        },
      }),
    );
  }

  async unlink(user: UserId, subscriptionId: SubscriptionId): Promise<void> {
    await this.db.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${user.value}`, SK: `SUB#${subscriptionId.value}` },
      }),
    );
  }

  async setDefault(user: UserId, subscriptionId: SubscriptionId): Promise<void> {
    for (const link of await this.linksOf(user)) {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `USER#${user.value}`, SK: `SUB#${link.subscriptionId.value}` },
          UpdateExpression: 'SET isDefault = :value',
          ExpressionAttributeValues: {
            ':value': link.subscriptionId.equals(subscriptionId),
          },
        }),
      );
    }
  }
}

/** Exception 2: the platform queue, metadata only, straight from GSI2. */
export class DynamoPlatformAdmin implements PlatformSubscriptionAdmin {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  async listByStatus(status: SubscriptionStatus): Promise<PlatformSubscriptionView[]> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: { ':pk': `PLATFORM#${status.name}` },
      }),
    );
    return ((response.Items ?? []) as Item[]).map((item) => ({
      subscriptionId: String(item['subscriptionId']),
      name: String(item['name']),
      ownerEmail: String(item['ownerEmail']),
      status: String(item['status']),
      requestedAt: String(item['requestedAt']),
      workspaceCount: Number(item['workspaceCount'] ?? 0),
    }));
  }

  async findById(id: SubscriptionId): Promise<Subscription | null> {
    const response = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { PK: `S#${id.value}`, SK: 'META' } }),
    );
    return response.Item ? parseSubscription(response.Item as Item) : null;
  }

  async save(subscription: Subscription): Promise<Result<void, ConcurrencyError>> {
    return saveSubscription(this.db, this.tableName, this.outbox, subscription);
  }
}

export class DynamoOnboarding implements SubscriptionOnboarding {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  async ownedBy(user: UserId): Promise<SubscriptionId | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'isOwner = :owner',
        ExpressionAttributeValues: {
          ':pk': `USER#${user.value}`,
          ':prefix': 'SUB#',
          ':owner': true,
        },
      }),
    );
    const owned = ((response.Items ?? []) as Item[])[0];
    return owned ? need(SubscriptionId.fromClaim(String(owned['subscriptionId']))) : null;
  }

  async create(input: {
    subscription: Subscription;
    workspace: Workspace;
    link: SubscriptionLink;
  }): Promise<Result<void, ConcurrencyError>> {
    const events = [...input.subscription.pullEvents(), ...input.workspace.pullEvents()];
    const partition = `S#${input.subscription.id.value}`;
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { ...subscriptionItem(input.subscription), workspaceCount: 1 },
                ConditionExpression: 'attribute_not_exists(PK)',
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  ...workspaceItem(input.workspace, input.subscription.id),
                  GSI1PK: `SUBWS#${input.subscription.id.value}`,
                  GSI1SK: `WS#${input.workspace.id.value}`,
                },
              },
            },
            {
              Put: {
                TableName: this.tableName,
                Item: {
                  PK: `USER#${input.link.userId.value}`,
                  SK: `SUB#${input.link.subscriptionId.value}`,
                  entity: 'LINK',
                  subscriptionId: input.link.subscriptionId.value,
                  isOwner: input.link.isOwner,
                  isDefault: input.link.isDefault,
                  joinedAt: input.link.joinedAt,
                },
              },
            },
            ...events.map((event) => ({
              Put: { TableName: this.tableName, Item: outboxItemFor(event, partition) },
            })),
          ],
        }),
      );
    } catch (error) {
      const name = (error as { name?: string })?.name ?? '';
      if (name === 'TransactionCanceledException') {
        return { ok: false, error: new ConcurrencyError() };
      }
      throw error;
    }
    input.subscription.markPersisted();
    input.workspace.markPersisted();
    await this.outbox.published(events);
    return ok();
  }
}
