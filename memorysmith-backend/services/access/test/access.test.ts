import { beforeEach, describe, expect, it } from 'vitest';
import {
  Authorship,
  Instant,
  Role,
  SubscriptionContext,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
  type Result,
} from '@memorysmith/kernel';
import { Subscription } from '../src/domain/subscription/Subscription.js';
import { Email, RejectionReason } from '../src/domain/values.js';
import {
  InMemoryAccessDatabase,
  InMemoryInviteRepository,
  InMemoryOnboarding,
  InMemoryPlatformAdmin,
  InMemorySubscriptionRepository,
  InMemoryUserLinkRepository,
} from '../src/adapters/outbound/memory/InMemoryAccess.js';
import { RecordingEventPublisher } from './recording-publisher.js';
import {
  GetSession,
  RequestSubscription,
  SwitchActiveSubscription,
} from '../src/application/onboarding.js';
import { ListPlatformQueue, ReviewSubscription } from '../src/application/platform.js';
import {
  AcceptInvite,
  ChangeMemberRole,
  InviteMember,
  RemoveMember,
  TransferOwnership,
} from '../src/application/members.js';
import { ResolveRequestContext } from '../src/application/ResolveRequestContext.js';

function unwrap<T>(result: Result<T, { message: string }>): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error.message}`);
  return result.value;
}

function expectErr<T, E>(result: Result<T, E>): E {
  if (result.ok) throw new Error('Expected an error, got ok');
  return result.error;
}

const owner = unwrap(UserId.create('user-owner'));
const invitee = unwrap(UserId.create('user-invitee'));
const admin = unwrap(UserId.create('user-platform-admin'));

function profileOf(user: UserId, email: string, isPlatformAdmin = false) {
  return {
    userId: user,
    email: unwrap(Email.create(email)),
    name: email.split('@')[0] ?? 'user',
    isPlatformAdmin,
  };
}

function contextOf(subscriptionId: SubscriptionId, user: UserId, status = 'active') {
  return unwrap(
    SubscriptionContext.fromClaims({
      sub: user.value,
      subscription_id: subscriptionId.value,
      subscription_status: status,
    }),
  );
}

let db: InMemoryAccessDatabase;
let events: RecordingEventPublisher;

beforeEach(() => {
  db = new InMemoryAccessDatabase();
  events = new RecordingEventPublisher();
});

describe('Subscription: the identifier is perpetual', () => {
  function newSubscription() {
    return unwrap(
      Subscription.request({
        id: SubscriptionId.generate(),
        ownerId: owner,
        ownerEmail: 'owner@example.com',
        by: Authorship.byHuman(owner),
      }),
    );
  }

  it('starts pending and grants nobody operational access', () => {
    const subscription = newSubscription();
    expect(subscription.status.name).toBe('pending_approval');
    expect(subscription.grantsOperationalAccess).toBe(false);
    expect(subscription.pullEvents()[0]?.type).toBe('SubscriptionRequested');
  });

  it('keeps the same identifier across every transition', () => {
    const subscription = newSubscription();
    const id = subscription.id.value;

    unwrap(subscription.approve(SubscriptionStatus.ACTIVE, admin, Authorship.byHuman(admin)));
    unwrap(subscription.suspend(admin, Authorship.byHuman(admin)));
    unwrap(subscription.reactivate(SubscriptionStatus.ACTIVE, admin, Authorship.byHuman(admin)));
    unwrap(subscription.cancel(Authorship.byHuman(owner)));
    unwrap(subscription.reactivate(SubscriptionStatus.ACTIVE, admin, Authorship.byHuman(admin)));

    // Cancelling and reactivating are field changes, never a migration.
    expect(subscription.id.value).toBe(id);
    expect(subscription.status.name).toBe('active');
  });

  it('refuses a transition the machine does not allow', () => {
    const subscription = newSubscription();
    const error = expectErr(subscription.suspend(admin, Authorship.byHuman(admin)));
    expect(error.code).toBe('CONFLICT');
    expect(error.details).toEqual({ from: 'pending_approval', to: 'suspended' });
  });

  it('requires a reason to reject, and lets the requester ask again', () => {
    const subscription = newSubscription();
    expect(expectErr(RejectionReason.create('')).code).toBe('VALIDATION');

    unwrap(
      subscription.reject(
        unwrap(RejectionReason.create('Fora do perfil comercial nesta fase')),
        admin,
        Authorship.byHuman(admin),
      ),
    );
    expect(subscription.status.name).toBe('rejected');
    expect(subscription.rejectionReason?.value).toContain('perfil comercial');

    unwrap(subscription.requestAgain(Authorship.byHuman(owner)));
    expect(subscription.status.name).toBe('pending_approval');
    expect(subscription.rejectionReason).toBeNull();
  });

  it('approves only into trial or active', () => {
    const subscription = newSubscription();
    expect(
      expectErr(
        subscription.approve(SubscriptionStatus.SUSPENDED, admin, Authorship.byHuman(admin)),
      ).code,
    ).toBe('VALIDATION');
    unwrap(subscription.approve(SubscriptionStatus.TRIAL, admin, Authorship.byHuman(admin)));
    expect(subscription.reviewedBy?.value).toBe(admin.value);
  });

  it('has exactly one owner, and transferring is the only way to change it', () => {
    const subscription = newSubscription();
    const previous = unwrap(subscription.transferOwnership(invitee, Authorship.byHuman(owner)));
    expect(previous.value).toBe(owner.value);
    expect(subscription.isOwner(invitee)).toBe(true);
    expect(
      expectErr(subscription.transferOwnership(invitee, Authorship.byHuman(invitee))).code,
    ).toBe('VALIDATION');
  });
});

describe('Onboarding', () => {
  it('creates the subscription and the link, and nothing between them', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const links = new InMemoryUserLinkRepository(db);
    const useCase = new RequestSubscription(onboarding, links);

    const created = unwrap(
      await useCase.execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );

    expect(db.subscriptions.size).toBe(1);
    expect(await links.linksOf(owner)).toHaveLength(1);
    expect(events.ofType('SubscriptionRequested')).toHaveLength(1);
    expect(created.subscriptionId.value).toHaveLength(26);
  });

  it('takes the plan given, and defaults it when none is', async () => {
    const useCase = new RequestSubscription(
      new InMemoryOnboarding(db, events),
      new InMemoryUserLinkRepository(db),
    );

    const { subscriptionId } = unwrap(
      await useCase.execute({
        profile: profileOf(owner, 'owner@example.com'),
        type: 'individual',
        quota: '2GB',
        by: Authorship.byHuman(owner),
      }),
    );
    const stored = db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription;
    expect(stored?.type.name).toBe('individual');
    expect(stored?.quota.name).toBe('2GB');

    const other = unwrap(
      await new RequestSubscription(
        new InMemoryOnboarding(db, events),
        new InMemoryUserLinkRepository(db),
      ).execute({
        profile: profileOf(invitee, 'invitee@example.com'),
        by: Authorship.byHuman(invitee),
      }),
    );
    expect(db.subscriptions.get(`S#${other.subscriptionId.value}`)?.subscription.quota.name).toBe(
      '1GB',
    );
  });

  it('refuses a plan the product does not sell', async () => {
    const refused = await new RequestSubscription(
      new InMemoryOnboarding(db, events),
      new InMemoryUserLinkRepository(db),
    ).execute({
      profile: profileOf(owner, 'owner@example.com'),
      quota: '10GB',
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(refused).code).toBe('VALIDATION');
    expect(db.subscriptions.size).toBe(0);
  });

  it('refuses a second subscription for the same owner', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const useCase = new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db));
    await useCase.execute({
      profile: profileOf(owner, 'owner@example.com'),
      by: Authorship.byHuman(owner),
    });
    const second = await useCase.execute({
      profile: profileOf(owner, 'owner@example.com'),
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(second).code).toBe('CONFLICT');
  });
});

