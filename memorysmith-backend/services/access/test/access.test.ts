import { beforeEach, describe, expect, it } from 'vitest';
import {
  Authorship,
  Instant,
  Role,
  SubscriptionContext,
  SubscriptionId,
  SubscriptionStatus,
  UserId,
  WorkspaceId,
  type Result,
} from '@memorysmith/kernel';
import { Subscription } from '../src/domain/subscription/Subscription.js';
import { Email, RejectionReason, SubscriptionName } from '../src/domain/values.js';
import {
  InMemoryAccessDatabase,
  InMemoryInviteRepository,
  InMemoryOnboarding,
  InMemoryPlatformAdmin,
  InMemorySubscriptionRepository,
  InMemoryUserLinkRepository,
  InMemoryWorkspaceRepository,
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
  CreateWorkspace,
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
        name: unwrap(SubscriptionName.create('Tribunal de Contas')),
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
  it('creates the subscription, a default workspace and the link', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const links = new InMemoryUserLinkRepository(db);
    const useCase = new RequestSubscription(onboarding, links);

    const created = unwrap(
      await useCase.execute({
        profile: profileOf(owner, 'owner@example.com'),
        name: 'Tribunal de Contas',
        by: Authorship.byHuman(owner),
      }),
    );

    expect(db.subscriptions.size).toBe(1);
    expect(db.workspaces.size).toBe(1);
    expect(await links.linksOf(owner)).toHaveLength(1);
    expect(events.ofType('SubscriptionRequested')).toHaveLength(1);
    expect(events.ofType('WorkspaceCreated')).toHaveLength(1);
    expect(created.subscriptionId.value).toHaveLength(26);
  });

  it('refuses a second subscription for the same owner', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const useCase = new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db));
    await useCase.execute({
      profile: profileOf(owner, 'owner@example.com'),
      name: 'Primeira',
      by: Authorship.byHuman(owner),
    });
    const second = await useCase.execute({
      profile: profileOf(owner, 'owner@example.com'),
      name: 'Segunda',
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
        name: 'Tribunal de Contas',
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
      name: 'Tribunal de Contas',
      ownerEmail: 'owner@example.com',
      status: 'pending_approval',
      requestedAt: expect.any(String),
      workspaceCount: 1,
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
});

