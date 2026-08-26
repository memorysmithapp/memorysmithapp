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
  slugSchema,
  subscriptionStatusSchema,
  ulidSchema,
  userIdSchema,
  vaultRoleLimitSchema,
} from '../common.js';

/** One link between a user and a subscription (architecture-guide.md 8.3). */
export const subscriptionLinkSchema = z.object({
  subscriptionId: ulidSchema,
  name: z.string(),
  slug: slugSchema,
  status: subscriptionStatusSchema,
  isOwner: z.boolean(),
  isDefault: z.boolean(),
  joinedAt: instantSchema,
});

export const workspaceSchema = z.object({
  workspaceId: ulidSchema,
  name: z.string(),
  slug: slugSchema,
  isDefault: z.boolean(),
  /** The role of the current user in this workspace, already resolved. */
  role: roleSchema,
  createdAt: instantSchema,
});

/**
 * Everything the SPA needs to render its shell in one call: who the user is,
 * which subscription the session acts for, and which workspaces it reaches.
 * The UI hides the workspace level while there is only one, and hides the
 * subscription switcher while there is only one link (PP8).
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
  workspaces: z.array(workspaceSchema),
});

export const switchSubscriptionRequestSchema = z.object({
  subscriptionId: ulidSchema,
});

export const requestSubscriptionRequestSchema = z.object({
  name: z.string().min(1).max(120),
});

export const createWorkspaceRequestSchema = z.object({
  name: z.string().min(1).max(120),
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
  workspaceId: ulidSchema,
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
  name: z.string(),
  ownerEmail: z.string().email(),
  status: subscriptionStatusSchema,
  requestedAt: instantSchema,
  workspaceCount: z.number().int().nonnegative(),
});

export const approveSubscriptionRequestSchema = z.object({
  status: z.enum(['trial', 'active']),
});

export const rejectSubscriptionRequestSchema = z.object({
  /** Mandatory, and communicated to the requester (RN-SUB-009). */
  reason: z.string().min(1).max(1000),
});

export type SubscriptionLinkDto = z.infer<typeof subscriptionLinkSchema>;
export type WorkspaceDto = z.infer<typeof workspaceSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type InviteDto = z.infer<typeof inviteSchema>;
export type PlatformSubscriptionDto = z.infer<typeof platformSubscriptionSchema>;
export type SwitchSubscriptionRequest = z.infer<typeof switchSubscriptionRequestSchema>;
export type RequestSubscriptionRequest = z.infer<typeof requestSubscriptionRequestSchema>;
export type CreateWorkspaceRequest = z.infer<typeof createWorkspaceRequestSchema>;
export type InviteMemberRequest = z.infer<typeof inviteMemberRequestSchema>;
export type ChangeMemberRoleRequest = z.infer<typeof changeMemberRoleRequestSchema>;
export type TransferOwnershipRequest = z.infer<typeof transferOwnershipRequestSchema>;
export type SetVaultRoleLimitRequest = z.infer<typeof setVaultRoleLimitRequestSchema>;
export type ApproveSubscriptionRequest = z.infer<typeof approveSubscriptionRequestSchema>;
export type RejectSubscriptionRequest = z.infer<typeof rejectSubscriptionRequestSchema>;
