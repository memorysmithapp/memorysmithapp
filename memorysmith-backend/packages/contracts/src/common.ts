/**
 * Primitive schemas shared by the event contracts and the API DTOs.
 *
 * Zod lives on the edge and in the contracts, never inside the domain
 * (architecture-guide.md, section 4.1): the domain validates through its own
 * value objects, and duplicating that here would create two sources of truth
 * for the same rule.
 */

import { z } from 'zod';

export const ulidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Not a ULID');
export const userIdSchema = z.string().min(1).max(128);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Not a slug');
export const positionSchema = z.string().regex(/^[a-zA-Z][0-9A-Za-z]*$/, 'Not a position');
export const instantSchema = z.string().datetime({ offset: false });
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const roleSchema = z.enum(['NONE', 'VIEWER', 'EDITOR', 'OWNER']);
export const membershipRoleSchema = z.enum(['EDITOR', 'VIEWER']);
export const vaultRoleLimitSchema = z.literal('VIEWER');

export const subscriptionStatusSchema = z.enum([
  'pending_approval',
  'trial',
  'active',
  'rejected',
  'suspended',
  'canceled',
]);

/** The pointer that links DynamoDB to S3 (architecture-guide.md, section 9.2). */
export const contentRefSchema = z.object({
  contentId: ulidSchema,
  versionId: z.string().min(1),
  sha256: sha256Schema,
  bytes: z.number().int().nonnegative(),
});

export const agentIdentitySchema = z.object({
  clientId: z.string().min(1).max(512),
  clientName: z.string().min(1).max(200),
});

/** Who wrote it: the human, and the agent when there was one (RN-AUD-002). */
export const authorshipSchema = z.object({
  userId: userIdSchema,
  agent: agentIdentitySchema.nullable(),
  at: instantSchema,
});

export const contentRoleSchema = z.enum(['body', 'guidance', 'template']);

export const removalPolicySchema = z.enum(['CASCADE', 'REJECT_IF_NOT_EMPTY']);
export const slugConflictPolicySchema = z.enum(['REJECT', 'RENAME']);

export type Role = z.infer<typeof roleSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type SubscriptionStatusName = z.infer<typeof subscriptionStatusSchema>;
export type ContentRefDto = z.infer<typeof contentRefSchema>;
export type AuthorshipDto = z.infer<typeof authorshipSchema>;
export type AgentIdentityDto = z.infer<typeof agentIdentitySchema>;
export type ContentRoleName = z.infer<typeof contentRoleSchema>;
export type RemovalPolicyName = z.infer<typeof removalPolicySchema>;
export type SlugConflictPolicyName = z.infer<typeof slugConflictPolicySchema>;
