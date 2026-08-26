/**
 * The pre-token-generation trigger (architecture-guide.md, section 8.5).
 *
 * It is where the ACTIVE SUBSCRIPTION becomes a signed claim, and it is the
 * only place in the system that decides which subscription a session acts for.
 * Everything downstream reads the claim and never asks again, which is what
 * makes RN-SUB-002 hold: no request can name a subscription.
 *
 * It reads the LINKS of the user, which is exception 1 of section 8.3, and the
 * status from the META item of the chosen subscription. Two consequences are
 * deliberate:
 *
 *  - A user with no link gets NO claim, and a session with no claim reaches no
 *    workspace, vault or note. That is also what a platform admin session is:
 *    the impossibility is structural, not a role check (RN-SUB-016).
 *  - The status travels inside the token and therefore AGES WITH IT: a
 *    suspension takes effect on the next refresh. The delay is declared, and
 *    it is the same nature as the five minutes of the authorizer cache.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

interface TriggerEvent {
  request: { userAttributes: Record<string, string> };
  response?: unknown;
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env['ACCESS_TABLE'] ?? '';

export async function handler(event: TriggerEvent): Promise<TriggerEvent> {
  const userId = event.request.userAttributes['sub'];
  if (!userId || !tableName) return withoutClaims(event);

  const links = await db.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'SUB#' },
    }),
  );
  const items = links.Items ?? [];
  if (items.length === 0) return withoutClaims(event);

  // One link is marked as the default and is assumed when no other choice is
  // recorded (RN-SUB-012). Switching is an explicit act that flips this flag
  // and takes a new token (RN-SUB-013).
  const chosen = items.find((item) => item['isDefault'] === true) ?? items[0];
  const subscriptionId = String(chosen?.['subscriptionId'] ?? '');
  if (!subscriptionId) return withoutClaims(event);

  const meta = await db.send(
    new GetCommand({ TableName: tableName, Key: { PK: `S#${subscriptionId}`, SK: 'META' } }),
  );
  const status = String(meta.Item?.['status'] ?? 'pending_approval');

  return withClaims(event, {
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

/** No link yet: the token is valid, and it reaches no subscription data. */
function withoutClaims(event: TriggerEvent): TriggerEvent {
  event.response = { claimsAndScopeOverrideDetails: {} };
  return event;
}