describe('Workspaces, invites and members', () => {
  async function activeSubscription() {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        name: 'Tribunal de Contas',
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
      workspaces: new InMemoryWorkspaceRepository(context, db, events),
      invites: new InMemoryInviteRepository(context, db, events),
      links: new InMemoryUserLinkRepository(db),
    };
  }

  it('lets only the owner create a workspace', async () => {
    const { context, subscriptions, workspaces } = await activeSubscription();
    const useCase = new CreateWorkspace(subscriptions, workspaces);

    unwrap(await useCase.execute({ context, name: 'Auditoria', by: Authorship.byHuman(owner) }));
    expect(await workspaces.listAll()).toHaveLength(2);

    const asMember = contextOf(context.subscriptionId, invitee);
    const refused = await new CreateWorkspace(
      new InMemorySubscriptionRepository(asMember, db, events),
      new InMemoryWorkspaceRepository(asMember, db, events),
    ).execute({ context: asMember, name: 'Outro', by: Authorship.byHuman(invitee) });
    const error = expectErr(refused);
    expect(error.code).toBe('FORBIDDEN');
    // The member sees the subscription they belong to, so this is a real 403.
    expect(error.revealsExistence).toBe(true);
  });

  it('turns an invite into a membership and a link', async () => {
    const { context, subscriptions, workspaces, invites, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault()) as NonNullable<
      Awaited<ReturnType<typeof workspaces.findDefault>>
    >;

    const issued = unwrap(
      await new InviteMember(subscriptions, workspaces, invites).execute({
        context,
        workspaceId: workspace.id,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    // A pending invite grants no access at all (RN-ACC-004).
    expect(workspace.hasMember(invitee)).toBe(false);

    const accepted = unwrap(
      await new AcceptInvite(invites, workspaces, links).execute({
        profile: profileOf(invitee, 'invitee@example.com'),
        token: issued.token.value,
        by: Authorship.byHuman(invitee),
      }),
    );
    expect(accepted.role).toBe('EDITOR');

    const reloaded = (await workspaces.findById(workspace.id)) as NonNullable<
      Awaited<ReturnType<typeof workspaces.findById>>
    >;
    expect(reloaded.memberRole(invitee)).toBe(Role.EDITOR);
    // Accepting does not create a subscription for the invitee (RN-SUB-017).
    const inviteeLinks = await links.linksOf(invitee);
    expect(inviteeLinks).toHaveLength(1);
    expect(inviteeLinks[0]?.isOwner).toBe(false);
  });

  it('refuses an invite accepted from another e-mail address', async () => {
    const { context, subscriptions, workspaces, invites, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault())!;
    const issued = unwrap(
      await new InviteMember(subscriptions, workspaces, invites).execute({
        context,
        workspaceId: workspace.id,
        email: 'invitee@example.com',
        role: 'VIEWER',
        by: Authorship.byHuman(owner),
      }),
    );

    const wrongPerson = await new AcceptInvite(invites, workspaces, links).execute({
      profile: profileOf(invitee, 'someone-else@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });
    expect(expectErr(wrongPerson).code).toBe('FORBIDDEN');
  });

  it('expires an invite after seven days', async () => {
    const { context, subscriptions, workspaces, invites, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault())!;
    const sentAt = unwrap(Instant.fromISO('2026-03-01T10:00:00.000Z'));
    const issued = unwrap(
      await new InviteMember(subscriptions, workspaces, invites).execute({
        context,
        workspaceId: workspace.id,
        email: 'invitee@example.com',
        role: 'VIEWER',
        by: Authorship.byHuman(owner, sentAt),
      }),
    );

    const tooLate = unwrap(Instant.fromISO('2026-03-09T10:00:00.000Z'));
    const refused = await new AcceptInvite(invites, workspaces, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee, tooLate),
    });
    expect(expectErr(refused).message).toContain('expired');
  });

  it('changes a role and removes a member', async () => {
    const { context, subscriptions, workspaces, invites, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault())!;
    const issued = unwrap(
      await new InviteMember(subscriptions, workspaces, invites).execute({
        context,
        workspaceId: workspace.id,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    await new AcceptInvite(invites, workspaces, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });

    unwrap(
      await new ChangeMemberRole(subscriptions, workspaces).execute({
        context,
        workspaceId: workspace.id,
        userId: invitee,
        role: 'VIEWER',
        by: Authorship.byHuman(owner),
      }),
    );
    expect((await workspaces.findById(workspace.id))?.memberRole(invitee)).toBe(Role.VIEWER);

    unwrap(
      await new RemoveMember(subscriptions, workspaces, links).execute({
        context,
        workspaceId: workspace.id,
        userId: invitee,
        by: Authorship.byHuman(owner),
      }),
    );
    expect((await workspaces.findById(workspace.id))?.hasMember(invitee)).toBe(false);
    // The link goes with the last membership of that subscription.
    expect(await links.linksOf(invitee)).toHaveLength(0);
  });

  it('refuses to remove the owner', async () => {
    const { context, subscriptions, workspaces, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault())!;
    const refused = await new RemoveMember(subscriptions, workspaces, links).execute({
      context,
      workspaceId: workspace.id,
      userId: owner,
      by: Authorship.byHuman(owner),
    });
    expect(expectErr(refused).message).toContain('transfer ownership');
  });

  it('transfers ownership atomically, demoting the previous holder', async () => {
    const { context, subscriptions, workspaces, invites, links } = await activeSubscription();
    const workspace = (await workspaces.findDefault())!;
    const issued = unwrap(
      await new InviteMember(subscriptions, workspaces, invites).execute({
        context,
        workspaceId: workspace.id,
        email: 'invitee@example.com',
        role: 'EDITOR',
        by: Authorship.byHuman(owner),
      }),
    );
    await new AcceptInvite(invites, workspaces, links).execute({
      profile: profileOf(invitee, 'invitee@example.com'),
      token: issued.token.value,
      by: Authorship.byHuman(invitee),
    });

    unwrap(
      await new TransferOwnership(subscriptions, workspaces, links).execute({
        context,
        toUserId: invitee,
        by: Authorship.byHuman(owner),
      }),
    );

    const subscription = (await subscriptions.find())!;
    expect(subscription.isOwner(invitee)).toBe(true);
    expect((await workspaces.findById(workspace.id))?.memberRole(owner)).toBe(Role.EDITOR);
  });
});

describe('ResolveRequestContext: stage 1 of authorization', () => {
  it('refuses a suspended subscription, owner included', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        name: 'Tribunal',
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
      new InMemoryWorkspaceRepository(context, db, events),
    ).execute(context);

    const error = expectErr(resolved);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.details).toEqual({ status: 'suspended' });
  });

  it('resolves ownership and the workspace roles in one shot', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, new InMemoryUserLinkRepository(db)).execute({
        profile: profileOf(owner, 'owner@example.com'),
        name: 'Tribunal',
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
        new InMemoryWorkspaceRepository(context, db, events),
      ).execute(context),
    );
    expect(resolved.isOwner).toBe(true);
    expect([...resolved.roles.values()].every((role) => role === Role.OWNER)).toBe(true);
  });
});