describe('Platform surface', () => {
  async function seed() {
    const onboarding = new InMemoryOnboarding(db, events);
    const requested = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );
    return requested.subscriptionId;
  }

  it('lists the queue with metadata only', async () => {
    const subscriptionId = await seed();
    const queue = unwrap(
      await new ListPlatformQueue(new InMemoryPlatformAdmin(db, events)).execute({
        actor: { userId: admin, isPlatformAdmin: true },
        status: 'pending_approval',
      }),
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual({
      subscriptionId: subscriptionId.value,
      ownerEmail: 'owner@example.com',
      status: 'pending_approval',
      type: 'individual',
      quota: '1GB',
      requestedAt: expect.any(String),
      memberCount: 0,
    });
    // Nothing about vaults or content is even representable in this view.
    expect(Object.keys(queue[0] ?? {})).not.toContain('vaults');
  });

  it('answers 404 to a caller who is not a platform admin', async () => {
    await seed();
    const error = expectErr(
      await new ListPlatformQueue(new InMemoryPlatformAdmin(db, events)).execute({
        actor: { userId: owner, isPlatformAdmin: false },
        status: 'pending_approval',
      }),
    );
    expect(error.code).toBe('FORBIDDEN');
    expect(error.revealsExistence).toBe(false);
  });

  it('approves, suspends and reactivates', async () => {
    const subscriptionId = await seed();
    const review = new ReviewSubscription(new InMemoryPlatformAdmin(db, events));
    const actor = { userId: admin, isPlatformAdmin: true };

    unwrap(
      await review.approve({
        actor,
        subscriptionId,
        status: 'active',
        by: Authorship.byHuman(admin),
      }),
    );
    expect(db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription.status.name).toBe(
      'active',
    );

    unwrap(await review.suspend({ actor, subscriptionId, by: Authorship.byHuman(admin) }));
    expect(
      db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription.grantsOperationalAccess,
    ).toBe(false);

    unwrap(
      await review.reactivate({
        actor,
        subscriptionId,
        status: 'active',
        by: Authorship.byHuman(admin),
      }),
    );
    expect(events.ofType('SubscriptionReactivated')).toHaveLength(1);
  });

  it('sets a status the transition machine forbids, and says so in the trail', async () => {
    const subscriptionId = await seed();
    const review = new ReviewSubscription(new InMemoryPlatformAdmin(db, events));
    const actor = { userId: admin, isPlatformAdmin: true };

    // pending_approval -> canceled is not a transition the machine allows.
    expect(
      expectErr(
        await review.reactivate({
          actor,
          subscriptionId,
          status: 'canceled',
          by: Authorship.byHuman(admin),
        }),
      ).code,
    ).toBe('VALIDATION');

    unwrap(
      await review.setStatus({
        actor,
        subscriptionId,
        status: 'canceled',
        by: Authorship.byHuman(admin),
      }),
    );
    expect(db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription.status.name).toBe(
      'canceled',
    );
    // A different event, because it was not the ordinary review path.
    expect(events.ofType('SubscriptionStatusSet')).toHaveLength(1);
    expect(events.ofType('SubscriptionCanceled')).toHaveLength(0);
  });

  it('refuses the override to anyone who is not a platform admin', async () => {
    const subscriptionId = await seed();
    const refused = await new ReviewSubscription(new InMemoryPlatformAdmin(db, events)).setStatus({
      actor: { userId: owner, isPlatformAdmin: false },
      subscriptionId,
      status: 'active',
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(refused).code).toBe('FORBIDDEN');
    expect(db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription.status.name).toBe(
      'pending_approval',
    );
  });

  it('changes the quota alone and keeps the type', async () => {
    const subscriptionId = await seed();
    const review = new ReviewSubscription(new InMemoryPlatformAdmin(db, events));

    unwrap(
      await review.changePlan({
        actor: { userId: admin, isPlatformAdmin: true },
        subscriptionId,
        quota: '500MB',
        by: Authorship.byHuman(admin),
      }),
    );
    const stored = db.subscriptions.get(`S#${subscriptionId.value}`)?.subscription;
    expect(stored?.quota.name).toBe('500MB');
    expect(stored?.type.name).toBe('individual');
    expect(events.ofType('SubscriptionPlanChanged')).toHaveLength(1);
  });
});

describe('Invites and members', () => {
  async function activeSubscription() {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );
    const platform = new InMemoryPlatformAdmin(db, events);
    unwrap(
      await new ReviewSubscription(platform).approve({
        actor: { userId: admin, isPlatformAdmin: true },
        subscriptionId,
        status: 'active',
        by: Authorship.byHuman(admin),
      }),
    );
    const context = contextOf(subscriptionId, owner);
    return {
      subscriptionId,
      context,
      subscriptions: new InMemorySubscriptionRepository(context, db, events),
      invites: new InMemoryInviteRepository(context, db, events),
      links: new InMemoryUserLinkRepository(db),
    };
  }

  it('lets only the owner invite', async () => {
    const { context, subscriptions, invites } = await activeSubscription();

    const asMember = contextOf(context.subscriptionId, invitee);
    const refused = await new InviteMember(
      new InMemorySubscriptionRepository(asMember, db, events),
      invites,
    ).execute({
      context: asMember,
      email: 'outro@example.com',
      role: 'EDITOR',
      by: Authorship.byHuman(invitee),
    });
    const error = expectErr(refused);
    expect(error.code).toBe('FORBIDDEN');
    // The member sees the subscription they belong to, so this is a real 403.
    expect(error.revealsExistence).toBe(true);

    unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
  });

  it('turns an invite into a membership of the subscription and a link', async () => {
    const { context, subscriptions, invites, links } = await activeSubscription();

    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    // A pending invite grants no access at all (RN-ACC-004).
    expect((await subscriptions.find())?.hasMember(invitee)).toBe(false);

    const accepted = unwrap(
      await new AcceptInvite(invites, subscriptions, links).execute({
        profile: profileOf(invitee, 'invitee@example.com'),
        token: issued.token.value,
        by: Authorship.byHuman(invitee),
      }),
    );
    expect(accepted.role).toBe('EDITOR');
    expect((await subscriptions.find())?.memberRole(invitee)).toBe(Role.EDITOR);

    // Accepting does not create a subscription for the invitee (RN-SUB-017).
    const inviteeLinks = await links.linksOf(invitee);
    expect(inviteeLinks).toHaveLength(1);
    expect(inviteeLinks[0]?.isOwner).toBe(false);
  });

  it('refuses an invite accepted from another e-mail address', async () => {
    const { context, subscriptions, invites, links } = await activeSubscription();
    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'VIEWER',
        by: Authorship.byHuman(owner),
      }),
    );

    const wrongPerson = await new AcceptInvite(invites, subscriptions, links).execute({
      profile: profileOf(invitee, 'someone-else@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });
    expect(expectErr(wrongPerson).code).toBe('FORBIDDEN');
  });

  it('expires an invite after seven days', async () => {
    const { context, subscriptions, invites, links } = await activeSubscription();
    const sentAt = unwrap(Instant.fromISO('2026-03-01T10:00:00.000Z'));
    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'VIEWER',
        by: Authorship.byHuman(owner, sentAt),
      }),
    );

    const tooLate = unwrap(Instant.fromISO('2026-03-09T10:00:00.000Z'));
    const refused = await new AcceptInvite(invites, subscriptions, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee, tooLate),
    });
    expect(expectErr(refused).message).toContain('expired');
  });

  it('refuses a second invite to an e-mail that is already a member', async () => {
    // RN-ACC-003: the e-mail is unique among the members of a SUBSCRIPTION,
    // which used to mean "of a workspace".
    const { context, subscriptions, invites, links } = await activeSubscription();
    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    await new AcceptInvite(invites, subscriptions, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });

    const again = await new InviteMember(subscriptions, invites).execute({
      context,
      email: 'invitee@example.com',
      role: 'VIEWER',
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(again).code).toBe('CONFLICT');
  });

  it('changes a role and removes a member', async () => {
    const { context, subscriptions, invites, links } = await activeSubscription();
    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    await new AcceptInvite(invites, subscriptions, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });

    unwrap(
      await new ChangeMemberRole(subscriptions).execute({
        context,
        userId: invitee,
        role: 'VIEWER',
        by: Authorship.byHuman(owner),
      }),
    );
    expect((await subscriptions.find())?.memberRole(invitee)).toBe(Role.VIEWER);

    unwrap(
      await new RemoveMember(subscriptions, links).execute({
        context,
        userId: invitee,
        by: Authorship.byHuman(owner),
      }),
    );
    expect((await subscriptions.find())?.hasMember(invitee)).toBe(false);
    // The link goes with the membership: there is nothing left to reach.
    expect(await links.linksOf(invitee)).toHaveLength(0);
  });

  it('refuses to remove the owner', async () => {
    const { context, subscriptions, links } = await activeSubscription();
    const refused = await new RemoveMember(subscriptions, links).execute({
      context,
      userId: owner,
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(refused).message).toContain('transfer ownership');
  });

  it('transfers ownership atomically, demoting the previous holder', async () => {
    const { context, subscriptions, invites, links } = await activeSubscription();
    const issued = unwrap(
      await new InviteMember(subscriptions, invites).execute({
        context,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    await new AcceptInvite(invites, subscriptions, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });

    unwrap(
      await new TransferOwnership(subscriptions, links).execute({
        context,
        toUserId: invitee,
        by: Authorship.byHuman(owner),
      }),
    );

    const subscription = await subscriptions.find();
    expect(subscription?.isOwner(invitee)).toBe(true);
    // Both halves of RN-ACC-002 now land in ONE save of ONE aggregate.
    expect(subscription?.memberRole(owner)).toBe(Role.EDITOR);
    expect(subscription?.hasMember(invitee)).toBe(false);
  });
});

describe('ResolveRequestContext: stage 1 of authorization', () => {
  it('refuses a suspended subscription, owner included', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );
    const platform = new InMemoryPlatformAdmin(db, events);
    const review = new ReviewSubscription(platform);
    const actor = { userId: admin, isPlatformAdmin: true };
    await review.approve({
      actor,
      subscriptionId,
      status: 'active',
      by: Authorship.byHuman(admin),
    });
    await review.suspend({ actor, subscriptionId, by: Authorship.byHuman(admin) });

    const context = contextOf(subscriptionId, owner, 'suspended');
    const resolved = await new ResolveRequestContext(
      new InMemorySubscriptionRepository(context, db, events),
    ).execute(context);

    const error = expectErr(resolved);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.details).toEqual({ status: 'suspended' });
  });

  it('resolves ownership and the role in the subscription in one shot', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );
    await new ReviewSubscription(new InMemoryPlatformAdmin(db, events)).approve({
      actor: { userId: admin, isPlatformAdmin: true },
      subscriptionId,
      status: 'active',
      by: Authorship.byHuman(admin),
    });

    const context = contextOf(subscriptionId, owner);
    const resolved = unwrap(
      await new ResolveRequestContext(
        new InMemorySubscriptionRepository(context, db, events),
      ).execute(context),
    );
    expect(resolved.isOwner).toBe(true);
    expect(resolved.role).toBe(Role.OWNER);
  });
});

