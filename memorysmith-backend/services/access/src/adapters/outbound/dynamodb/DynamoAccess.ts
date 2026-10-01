/**
 * DynamoDB adapters of the Access context, over mv-access
 * (architecture-guide.md, section 9.4).
 *
 *   S#{s}          / META                  subscription
 *   S#{s}          / MEMBER#{userId}       membership (EDITOR | VIEWER)
 *   USER#{u}       / SUB#{s}               the link, exception 1 of section 8.3
 *   S#{s}          / CONNECTOR#TOKEN#{jti}      the connector of an access token
 *   S#{s}          / CONNECTOR#REFRESH#{sha256} the connector a refresh token renews
 *   S#{s}          / AVATAR#{userId}       the face of that person in this subscription
 *   S#{s}          / SHARE#{n}#USER#{u}    a notebook of this subscription shared with u
 *   USER#{u}       / SHARED#{n}            the same share, from u's side (exception 1)
 *
 *   GSI2: PLATFORM#{st}   -> REQUESTED#{ts}#{s}                   platform queue
 *
 * The subscription and its members share ONE partition, so a single Query
 * brings the whole aggregate back, the way the notebook already loads its tree.
 *
 * The OWNER is not a MEMBER item: ownership is the `ownerId` field of the META
 * item, which is how "exactly one OWNER" becomes the shape of the data.
 */

import {
  AgentIdentity,
  ConcurrencyError,
  Instant,
  NotebookId,
  ok,
  Role,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
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
import type { Membership } from '../../../domain/subscription/Subscription.js';
import { Share, type ShareState } from '../../../domain/share/Share.js';
import {
  AvatarSource,
  Email,
  RejectionReason,
  StorageQuota,
  SubscriptionType,
} from '../../../domain/values.js';
import type {
  AvatarRepository,
  MemberAvatar,
  ConnectorBindingRepository,
  PlatformSubscriptionAdmin,
  PlatformSubscriptionView,
  ShareRepository,
  SubscriptionLink,
  SubscriptionOnboarding,
  SubscriptionRepository,
  UserLinkRepository,
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
    ownerId: subscription.ownerId.value,
    ownerEmail: subscription.ownerEmail,
    status: subscription.status.name,
    type: subscription.type.name,
    quota: subscription.quota.name,
    requestedAt: subscription.requestedAt.toISOString(),
    reviewedBy: subscription.reviewedBy?.value ?? null,
    reviewedAt: subscription.reviewedAt?.toISOString() ?? null,
    rejectionReason: subscription.rejectionReason?.value ?? null,
    version: subscription.version + 1,
    // The platform queue reads this and nothing else (exception 2).
    GSI2PK: `PLATFORM#${subscription.status.name}`,
    GSI2SK: `REQUESTED#${subscription.requestedAt.toISOString()}#${subscription.id.value}`,
  };
}

function parseSubscription(item: Item, members: Membership[] = []): Subscription {
  return Subscription.rehydrate({
    members,
    id: need(SubscriptionId.fromClaim(String(item['subscriptionId']))),
    ownerId: need(UserId.create(String(item['ownerId']))),
    ownerEmail: String(item['ownerEmail']),
    status: need(SubscriptionStatus.create(String(item['status']))),
    // An item written before the plan existed carries neither field, and the
    // default is what it always had in practice: the only type there is.
    type: item['type']
      ? need(SubscriptionType.create(String(item['type'])))
      : SubscriptionType.DEFAULT,
    quota: item['quota'] ? need(StorageQuota.create(String(item['quota']))) : StorageQuota.DEFAULT,
    requestedAt: need(Instant.fromISO(String(item['requestedAt']))),
    reviewedBy: item['reviewedBy'] ? need(UserId.create(String(item['reviewedBy']))) : null,
    reviewedAt: item['reviewedAt'] ? need(Instant.fromISO(String(item['reviewedAt']))) : null,
    rejectionReason: item['rejectionReason']
      ? need(RejectionReason.create(String(item['rejectionReason'])))
      : null,
    version: Number(item['version'] ?? 0),
  });
}