describe('Session', () => {
  it('lists the links of the user and the workspaces of the active one', async () => {
    const onboarding = new InMemoryOnboarding(db, events);
    const links = new InMemoryUserLinkRepository(db);
    const { subscriptionId } = unwrap(
      await new RequestSubscription(onboarding, links).execute({
        profile: profileOf(owner, 'owner@example.com'),
        name: 'Tribunal',
        by: Authorship.byHuman(owner),
      }),
    );
    const context = contextOf(subscriptionId, owner);
    const session = unwrap(
      await new GetSession(
        links,
        new InMemorySubscriptionRepository(context, db, events),
        new InMemoryWorkspaceRepository(context, db, events),
        async (id) => {
          const found = db.subscriptions.get(`S#${id.value}`)?.subscription;
          return found
            ? { name: found.name.value, slug: found.slug.value, status: found.status.name }
            : null;
        },
      ).execute({ profile: profileOf(owner, 'owner@example.com'), context }),
    );

    expect(session.links).toHaveLength(1);
    expect(session.links[0]?.isOwner).toBe(true);
    expect(session.workspaces).toHaveLength(1);
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

describe('Workspace membership shape', () => {
  it('refuses OWNER as a membership, because ownership is not a membership', () => {
    expect(expectErr(Role.membership('OWNER')).code).toBe('VALIDATION');
  });

  it('keeps the e-mail unique among the members of a workspace', async () => {
    const context = contextOf(SubscriptionId.generate(), owner);
    const workspaces = new InMemoryWorkspaceRepository(context, db, events);
    const workspace = unwrap(
      (await import('../src/domain/workspace/Workspace.js')).Workspace.create({
        id: WorkspaceId.generate(),
        subscriptionId: context.subscriptionId,
        name: unwrap((await import('../src/domain/values.js')).WorkspaceName.create('Auditoria')),
        isDefault: true,
        by: Authorship.byHuman(owner),
      }),
    );
    unwrap(
      workspace.addMember(
        invitee,
        unwrap(Email.create('same@example.com')),
        Role.EDITOR,
        owner,
        Authorship.byHuman(owner),
      ),
    );
    const twin = unwrap(UserId.create('user-twin'));
    const clash = workspace.addMember(
      twin,
      unwrap(Email.create('SAME@example.com')),
      Role.VIEWER,
      owner,
      Authorship.byHuman(owner),
    );
    expect(expectErr(clash).code).toBe('CONFLICT');
    await workspaces.save(workspace);
  });
});