describe('Session', () => {
  it('lists the links of the user and the role in the active one', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const links = new InMemoryUserLinkRepository(db);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, links).execute({
        profile: profileOf(owner, 'owner@example.com'),
        by: Authorship.byHuman(owner),
      }),
    );
    const context = contextOf(subscriptionId, owner);
    const session = unwrap(
      await new GetSession(
        links,
        new InMemorySubscriptionRepository(context, db, events),
        async (id: SubscriptionId) => {
          const found = db.subscriptions.get(`S#${id.value}`)?.subscription;
          return found
            ? { status: found.status.name, type: found.type.name, quota: found.quota.name }
            : null;
        },
      ).execute({ profile: profileOf(owner, 'owner@example.com'), context }),
    );

    expect(session.links).toHaveLength(1);
    expect(session.links[0]?.isOwner).toBe(true);
    expect(session.role).toBe('OWNER');
  });

  it('refuses to switch to a subscription the user has no link with', async () => {
    const links = new InMemoryUserLinkRepository(db);
    const stranger = SubscriptionId.generate();
    const refused = await new SwitchActiveSubscription(links).execute({
      user: owner,
      subscriptionId: stranger,
    });
    // Indistinguishable from a subscription that does not exist (RN-SUB-004).
    expect(expectErr(refused).code).toBe('NOT_FOUND');
  });
});

describe('Membership shape', () => {
  it('refuses OWNER as a membership, because ownership is not a membership', () => {
    expect(expectErr(Role.membership('OWNER')).code).toBe('VALIDATION');
  });

  it('keeps the e-mail unique among the members of a subscription', async () => {
    // RN-ACC-003. The rule used to be scoped to a workspace; with that level
    // gone, the subscription is where a duplicate e-mail has to be caught.
    const subscription = unwrap(
      (await import('../src/domain/subscription/Subscription.js')).Subscription.request({
        id: SubscriptionId.generate(),
        ownerId: owner,
        ownerEmail: 'owner@example.com',
        by: Authorship.byHuman(owner),
      }),
    );
    unwrap(
      subscription.addMember(
        invitee,
        unwrap(Email.create('same@example.com')),
        Role.EDITOR,
        owner,
        Authorship.byHuman(owner),
      ),
    );
    const twin = unwrap(UserId.create('user-twin'));
    const clash = subscription.addMember(
      twin,
      unwrap(Email.create('SAME@example.com')),
      Role.VIEWER,
      owner,
      Authorship.byHuman(owner),
    );
    expect(expectErr(clash).code).toBe('CONFLICT');
  });
});