function memberItem(member: Membership, subscriptionId: SubscriptionId): Item {
  return {
    PK: `S#${subscriptionId.value}`,
    SK: `MEMBER#${member.userId.value}`,
    entity: 'MEMBER',
    userId: member.userId.value,
    email: member.email.value,
    role: member.role.name,
    invitedBy: member.invitedBy?.value ?? null,
    joinedAt: member.joinedAt.toISOString(),
  };
}

function parseMember(item: Item): Membership {
  return {
    userId: need(UserId.create(String(item['userId']))),
    email: need(Email.create(String(item['email']))),
    role: need(Role.membership(String(item['role']))),
    invitedBy: item['invitedBy'] ? need(UserId.create(String(item['invitedBy']))) : null,
    joinedAt: need(Instant.fromISO(String(item['joinedAt']))),
  };
}

export class DynamoSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  /**
   * ONE Query brings the subscription and its members back: `MEMBER#` sorts
   * before `META`, so both come from the same partition in the same read, and
   * no authorization decision costs an extra round trip.
   */
  async find(): Promise<Subscription | null> {
    const response = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND SK BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':pk': `S#${this.sub.subscriptionId.value}`,
          ':from': 'MEMBER#',
          ':to': 'META',
        },
      }),
    );
    const items = (response.Items ?? []) as Item[];
    const meta = items.find((item) => item['SK'] === 'META');
    if (!meta) return null;
    return parseSubscription(
      meta,
      items.filter((item) => String(item['SK']).startsWith('MEMBER#')).map(parseMember),
    );
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
  const partition = `S#${subscription.id.value}`;

  // Whoever left the member list has to leave the table too, or a removed
  // member would keep their item and the next read would bring them back.
  const stored = await db.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': partition, ':prefix': 'MEMBER#' },
      ProjectionExpression: 'SK',
    }),
  );
  const current = new Set(subscription.members.map((member) => `MEMBER#${member.userId.value}`));
  const removed = ((stored.Items ?? []) as Item[])
    .map((item) => String(item['SK']))
    .filter((sk) => !current.has(sk));

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
          ...subscription.members.map((member) => ({
            Put: { TableName: tableName, Item: memberItem(member, subscription.id) },
          })),
          ...removed.map((sk) => ({
            Delete: { TableName: tableName, Key: { PK: partition, SK: sk } },
          })),
          ...events.map((event) => ({
            Put: { TableName: tableName, Item: outboxItemFor(event, partition) },
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
      welcomedAt: item['welcomedAt'] ? String(item['welcomedAt']) : null,
    }));
  }

  /**
   * An update and not a put, so the fields this repository does not own
   * survive it. A put here is what would un-welcome somebody the moment
   * ownership of their subscription changed hands (#167).
   */
  async link(link: Omit<SubscriptionLink, 'welcomedAt'>): Promise<void> {
    await this.db.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: `USER#${link.userId.value}`, SK: `SUB#${link.subscriptionId.value}` },
        UpdateExpression:
          'SET entity = :entity, subscriptionId = :id, isOwner = :owner, ' +
          'isDefault = :active, joinedAt = :joined',
        ExpressionAttributeValues: {
          ':entity': 'LINK',
          ':id': link.subscriptionId.value,
          ':owner': link.isOwner,
          ':active': link.isDefault,
          ':joined': link.joinedAt,
        },
      }),
    );
  }

  async markWelcomed(user: UserId, at: string): Promise<void> {
    // Every link, because being welcomed happens to a PERSON and not to one of
    // their subscriptions: joining a second one does not make the product new.
    for (const link of await this.linksOf(user)) {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { PK: `USER#${user.value}`, SK: `SUB#${link.subscriptionId.value}` },
          UpdateExpression: 'SET welcomedAt = if_not_exists(welcomedAt, :at)',
          ExpressionAttributeValues: { ':at': at },
        }),
      );
    }
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
      ownerEmail: String(item['ownerEmail']),
      status: String(item['status']),
      type: String(item['type'] ?? SubscriptionType.DEFAULT.name),
      quota: String(item['quota'] ?? StorageQuota.DEFAULT.name),
      requestedAt: String(item['requestedAt']),
      memberCount: Number(item['memberCount'] ?? 0),
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
    link: SubscriptionLink;
  }): Promise<Result<void, ConcurrencyError>> {
    const events = input.subscription.pullEvents();
    const partition = `S#${input.subscription.id.value}`;
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.tableName,
                Item: { ...subscriptionItem(input.subscription), memberCount: 0 },
                ConditionExpression: 'attribute_not_exists(PK)',
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
    await this.outbox.published(events);
    return ok();
  }
}

