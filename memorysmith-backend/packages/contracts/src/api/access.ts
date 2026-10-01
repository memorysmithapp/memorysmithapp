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
  agentIdentitySchema,
  instantSchema,
  membershipRoleSchema,
  roleSchema,
  storageQuotaSchema,
  subscriptionStatusSchema,
  subscriptionTypeSchema,
  ulidSchema,
  userIdSchema,
  notebookRoleLimitSchema,
} from '../common.js';

/**
 * Where the face beside a person comes from (RN-ACC-022). A URL they type is
 * not among them: an avatar renders on every screen, for every member, without
 * anybody opening anything, so a host of their own would be disclosed to
 * everyone who ever draws it (RN-DSC-040).
 */
export const avatarSourceSchema = z.enum(['gravatar', 'initials', 'upload']);

/** The types a picture is kept as: the three every browser draws without executing anything. */
export const PICTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/**
 * The profile the person edits (RN-ACC-021). The e-mail is here to be SHOWN:
 * it is what they sign in with and the key every message goes to, and changing
 * it is another delivery with another rule.
 */
export const profileSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  avatar: avatarSourceSchema,
  /** The uploaded picture as a data URL, or null when no picture was sent. */
  picture: z.string().nullable(),
});

export const editProfileRequestSchema = z.object({
  name: z.string(),
  avatar: avatarSourceSchema,
});

/**
 * The picture, inline and base64, because the interface has already drawn it
 * down to a side that fits in a request: an upload that asks the browser to
 * perform a PUT of its own is one more door for one small image.
 */
export const setPictureRequestSchema = z.object({
  mime: z.enum(PICTURE_MIME_TYPES),
  bytes: z.string().min(1),
});

/**
 * A CHANGE and not a recovery (RN-ACC-023): the current password proves the
 * person in front of the screen, where a code sent to a mailbox proves the
 * mailbox.
 */
export const changePasswordRequestSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(1),
});

/** One link between a user and a subscription (architecture-guide.md 8.3). */
export const subscriptionLinkSchema = z.object({
  subscriptionId: ulidSchema,
  status: subscriptionStatusSchema,
  type: subscriptionTypeSchema,
  quota: storageQuotaSchema,
  /**
   * The same ceiling as a number, so the UI never has to know whether "500MB"
   * means 500 × 1024² or 500 × 10⁶. One side owns that conversion, and it is
   * the side that owns the quota.
   */
  quotaBytes: z.number().int().positive(),
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
    /**
     * Where the face beside this person comes from, and the picture itself
     * when they uploaded one (RN-ACC-022). It rides on the session because
     * every screen draws it and none of them should have to ask.
     */
    avatar: avatarSourceSchema,
    picture: z.string().nullable(),
  }),
  activeSubscription: subscriptionLinkSchema.nullable(),
  subscriptions: z.array(subscriptionLinkSchema),
  /**
   * The role of this user in the ACTIVE subscription, already resolved: OWNER
   * for the holder, EDITOR or VIEWER for a member, NONE for a session that
   * carries no subscription at all. A per-notebook ceiling can lower it, never
   * raise it (RN-ACC-011), and that lives with the notebook.
   */
  role: roleSchema,
  /**
   * Bytes of live content the active subscription is storing (RN-SUB-021),
   * null when the session carries no subscription. Paired with the `quota` of
   * the active link, it is what lets the shell show how much room is left.
   */
  usedBytes: z.number().int().nonnegative().nullable(),
  /**
   * Whether this person has already been shown what the product is (#167).
   * The interface opens the welcome surface when it is false, and records it
   * so the next sign-in opens the dashboard instead.
   */
  welcomeSeen: z.boolean(),
});

/** Bytes and how many, for one kind of what a subscription stores (#197). */
export const usageShareSchema = z.object({
  count: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
});

/**
 * What fills the space of the active subscription (#197), read from counters
 * and never from content. `byType` is about the subscription, which is what
 * the quota is about, and adds up to `usedBytes`: the current revision of each
 * note, the files, the kept exports, the room open uploads reserve as
 * `transit`, and the Guidance and Templates together as `others`. A revision
 * that is no longer current costs nothing and is only counted, in
 * `counts.revisions`.
 *
 * `notebooks` lists only the notebooks the requester sees (a hidden one would
 * answer 404), largest first, so they may add up to less than the total: for
 * anyone but the owner, and for the owner too when an export or an upload
 * outlived its notebook. What they leave is drawn as one line that names no
 * notebook (RN-PRT-029), which is the rule, not a defect.
 */
