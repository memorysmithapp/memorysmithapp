/**
 * The pre-token-generation trigger (INV-02).
 *
 * It is where the ACTIVE SUBSCRIPTION becomes a signed claim, and it is the
 * only place in the system that decides which subscription a session acts for.
 * Everything downstream reads the claim and never asks again, which is what
 * makes RN-SUB-002 hold: no request can name a subscription.
 *
 * It reads the LINKS of the user, which is exception 1 of INV-01, and the
 * status from the META item of the chosen subscription. Two consequences are
 * deliberate:
 *
 *  - A user with no link gets NO SUBSCRIPTION claim, and a session with no
 *    such claim reaches no workspace, notebook or note.
 *  - A member of `platform-admin` gets NO SUBSCRIPTION claim EITHER, whatever
 *    links it holds (INV-12, RN-SUB-016). An operator account is meant to hold
 *    none, and this is what keeps the impossibility structural if one ever
 *    does: the group only takes the claim away, never grants anything.
 *  - The status travels inside the token and therefore AGES WITH IT: a
 *    suspension takes effect on the next refresh. The delay is declared, and
 *    it is the same nature as the five minutes of the authorizer cache.
 */

import { observe } from '@memorysmithapp/observability';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

interface TriggerEvent {
  request: {
    userAttributes: Record<string, string>;
    groupConfiguration?: { groupsToOverride?: string[] };
  };
  response?: unknown;
}

const PLATFORM_ADMIN = 'platform-admin';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env['ACCESS_TABLE'] ?? '';

/**
 * One line per token issued, named by the trigger that asked for it and
 * carrying the person's identifier and nothing of their attributes.
 */
export function handler(event: TriggerEvent): Promise<TriggerEvent> {
  const userId = event.request.userAttributes['sub'];
  return observe(
    {
      operation: String((event as { triggerSource?: unknown }).triggerSource ?? 'TokenGeneration'),
      ...(userId ? { userId } : {}),
    },
    () => claimsOf(event),
  );
}

async function claimsOf(event: TriggerEvent): Promise<TriggerEvent> {
  const userId = event.request.userAttributes['sub'];
  // Who the person is travels with EVERY token, subscription or not. The
  // access token carries no email of its own, and without it the API can only
  // invent an address from the identifier, which is what the screens would
  // then show the person as their own name.
  const identity: Record<string, string> = {};
  const email = event.request.userAttributes['email'];
  const name = event.request.userAttributes['name'];
  if (email) identity['email'] = email;
  if (name) identity['name'] = name;

  if (!userId || !tableName) return withClaims(event, identity);
  if (event.request.groupConfiguration?.groupsToOverride?.includes(PLATFORM_ADMIN)) {
    return withClaims(event, identity);
  }

  const links = await db.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'SUB#' },
    }),
  );
  const items = links.Items ?? [];
  if (items.length === 0) return withClaims(event, identity);

  // One link is marked as the default and is assumed when no other choice is
  // recorded (RN-SUB-012). Switching is an explicit act that flips this flag
  // and takes a new token (RN-SUB-013).
  const chosen = items.find((item) => item['isDefault'] === true) ?? items[0];
  const subscriptionId = String(chosen?.['subscriptionId'] ?? '');
  if (!subscriptionId) return withClaims(event, identity);

  const meta = await db.send(
    new GetCommand({ TableName: tableName, Key: { PK: `S#${subscriptionId}`, SK: 'META' } }),
  );
  const status = String(meta.Item?.['status'] ?? 'pending_approval');

  return withClaims(event, {
    ...identity,
    subscription_id: subscriptionId,
    subscription_status: status,
  });
}

function withClaims(event: TriggerEvent, claims: Record<string, string>): TriggerEvent {
  event.response = {
    claimsAndScopeOverrideDetails: {
      idTokenGeneration: { claimsToAddOrOverride: claims },
      accessTokenGeneration: { claimsToAddOrOverride: claims },
    },
  };
  return event;
}