/**
 * The connector of each token of the connector proxy (section 13.3, item 4).
 *
 * The access token is bound ONCE, by a conditional put: a token never changes
 * connector, and a second attempt to bind it is refused rather than obeyed.
 * Both items carry a TTL equal to their expiry, and the TTL removes an expired
 * binding eventually rather than on the second, so every read checks the expiry
 * as well.
 */
export class DynamoConnectorBindingRepository implements ConnectorBindingRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async bindAccessToken(
    tokenId: string,
    agent: AgentIdentity,
    expiresAt: Instant,
  ): Promise<boolean> {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.item(`CONNECTOR#TOKEN#${tokenId}`, agent, expiresAt),
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string })?.name === 'ConditionalCheckFailedException') return false;
      throw error;
    }
  }

  async bindRefreshToken(
    tokenHash: string,
    agent: AgentIdentity,
    expiresAt: Instant,
  ): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: this.item(`CONNECTOR#REFRESH#${tokenHash}`, agent, expiresAt),
      }),
    );
  }

  agentOfAccessToken(tokenId: string, now: Instant): Promise<AgentIdentity | null> {
    return this.read(`CONNECTOR#TOKEN#${tokenId}`, now);
  }

  agentOfRefreshToken(tokenHash: string, now: Instant): Promise<AgentIdentity | null> {
    return this.read(`CONNECTOR#REFRESH#${tokenHash}`, now);
  }

  private item(sk: string, agent: AgentIdentity, expiresAt: Instant): Item {
    return {
      PK: `S#${this.sub.subscriptionId.value}`,
      SK: sk,
      entity: 'CONNECTOR_BINDING',
      clientId: agent.clientId,
      clientName: agent.clientName,
      expiresAt: expiresAt.toISOString(),
      ttl: expiresAt.toEpochSeconds(),
    };
  }

  private async read(sk: string, now: Instant): Promise<AgentIdentity | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { PK: `S#${this.sub.subscriptionId.value}`, SK: sk },
      }),
    );
    const item = response.Item as Item | undefined;
    if (!item) return null;
    if (need(Instant.fromISO(String(item['expiresAt']))).isAtOrBefore(now)) return null;
    return need(AgentIdentity.create(String(item['clientId']), String(item['clientName'])));
  }
}

/**
 * The face of one person INSIDE this subscription (RN-ACC-022).
 *
 * Keyed under the subscription like everything else, so design rule 1 holds
 * and no third exception of section 8.3 is opened: a picture is data of the
 * membership. The bytes live on the item, not in the object store, because an
 * avatar is bounded rather than budgeted — the interface draws it down to
 * `avatarSide` pixels before sending it and the use case refuses anything over
 * `avatarMaxBytes`. At that size, replacing a picture OVERWRITES the old one,
 * and there is nothing left behind for a purge to find.
 */