export const subscriptionUsageSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  quotaBytes: z.number().int().positive(),
  byType: z.object({
    notes: usageShareSchema,
    files: usageShareSchema,
    exports: usageShareSchema,
    /** The room open uploads reserve, by their declared size (RN-SUB-025). */
    transit: usageShareSchema,
    others: usageShareSchema,
  }),
  counts: z.object({
    notebooks: z.number().int().nonnegative(),
    folders: z.number().int().nonnegative(),
    revisions: z.number().int().nonnegative(),
  }),
  notebooks: z.array(
    z.object({
      notebookId: ulidSchema,
      name: z.string(),
      bytes: z.number().int().nonnegative(),
      notes: z.number().int().nonnegative(),
      folders: z.number().int().nonnegative(),
      files: z.number().int().nonnegative(),
      exports: z.number().int().nonnegative(),
      /** Open uploads going to this notebook, whose room its bytes include (RN-SUB-025). */
      uploads: z.number().int().nonnegative(),
    }),
  ),
});

export const switchSubscriptionRequestSchema = z.object({
  subscriptionId: ulidSchema,
});

/**
 * The languages the product writes to an account in (RN-ACC-018): every message
 * it sends that account is written in the one recorded on it.
 */
export const accountLocaleSchema = z.enum(['pt_BR', 'en_US']);

