/**
 * The connector bindings against DynamoDB Local (architecture-guide.md, 9.4).
 *
 * What only the real table can say: that binding a token twice is refused by the
 * condition and not by a read beforehand, that every item starts with the
 * subscription of the token (rule 1), and that it carries the TTL the table
 * expires it by.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  AgentIdentity,
  Instant,
  SubscriptionContext,
  SubscriptionId,
  type Result,
} from '@memorysmith/kernel';
import { DynamoConnectorBindingRepository } from '../../src/adapters/outbound/dynamodb/DynamoAccess.js';

const TABLE_NAME = 'mv-access-test';

const raw = new DynamoDBClient({
  endpoint: process.env['DYNAMODB_ENDPOINT'] ?? 'http://127.0.0.1:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? 'memorysmith',
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? 'memorysmith-local',
  },
});
const db = DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } });

function unwrap<T>(result: Result<T, { message: string }>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

const NOW = unwrap(Instant.fromISO('2026-09-13T12:00:00.000Z'));
const IN_AN_HOUR = unwrap(Instant.fromISO('2026-09-13T13:00:00.000Z'));
const claude = unwrap(
  AgentIdentity.create('https://claude.ai/oauth/mcp-oauth-client-metadata', 'Claude'),
);
const other = unwrap(AgentIdentity.create('https://other.example.com/metadata.json', 'Other'));

function contextOf(subscriptionId: SubscriptionId = SubscriptionId.generate()) {
  return unwrap(
    SubscriptionContext.fromClaims({
      sub: 'user-owner',
      subscription_id: subscriptionId.value,
      subscription_status: 'active',
    }),
  );
}

/** The key shape of mv-access, GSI2 included. */
beforeAll(async () => {
  const existing = await raw.send(new ListTablesCommand({}));
  if (existing.TableNames?.includes(TABLE_NAME)) {
    await raw.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
  }
  await raw.send(
    new CreateTableCommand({
      TableName: TABLE_NAME,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    }),
  );
}, 60_000);

describe('DynamoConnectorBindingRepository', () => {
  it('binds an access token once, by the condition of the write', async () => {
    const repository = new DynamoConnectorBindingRepository(contextOf(), db, TABLE_NAME);

    expect(await repository.bindAccessToken('jti-1', claude, IN_AN_HOUR)).toBe(true);
    expect(await repository.bindAccessToken('jti-1', other, IN_AN_HOUR)).toBe(false);
    expect((await repository.agentOfAccessToken('jti-1', NOW))?.clientName).toBe('Claude');
  });

  it('keys the binding under the subscription of the token, with the TTL of its expiry', async () => {
    const context = contextOf();
    const repository = new DynamoConnectorBindingRepository(context, db, TABLE_NAME);
    await repository.bindAccessToken('jti-keyed', claude, IN_AN_HOUR);

    const stored = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `S#${context.subscriptionId.value}`, SK: 'CONNECTOR#TOKEN#jti-keyed' },
      }),
    );
    expect(stored.Item?.['clientId']).toBe(claude.clientId);
    expect(stored.Item?.['ttl']).toBe(IN_AN_HOUR.toEpochSeconds());
  });

  it('answers nothing for a binding past its expiry that the TTL has not removed yet', async () => {
    const repository = new DynamoConnectorBindingRepository(contextOf(), db, TABLE_NAME);
    await repository.bindAccessToken('jti-expired', claude, IN_AN_HOUR);

    expect(await repository.agentOfAccessToken('jti-expired', IN_AN_HOUR)).toBeNull();
  });

  it('replaces the connector a refresh token renews', async () => {
    const repository = new DynamoConnectorBindingRepository(contextOf(), db, TABLE_NAME);
    const hash = 'c'.repeat(64);
    await repository.bindRefreshToken(hash, other, IN_AN_HOUR);
    await repository.bindRefreshToken(hash, claude, IN_AN_HOUR);

    expect((await repository.agentOfRefreshToken(hash, NOW))?.clientName).toBe('Claude');
  });

  it('finds no binding under another subscription', async () => {
    const hash = 'd'.repeat(64);
    const bound = new DynamoConnectorBindingRepository(contextOf(), db, TABLE_NAME);
    await bound.bindAccessToken('jti-isolated', claude, IN_AN_HOUR);
    await bound.bindRefreshToken(hash, claude, IN_AN_HOUR);

    const elsewhere = new DynamoConnectorBindingRepository(contextOf(), db, TABLE_NAME);
    expect(await elsewhere.agentOfAccessToken('jti-isolated', NOW)).toBeNull();
    expect(await elsewhere.agentOfRefreshToken(hash, NOW)).toBeNull();
  });
});