export class DynamoAvatarRepository implements AvatarRepository {
  constructor(
    private readonly sub: SubscriptionContext,
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private key(user: UserId): Item {
    return { PK: `S#${this.sub.subscriptionId.value}`, SK: `AVATAR#${user.value}` };
  }

  async find(user: UserId): Promise<MemberAvatar | null> {
    const found = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: this.key(user) }),
    );
    const item = found.Item as Item | undefined;
    if (!item) return null;
    const source = AvatarSource.create(String(item['source'] ?? ''));
    const picture = item['picture'] as Uint8Array | undefined;
    return {
      source: source.ok ? source.value : AvatarSource.DEFAULT,
      picture: picture ? new Uint8Array(picture) : null,
      mime: item['mime'] ? String(item['mime']) : null,
    };
  }

  async save(user: UserId, avatar: MemberAvatar): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...this.key(user),
          entity: 'AVATAR',
          userId: user.value,
          source: avatar.source.name,
          // Written only when there is one: an item carrying an empty binary
          // is an item that says a picture exists.
          ...(avatar.picture && avatar.mime ? { picture: avatar.picture, mime: avatar.mime } : {}),
        },
      }),
    );
  }
}

/** The prefix of the shares of one notebook, under the owner's subscription. */
const sharePrefix = (notebookId: NotebookId | null): string =>
  notebookId ? `SHARE#${notebookId.value}#USER#` : 'SHARE#';

function ownerKey(share: Share): Item {
  return {
    PK: `S#${share.ownerSubscriptionId.value}`,
    SK: `${sharePrefix(share.notebookId)}${share.granteeUserId.value}`,
  };
}

function granteeKey(grantee: UserId, notebookId: NotebookId): Item {
  return { PK: `USER#${grantee.value}`, SK: `SHARED#${notebookId.value}` };
}

/** The one fact both items of a share carry, keyed for the side it is written on. */
function shareItem(share: Share, key: Item, entity: 'SHARE' | 'SHARED'): Item {
  return {
    ...key,
    entity,
    notebookId: share.notebookId.value,
    ownerSubscriptionId: share.ownerSubscriptionId.value,
    ownerUserId: share.ownerUserId.value,
    ownerEmail: share.ownerEmail.value,
    granteeUserId: share.granteeUserId.value,
    granteeEmail: share.granteeEmail.value,
    access: share.access,
    state: share.state,
    sharedAt: share.sharedAt.toISOString(),
    answeredAt: share.answeredAt?.toISOString() ?? null,
    notifyOwner: share.notifyOwner,
    ownerSeenAt: share.ownerSeenAt?.toISOString() ?? null,
  };
}

function parseShare(item: Item): Share {
  return Share.rehydrate({
    notebookId: need(NotebookId.create(String(item['notebookId']))),
    ownerSubscriptionId: need(SubscriptionId.fromClaim(String(item['ownerSubscriptionId']))),
    ownerUserId: need(UserId.create(String(item['ownerUserId']))),
    ownerEmail: need(Email.create(String(item['ownerEmail']))),
    granteeUserId: need(UserId.create(String(item['granteeUserId']))),
    granteeEmail: need(Email.create(String(item['granteeEmail']))),
    access: item['access'] === 'read-write' ? 'read-write' : 'read',
    state: String(item['state']) as ShareState,
    sharedAt: need(Instant.fromISO(String(item['sharedAt']))),
    answeredAt: item['answeredAt'] ? need(Instant.fromISO(String(item['answeredAt']))) : null,
    notifyOwner: Boolean(item['notifyOwner']),
    ownerSeenAt: item['ownerSeenAt'] ? need(Instant.fromISO(String(item['ownerSeenAt']))) : null,
  });
}

/**
 * Exception 1 widened (architecture-guide.md, section 8.3): a share is kept
 * under the owner's subscription and, in the same transaction, under the
 * grantee, beside their links to subscriptions.
 *
 *   S#{owner}      / SHARE#{notebookId}#USER#{grantee}   the owner's side
 *   USER#{grantee} / SHARED#{notebookId}                 the grantee's side
 *
 * The events of a transition ride in the same transaction, on the outbox of
 * the owner's subscription, because who could reach a notebook is part of its
 * life (RN-AUD-011).
 */
