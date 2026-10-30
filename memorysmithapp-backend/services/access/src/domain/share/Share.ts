/**
 * Share: a notebook of one subscription opened to a person of another
 * (RN-ACC-024 to RN-ACC-029), and the one door through the boundary of a
 * subscription (INV-01).
 *
 * It needs two consents and keeps both: the owner's, by sharing, and the
 * grantee's, by accepting. Until the second one the grantee reaches the name
 * and the description of the notebook and nothing else (RN-ACC-026). The door
 * closes when either side withdraws its consent — the owner revokes, the
 * grantee leaves — and while the owner's subscription grants no access.
 *
 * It is stored twice, in one transaction:
 * under the subscription that owns the notebook, where the owner lists and
 * revokes it, and under the grantee, where their session finds it without the
 * owner's subscription ever coming from a request. This entity is the one
 * fact both items carry.
 *
 * Every transition records its event, about the notebook and under the owner's
 * subscription, because who could reach a notebook is part of its life.
 */

import {
  type Authorship,
  createEvent,
  type DomainEvent,
  DomainError,
  err,
  type Instant,
  type NotebookId,
  ok,
  type Result,
  type SubscriptionId,
  type UserId,
} from '@memorysmithapp/kernel';
import type { Email } from '../values.js';

/**
 * What a share lets its grantee do, as its owner chose it (#347). A reader
 * reads and exports; a content editor also writes the notes and the files; a
 * notebook editor also maintains the folders, the Guidance and the Templates.
 * A model reader reaches only the model of a notebook declared as one, its
 * versions and the notebooks created from them, and never the notebook
 * itself (#355). Sharing, the profiles and deleting stay with the owner.
 */
export type ShareProfile = 'model-reader' | 'reader' | 'content-editor' | 'notebook-editor';

/** The profiles from the one that grants least to the one that grants most. */
export const SHARE_PROFILES: readonly ShareProfile[] = [
  'model-reader',
  'reader',
  'content-editor',
  'notebook-editor',
];

/** Whether `a` grants more than `b`. */
export function grantsMore(a: ShareProfile, b: ShareProfile): boolean {
  return SHARE_PROFILES.indexOf(a) > SHARE_PROFILES.indexOf(b);
}

/**
 * Where a share stands. `revoked` is never seen by the owner, whose item goes
 * the moment they revoke: it is what the grantee is told until they dismiss it
 * (RN-ACC-029).
 */
export type ShareState = 'pending' | 'accepted' | 'rejected' | 'left' | 'revoked';

export interface ShareProps {
  readonly notebookId: NotebookId;
  readonly ownerSubscriptionId: SubscriptionId;
  readonly ownerUserId: UserId;
  readonly ownerEmail: Email;
  readonly granteeUserId: UserId;
  readonly granteeEmail: Email;
  /** What the grantee may do now: the profile they accepted, or were offered. */
  readonly profile: ShareProfile;
  /**
   * An increase the owner offered on an accepted share, waiting for the
   * grantee's renewed acceptance; until then `profile` is what applies.
   */
  readonly pendingProfile: ShareProfile | null;
  /** When the increase waiting was offered, or null. */
  readonly pendingSince: Instant | null;
  readonly state: ShareState;
  readonly sharedAt: Instant;
  /** When the grantee answered, left, or the owner revoked. */
  readonly answeredAt: Instant | null;
  /** On a departure: whether the grantee chose to tell the owner (RN-ACC-028). */
  readonly notifyOwner: boolean;
  /** When the owner last dismissed the notice of an answer, or null. */
  readonly ownerSeenAt: Instant | null;
}

export class Share {
  private readonly events: DomainEvent[] = [];

  private constructor(private props: ShareProps) {}