/** The language the person chose in the interface, recorded on their account. */
export const chooseLanguageRequestSchema = z.object({
  locale: accountLocaleSchema,
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

export const changeMemberRoleRequestSchema = z.object({
  role: membershipRoleSchema,
});

export const transferOwnershipRequestSchema = z.object({
  toUserId: userIdSchema,
});

export const setNotebookRoleLimitRequestSchema = z.object({
  limit: notebookRoleLimitSchema,
});

/**
 * The platform queue. Metadata only: never a notebook name, never content
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

/**
 * What the connector proxy asks Access to record when it hands out a token
 * (architecture-guide.md, section 13.3, item 4).
 *
 * No Cognito token can say which connector it was issued to: every token of the
 * proxy carries the proxy's own app client, and no trigger may change that
 * claim. The proxy is the one party that sees the connector and the token
 * together, at `/token`, so it binds the two there, and the core reads the
 * binding whenever the token writes (RN-AGT-001).
 *
 * The access token travels so that Access verifies it and takes the
 * subscription and the identifier of the token from its own claims, never from
 * this body. The refresh token never travels: only its SHA-256, which is what a
 * later refresh is matched by.
 */
const tokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const connectorBindingRequestSchema = z.discriminatedUnion('grant', [
  z.object({
    grant: z.literal('authorization_code'),
    accessToken: z.string().min(1),
    connector: agentIdentitySchema,
    refreshTokenHash: tokenHashSchema.nullable(),
  }),
  z.object({
    grant: z.literal('refresh_token'),
    accessToken: z.string().min(1),
    refreshTokenHash: tokenHashSchema,
    /** Present when Cognito rotated the refresh token on this exchange. */
    rotatedRefreshTokenHash: tokenHashSchema.nullable(),
  }),
]);

/** The connector a session acts through, which is how `whoami` names it. */
export const connectorSchema = agentIdentitySchema;

/**
 * A share of a notebook with a person who holds another subscription
 * (RN-ACC-024 to RN-ACC-030). The notebook stays under the subscription that
 * owns it; the share is the one door through that boundary, and it opens only
 * when the person it names accepts it.
 *
 * `read-write` is in the contract so that the day it is offered changes no
 * shape; no share grants it yet, and asking for it is refused (RN-ACC-024).
 */
export const shareAccessSchema = z.enum(['read', 'read-write']);

/** Where a share stands, as its owner sees it. */
export const shareStateSchema = z.enum(['pending', 'accepted', 'rejected', 'left']);

/**
 * Sharing a notebook with an e-mail. The answer is the same whether or not that
 * e-mail has an account, so the door cannot be used to find out who is a
 * customer (RN-ACC-025).
 */
export const shareNotebookRequestSchema = z.object({
  email: z.string().min(1),
  access: shareAccessSchema,
});

/** One person a notebook is shared with, in the owner's Share dialog. */
export const outgoingShareSchema = z.object({
  notebookId: ulidSchema,
  granteeUserId: userIdSchema,
  granteeEmail: z.string(),
  access: shareAccessSchema,
  state: shareStateSchema,
  sharedAt: instantSchema,
  answeredAt: instantSchema.nullable(),
});

/**
 * A notebook shared with the person asking, as their Home draws it. A pending
 * one carries only its name and description (RN-ACC-026); an accepted one
 * carries what a card shows.
 */
export const incomingShareSchema = z.object({
  notebookId: ulidSchema,
  name: z.string(),
  description: z.string(),
  ownerEmail: z.string(),
  access: shareAccessSchema,
  state: z.enum(['pending', 'accepted']),
  sharedAt: instantSchema,
  noteCount: z.number().int().nonnegative().nullable(),
  updatedAt: instantSchema.nullable(),
});

/** Leaving a notebook shared with me, and whether its owner is told (RN-ACC-028). */
export const leaveShareRequestSchema = z.object({
  notifyOwner: z.boolean(),
});

/**
 * What the notifications button lists (RN-ACC-029): every change of a share,
 * told to the other side. `shared` waits for an answer; the others are read and
 * dismissed.
 */
export const notificationSchema = z.object({
  kind: z.enum(['shared', 'revoked', 'accepted', 'rejected', 'left']),
  notebookId: ulidSchema,
  /** The name of the notebook, or null when it can no longer be read. */
  notebookName: z.string().nullable(),
  /** Who did it: the owner for `shared` and `revoked`, the grantee otherwise. */
  person: z.string(),
  /** The grantee, on the notices of the owner, which is how one is dismissed. */
  granteeUserId: userIdSchema.nullable(),
  at: instantSchema,
});

export const notificationListSchema = z.object({
  notifications: z.array(notificationSchema),
});

export type SubscriptionLinkDto = z.infer<typeof subscriptionLinkSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type PlatformSubscriptionDto = z.infer<typeof platformSubscriptionSchema>;
export type SwitchSubscriptionRequest = z.infer<typeof switchSubscriptionRequestSchema>;
export type AccountLocaleDto = z.infer<typeof accountLocaleSchema>;
export type AvatarSourceDto = z.infer<typeof avatarSourceSchema>;
export type ProfileDto = z.infer<typeof profileSchema>;
export type EditProfileRequest = z.infer<typeof editProfileRequestSchema>;
export type SetPictureRequest = z.infer<typeof setPictureRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type ChooseLanguageRequest = z.infer<typeof chooseLanguageRequestSchema>;
export type RequestSubscriptionRequest = z.infer<typeof requestSubscriptionRequestSchema>;
export type ChangeMemberRoleRequest = z.infer<typeof changeMemberRoleRequestSchema>;
export type TransferOwnershipRequest = z.infer<typeof transferOwnershipRequestSchema>;
export type SetNotebookRoleLimitRequest = z.infer<typeof setNotebookRoleLimitRequestSchema>;
export type ApproveSubscriptionRequest = z.infer<typeof approveSubscriptionRequestSchema>;
export type RejectSubscriptionRequest = z.infer<typeof rejectSubscriptionRequestSchema>;
export type SetSubscriptionStatusRequest = z.infer<typeof setSubscriptionStatusRequestSchema>;
export type ChangeSubscriptionPlanRequest = z.infer<typeof changeSubscriptionPlanRequestSchema>;
export type ConnectorBindingRequest = z.infer<typeof connectorBindingRequestSchema>;
export type ConnectorDto = z.infer<typeof connectorSchema>;
export type UsageShareDto = z.infer<typeof usageShareSchema>;
export type SubscriptionUsageDto = z.infer<typeof subscriptionUsageSchema>;
export type ShareAccessDto = z.infer<typeof shareAccessSchema>;
export type ShareStateDto = z.infer<typeof shareStateSchema>;
export type ShareNotebookRequest = z.infer<typeof shareNotebookRequestSchema>;
export type OutgoingShareDto = z.infer<typeof outgoingShareSchema>;
export type IncomingShareDto = z.infer<typeof incomingShareSchema>;
export type LeaveShareRequest = z.infer<typeof leaveShareRequestSchema>;
export type NotificationDto = z.infer<typeof notificationSchema>;
export type NotificationListDto = z.infer<typeof notificationListSchema>;
