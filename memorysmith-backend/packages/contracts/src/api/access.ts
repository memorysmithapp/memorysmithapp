/**
 * DTOs of svc-access (architecture-guide.md, section 14.1).
 *
 * No route takes a subscriptionId: it always comes from the token (RN-SUB-002).
 * The one endpoint that names a subscription is the explicit switch of the
 * active one, which is a session operation and not a business operation
 * (RN-SUB-013).
 */

import { z } from 'zod';
import {
  instantSchema,
  membershipRoleSchema,
  roleSchema,
  storageQuotaSchema,
  subscriptionStatusSchema,
  subscriptionTypeSchema,
  ulidSchema,
  userIdSchema,
  vaultRoleLimitSchema,
} from '../common.js';

/** One link between a user and a subscription (architecture-guide.md 8.3). */
export const subscriptionLinkSchema = z.object({
  subscriptionId: ulidSchema,
  status: subscriptionStatusSchema,
  type: subscriptionTypeSchema,
  quota: storageQuotaSchema,
  isOwner: z.boolean(),
  isDefault: z.boolean(),
  joinedAt: instantSchema,
});

/**
 * Everything the SPA needs to render its shell in one call: who the user is,
 * which subscription the session acts for, and with which role. The UI hides
 * the member list while there is only the owner, and hides the subscription
 * switcher while there is only one link (PP8).
 */
export const sessionSchema = z.object({
  user: z.object({
    userId: userIdSchema,
    email: z.string().email(),
    name: z.string(),
    isPlatformAdmin: z.boolean(),
  }),
  activeSubscription: subscriptionLinkSchema.nullable(),
  subscriptions: z.array(subscriptionLinkSchema),
  /**
   * The role of this user in the ACTIVE subscription, already resolved: OWNER
   * for the holder, EDITOR or VIEWER for a member, NONE for a session that
   * carries no subscription at all. A per-vault ceiling can lower it, never
   * raise it (RN-ACC-011), and that lives with the vault.
   */
  role: roleSchema,
});

export const switchSubscriptionRequestSchema = z.object({
  subscriptionId: ulidSchema,
});

/**
 * Type and quota are the commercial shape of the subscription, chosen when it
 * is asked for. Both default on the server, so a request with no body at all
 * still asks for a valid subscription.
 *
 * A subscription HAS NO NAME. What identifies it is its perpetual id, and who
 * holds it is the owner: a name would be one more thing to keep in sync with
 * nothing to keep it honest.
 */
export const requestSubscriptionRequestSchema = z.object({
  type: subscriptionTypeSchema.optional(),
  quota: storageQuotaSchema.optional(),
});

export const memberSchema = z.object({
  userId: userIdSchema,
  email: z.string().email(),
  name: z.string(),
  role: membershipRoleSchema,
  invitedBy: userIdSchema.nullable(),
  joinedAt: instantSchema,
});

export const inviteMemberRequestSchema = z.object({
  email: z.string().email(),
  role: membershipRoleSchema,
});

export const inviteSchema = z.object({
  inviteId: ulidSchema,
  email: z.string().email(),
  role: membershipRoleSchema,
  status: z.enum(['pending', 'accepted', 'expired', 'revoked']),
  sentAt: instantSchema,
  expiresAt: instantSchema,
});

export const changeMemberRoleRequestSchema = z.object({
  role: membershipRoleSchema,
});

export const transferOwnershipRequestSchema = z.object({
  toUserId: userIdSchema,
});

export const setVaultRoleLimitRequestSchema = z.object({
  limit: vaultRoleLimitSchema,
});

/**
 * The platform queue. Metadata only: never a vault name, never content
 * (software-vision.md, section 4.6). The projection of GSI2 is exactly this
 * list of fields, and widening it is a privacy decision.
 */
export const platformSubscriptionSchema = z.object({
  subscriptionId: ulidSchema,
  ownerEmail: z.string().email(),
  status: subscriptionStatusSchema,
  type: subscriptionTypeSchema,
  quota: storageQuotaSchema,
  requestedAt: instantSchema,
  memberCount: z.number().int().nonnegative(),
});

export const approveSubscriptionRequestSchema = z.object({
  status: z.enum(['trial', 'active']),
});

export const rejectSubscriptionRequestSchema = z.object({
  /** Mandatory, and communicated to the requester (RN-SUB-009). */
  reason: z.string().min(1).max(1000),
});

/**
 * The administrative override: it sets the status to whatever it names, with
 * no transition machine in the way. It exists for operating an environment,
 * never for the ordinary review path, which is approve / reject / suspend /
 * reactivate above (RN-SUB-018).
 */
export const setSubscriptionStatusRequestSchema = z.object({
  status: subscriptionStatusSchema,
});

/** Either half may be omitted, and then it keeps the value it already had. */
export const changeSubscriptionPlanRequestSchema = z.object({
  type: subscriptionTypeSchema.optional(),
  quota: storageQuotaSchema.optional(),
});

export type SubscriptionLinkDto = z.infer<typeof subscriptionLinkSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type InviteDto = z.infer<typeof inviteSchema>;
export type PlatformSubscriptionDto = z.infer<typeof platformSubscriptionSchema>;
export type SwitchSubscriptionRequest = z.infer<typeof switchSubscriptionRequestSchema>;
export type RequestSubscriptionRequest = z.infer<typeof requestSubscriptionRequestSchema>;
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;
export type ChangeMemberRoleRequest = z.infer<typeof changeMemberRoleRequestSchema>;
export type TransferOwnershipRequest = z.infer<typeof transferOwnershipRequestSchema>;
export type SetVaultRoleLimitRequest = z.infer<typeof setVaultRoleLimitRequestSchema>;
export type ApproveSubscriptionRequest = z.infer<typeof approveSubscriptionRequestSchema>;
export type RejectSubscriptionRequest = z.infer<typeof rejectSubscriptionRequestSchema>;
export type SetSubscriptionStatusRequest = z.infer<typeof setSubscriptionStatusRequestSchema>;
export type ChangeSubscriptionPlanRequest = z.infer<typeof changeSubscriptionPlanRequestSchema>;