  /** A share the owner asks for, with the profile they chose (RN-ACC-024). */
  static offer(
    input: Omit<
      ShareProps,
      | 'state'
      | 'sharedAt'
      | 'answeredAt'
      | 'notifyOwner'
      | 'ownerSeenAt'
      | 'pendingProfile'
      | 'pendingSince'
    >,
    by: Authorship,
  ): Result<Share, DomainError> {
    if (input.granteeUserId.equals(input.ownerUserId)) {
      return err(DomainError.validation('A notebook is not shared with its own owner'));
    }
    const share = new Share({
      ...input,
      pendingProfile: null,
      pendingSince: null,
      state: 'pending',
      sharedAt: by.at,
      answeredAt: null,
      notifyOwner: false,
      ownerSeenAt: null,
    });
    share.record('NotebookShared', by);
    return ok(share);
  }

  static rehydrate(props: ShareProps): Share {
    return new Share(props);
  }

  get notebookId(): NotebookId {
    return this.props.notebookId;
  }
  get ownerSubscriptionId(): SubscriptionId {
    return this.props.ownerSubscriptionId;
  }
  get ownerUserId(): UserId {
    return this.props.ownerUserId;
  }
  get ownerEmail(): Email {
    return this.props.ownerEmail;
  }
  get granteeUserId(): UserId {
    return this.props.granteeUserId;
  }
  get granteeEmail(): Email {
    return this.props.granteeEmail;
  }
  get profile(): ShareProfile {
    return this.props.profile;
  }
  get pendingProfile(): ShareProfile | null {
    return this.props.pendingProfile;
  }
  get pendingSince(): Instant | null {
    return this.props.pendingSince;
  }
  get state(): ShareState {
    return this.props.state;
  }
  get sharedAt(): Instant {
    return this.props.sharedAt;
  }
  get answeredAt(): Instant | null {
    return this.props.answeredAt;
  }
  get notifyOwner(): boolean {
    return this.props.notifyOwner;
  }
  get ownerSeenAt(): Instant | null {
    return this.props.ownerSeenAt;
  }

  /** Whether the door is open: accepted, and nothing else (RN-ACC-026). */
  get isOpen(): boolean {
    return this.props.state === 'accepted';
  }

  /**
   * Whether the owner can share this notebook with this person again. A share
   * waiting for an answer or already accepted is there; a rejected one does
   * not block a new one, and neither does a departure (RN-ACC-026).
   */
  get standsInTheWay(): boolean {
    return this.props.state === 'pending' || this.props.state === 'accepted';
  }

  /**
   * Whether the owner has a notice of it waiting: an answer of the grantee
   * they have not dismissed, and a departure only when the grantee chose to
   * tell them (RN-ACC-028, RN-ACC-029).
   */
  get ownerHasNotice(): boolean {
    const { state, answeredAt, ownerSeenAt, notifyOwner } = this.props;
    if (!answeredAt || ownerSeenAt) return false;
    if (state === 'left') return notifyOwner;
    return state === 'accepted' || state === 'rejected';
  }

  accept(by: Authorship): Result<void, DomainError> {
    if (this.props.state !== 'pending') {
      return err(DomainError.conflict('This share is not waiting for an answer'));
    }
    this.props = { ...this.props, state: 'accepted', answeredAt: by.at, ownerSeenAt: null };
    this.record('NotebookShareAccepted', by);
    return ok();
  }

  reject(by: Authorship): Result<void, DomainError> {
    if (this.props.state !== 'pending') {
      return err(DomainError.conflict('This share is not waiting for an answer'));
    }
    this.props = { ...this.props, state: 'rejected', answeredAt: by.at, ownerSeenAt: null };
    this.record('NotebookShareRejected', by);
    return ok();
  }

  /**
   * The grantee closes the door on a notebook they had accepted, and decides
   * whether the owner is told (RN-ACC-028). Silence governs the notice alone:
   * the owner's list still says they left.
   */
  leave(notifyOwner: boolean, by: Authorship): Result<void, DomainError> {
    if (this.props.state !== 'accepted') {
      return err(DomainError.conflict('Only a notebook you accepted can be left'));
    }
    this.props = {
      ...this.props,
      state: 'left',
      answeredAt: by.at,
      notifyOwner,
      ownerSeenAt: notifyOwner ? null : by.at,
    };
    this.record('NotebookShareLeft', by, { notifyOwner });
    return ok();
  }

