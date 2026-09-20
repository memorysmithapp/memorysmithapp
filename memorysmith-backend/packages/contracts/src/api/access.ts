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