export class DynamoShareRepository implements ShareRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly outbox: OutboxSink,
  ) {}

  async save(share: Share): Promise<void> {
    await this.write(share, [
      { Put: { TableName: this.tableName, Item: shareItem(share, ownerKey(share), 'SHARE') } },
      {
        Put: {
          TableName: this.tableName,
          Item: shareItem(share, granteeKey(share.granteeUserId, share.notebookId), 'SHARED'),
        },
      },
    ]);
  }

  async saveRevoked(share: Share): Promise<void> {
    await this.write(share, [
      { Delete: { TableName: this.tableName, Key: ownerKey(share) } },
      {
        Put: {
          TableName: this.tableName,
          Item: shareItem(share, granteeKey(share.granteeUserId, share.notebookId), 'SHARED'),
        },
      },
    ]);
  }

  async saveClosedByGrantee(share: Share): Promise<void> {
    await this.write(share, [
      { Put: { TableName: this.tableName, Item: shareItem(share, ownerKey(share), 'SHARE') } },
      {
        Delete: {
          TableName: this.tableName,
          Key: granteeKey(share.granteeUserId, share.notebookId),
        },
      },
    ]);
  }

  async saveOwnerSide(share: Share): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: shareItem(share, ownerKey(share), 'SHARE'),
      }),
    );
  }

  async removeOutgoing(share: Share): Promise<void> {
    await this.db.send(new DeleteCommand({ TableName: this.tableName, Key: ownerKey(share) }));
  }

  async findOutgoing(
    owner: SubscriptionContext,
    notebookId: NotebookId,
    grantee: UserId,
  ): Promise<Share | null> {
    const response = await this.db.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `S#${owner.subscriptionId.value}`,
          SK: `${sharePrefix(notebookId)}${grantee.value}`,
        },
      }),
    );
    return response.Item ? parseShare(response.Item as Item) : null;
  }

  async listOutgoing(owner: SubscriptionContext, notebookId: NotebookId | null): Promise<Share[]> {
    return (await this.query(`S#${owner.subscriptionId.value}`, sharePrefix(notebookId))).map(
      parseShare,
    );
  }

  async findIncoming(grantee: UserId, notebookId: NotebookId): Promise<Share | null> {
    const response = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: granteeKey(grantee, notebookId) }),
    );
    return response.Item ? parseShare(response.Item as Item) : null;
  }

  async listIncoming(grantee: UserId): Promise<Share[]> {
    return (await this.query(`USER#${grantee.value}`, 'SHARED#')).map(parseShare);
  }

  async dismissIncoming(grantee: UserId, notebookId: NotebookId): Promise<void> {
    await this.db.send(
      new DeleteCommand({ TableName: this.tableName, Key: granteeKey(grantee, notebookId) }),
    );
  }

  async removeAllOf(owner: SubscriptionContext, notebookId: NotebookId): Promise<void> {
    for (const share of await this.listOutgoing(owner, notebookId)) {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            { Delete: { TableName: this.tableName, Key: ownerKey(share) } },
            {
              Delete: {
                TableName: this.tableName,
                Key: granteeKey(share.granteeUserId, share.notebookId),
              },
            },
          ],
        }),
      );
    }
  }

  private async query(partition: string, prefix: string): Promise<Item[]> {
    const items: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const response = await this.db.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: { ':pk': partition, ':prefix': prefix },
          ExclusiveStartKey: start,
        }),
      );
      items.push(...((response.Items ?? []) as Item[]));
      start = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (start);
    return items;
  }

  private async write(share: Share, writes: NonNullable<TransactItems>): Promise<void> {
    const events = share.pullEvents();
    const partition = `S#${share.ownerSubscriptionId.value}`;
    await this.db.send(
      new TransactWriteCommand({
        TransactItems: [
          ...writes,
          ...events.map((event) => ({
            Put: { TableName: this.tableName, Item: outboxItemFor(event, partition) },
          })),
        ],
      }),
    );
    await this.outbox.published(events);
  }
}

type TransactItems = ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems'];