  /** The owner closes the door, whatever stood behind it; the grantee is told. */
  revoke(by: Authorship): Result<void, DomainError> {
    if (!this.standsInTheWay) {
      return err(DomainError.notFound('This notebook is not shared with that person'));
    }
    this.props = { ...this.props, state: 'revoked', answeredAt: by.at };
    this.record('NotebookShareRevoked', by);
    return ok();
  }

  /**
   * The owner changes what the share grants (#347). Before the grantee answered,
   * the offer itself changes. Once accepted, a reduction applies at once and
   * needs no consent, and an increase waits for the grantee's renewed
   * acceptance, the accepted profile applying until then. Asking for the profile
   * already held withdraws an increase still waiting.
   */
  changeProfile(to: ShareProfile, by: Authorship): Result<void, DomainError> {
    const { state, profile, pendingProfile } = this.props;
    if (state === 'pending') {
      if (to === profile) return ok();
      this.props = { ...this.props, profile: to };
      this.record('NotebookShareProfileChanged', by, { from: profile, pending: false });
      return ok();
    }
    if (state !== 'accepted') {
      return err(DomainError.notFound('This notebook is not shared with that person'));
    }
    if (to === profile) {
      if (!pendingProfile) return ok();
      this.props = { ...this.props, pendingProfile: null, pendingSince: null };
      this.record('NotebookShareProfileChanged', by, { from: profile, pending: false });
      return ok();
    }
    if (grantsMore(to, profile)) {
      if (to === pendingProfile) return ok();
      this.props = { ...this.props, pendingProfile: to, pendingSince: by.at };
      this.record('NotebookShareProfileChanged', by, { from: profile, pending: true });
      return ok();
    }
    this.props = { ...this.props, profile: to, pendingProfile: null, pendingSince: null };
    this.record('NotebookShareProfileChanged', by, { from: profile, pending: false });
    return ok();
  }

  /** The grantee answers an increase waiting for them (#347). */
  answerIncrease(accept: boolean, by: Authorship): Result<void, DomainError> {
    const { state, pendingProfile } = this.props;
    if (state !== 'accepted' || !pendingProfile) {
      return err(DomainError.conflict('No increase of this share is waiting for an answer'));
    }
    const from = this.props.profile;
    this.props = {
      ...this.props,
      profile: accept ? pendingProfile : from,
      pendingProfile: null,
      pendingSince: null,
    };
    this.record(accept ? 'NotebookShareIncreaseAccepted' : 'NotebookShareIncreaseRejected', by, {
      from,
      offered: pendingProfile,
    });
    return ok();
  }

  /** The owner dismissed the notice of an answer (RN-ACC-029). */
  markSeen(at: Instant): void {
    this.props = { ...this.props, ownerSeenAt: at };
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private record(
    type:
      | 'NotebookShared'
      | 'NotebookShareAccepted'
      | 'NotebookShareRejected'
      | 'NotebookShareRevoked'
      | 'NotebookShareLeft'
      | 'NotebookShareProfileChanged'
      | 'NotebookShareIncreaseAccepted'
      | 'NotebookShareIncreaseRejected',
    by: Authorship,
    extra: Record<string, unknown> = {},
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.props.ownerSubscriptionId,
        subject: 'NOTEBOOK',
        subjectId: this.props.notebookId.value,
        authorship: by,
        payload: {
          notebookId: this.props.notebookId.value,
          granteeUserId: this.props.granteeUserId.value,
          granteeEmail: this.props.granteeEmail.value,
          profile: this.props.profile,
          pendingProfile: this.props.pendingProfile,
          ...extra,
        },
      }),
    );
  }
}
