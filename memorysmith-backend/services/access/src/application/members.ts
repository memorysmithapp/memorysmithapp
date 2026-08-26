/**
 * Workspaces, invites and memberships (software-vision.md, section 5.4).
 *
 * Only the OWNER invites, changes roles, removes members and creates
 * workspaces (RN-ACC-006, RN-ACC-007). An EDITOR does not invite.
 */

import {
  type Authorship,
  DomainError,
  err,
  Instant,
  ok,
  Role,
  WorkspaceId,
  type Result,
  type SubscriptionContext,
  type UserId,
} from '@memorysmith/kernel';
import { Invite } from '../domain/invite/Invite.js';
import { Workspace } from '../domain/workspace/Workspace.js';
import { Email, InviteToken, WorkspaceName } from '../domain/values.js';
import type {
  InviteRepository,
  SubscriptionLink,
  SubscriptionRepository,
  UserLinkRepository,
  UserProfile,
  WorkspaceRepository,
} from '../domain/ports/index.js';

async function requireOwner(
  subscriptions: SubscriptionRepository,
  user: UserId,
): Promise<Result<void, DomainError>> {
  const subscription = await subscriptions.find();
  if (!subscription) return err(DomainError.notFound('Subscription not found'));
  if (!subscription.grantsOperationalAccess) {
    return err(DomainError.forbiddenVisible(`This subscription is ${subscription.status.name}`));
  }
  if (!subscription.isOwner(user)) {
    // The caller can see the subscription they belong to, so this is a real
    // 403 rather than the 404 that protects existence.
    return err(DomainError.forbiddenVisible('Only the subscription owner can do this'));
  }
  return ok();
}

export class CreateWorkspace {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    name: string;
    by: Authorship;
  }): Promise<Result<{ workspaceId: WorkspaceId }, DomainError>> {
    const allowed = await requireOwner(this.subscriptions, input.context.userId);
    if (!allowed.ok) return allowed;

    const name = WorkspaceName.create(input.name);
    if (!name.ok) return name;

    const workspace = Workspace.create({
      id: WorkspaceId.generate(),
      subscriptionId: input.context.subscriptionId,
      name: name.value,
      isDefault: (await this.workspaces.listAll()).length === 0,
      by: input.by,
    });
    if (!workspace.ok) return workspace;

    const saved = await this.workspaces.save(workspace.value);
    return saved.ok ? ok({ workspaceId: workspace.value.id }) : err(saved.error);
  }
}

export class InviteMember {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly invites: InviteRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    workspaceId: WorkspaceId;
    email: string;
    role: string;
    by: Authorship;
  }): Promise<Result<{ token: InviteToken }, DomainError>> {
    // RN-ACC-008: an invite can only be issued by a trial or active
    // subscription, which requireOwner already checks.
    const allowed = await requireOwner(this.subscriptions, input.context.userId);
    if (!allowed.ok) return allowed;

    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace) return err(DomainError.notFound('Workspace not found'));

    const email = Email.create(input.email);
    if (!email.ok) return email;
    const role = Role.membership(input.role);
    if (!role.ok) return role;

    if (workspace.members.some((member) => member.email.equals(email.value))) {
      return err(DomainError.conflict('That e-mail already belongs to a member'));
    }

    const invite = Invite.issue({
      subscriptionId: input.context.subscriptionId,
      workspaceId: input.workspaceId,
      email: email.value,
      role: role.value,
      by: input.by,
    });
    if (!invite.ok) return invite;

    const saved = await this.invites.save(invite.value);
    return saved.ok ? ok({ token: invite.value.token }) : err(saved.error);
  }
}

/**
 * Accepting an invite does NOT create a subscription for the invitee and they
 * pay nothing: they start acting inside the subscription of whoever invited
 * them (RN-SUB-017).
 */
export class AcceptInvite {
  constructor(
    private readonly invites: InviteRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    profile: UserProfile;
    token: string;
    by: Authorship;
  }): Promise<Result<{ workspaceId: WorkspaceId; role: string }, DomainError>> {
    const token = InviteToken.create(input.token);
    if (!token.ok) return err(DomainError.notFound('Invite not found'));

    const invite = await this.invites.findByToken(token.value);
    if (!invite) return err(DomainError.notFound('Invite not found'));

    const accepted = invite.accept(input.profile.userId, input.profile.email, input.by.at);
    if (!accepted.ok) return accepted;

    const workspace = await this.workspaces.findById(invite.workspaceId);
    if (!workspace) return err(DomainError.notFound('Workspace not found'));

    const added = workspace.addMember(
      input.profile.userId,
      input.profile.email,
      invite.role,
      invite.invitedBy,
      input.by,
    );
    if (!added.ok) return added;

    const savedWorkspace = await this.workspaces.save(workspace);
    if (!savedWorkspace.ok) return err(savedWorkspace.error);
    const savedInvite = await this.invites.save(invite);
    if (!savedInvite.ok) return err(savedInvite.error);

    const link: SubscriptionLink = {
      userId: input.profile.userId,
      subscriptionId: invite.subscriptionId,
      isOwner: false,
      isDefault: (await this.links.linksOf(input.profile.userId)).length === 0,
      joinedAt: input.by.at.toISOString(),
    };
    await this.links.link(link);

    return ok({ workspaceId: workspace.id, role: invite.role.name });
  }
}

export class ChangeMemberRole {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    workspaceId: WorkspaceId;
    userId: UserId;
    role: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const allowed = await requireOwner(this.subscriptions, input.context.userId);
    if (!allowed.ok) return allowed;

    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace) return err(DomainError.notFound('Workspace not found'));

    const role = Role.membership(input.role);
    if (!role.ok) return role;

    const changed = workspace.changeMemberRole(input.userId, role.value, input.by);
    if (!changed.ok) return changed;

    const saved = await this.workspaces.save(workspace);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class RemoveMember {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    workspaceId: WorkspaceId;
    userId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const allowed = await requireOwner(this.subscriptions, input.context.userId);
    if (!allowed.ok) return allowed;

    const subscription = await this.subscriptions.find();
    // RN-ACC-001: removing the OWNER is refused; the only way out is a
    // transfer of ownership.
    if (subscription?.isOwner(input.userId)) {
      return err(
        DomainError.conflict('The subscription owner cannot be removed; transfer ownership first'),
      );
    }

    const workspace = await this.workspaces.findById(input.workspaceId);
    if (!workspace) return err(DomainError.notFound('Workspace not found'));

    const removed = workspace.removeMember(input.userId, input.by);
    if (!removed.ok) return removed;

    const saved = await this.workspaces.save(workspace);
    if (!saved.ok) return err(saved.error);

    // If they hold no other membership in this subscription, the link goes too.
    const others = await this.workspaces.listAll();
    if (!others.some((each) => each.hasMember(input.userId))) {
      await this.links.unlink(input.userId, input.context.subscriptionId);
    }
    return ok();
  }
}

/**
 * Ownership transfer is atomic by construction: the new holder becomes OWNER
 * and the previous one becomes EDITOR in the same operation, so the
 * subscription is never without a holder (RN-ACC-002).
 */
export class TransferOwnership {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly links: UserLinkRepository,
  ) {}

  async execute(input: {
    context: SubscriptionContext;
    toUserId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const allowed = await requireOwner(this.subscriptions, input.context.userId);
    if (!allowed.ok) return allowed;

    const subscription = await this.subscriptions.find();
    if (!subscription) return err(DomainError.notFound('Subscription not found'));

    const workspaces = await this.workspaces.listAll();
    const incoming = workspaces.find((workspace) => workspace.hasMember(input.toUserId));
    if (!incoming) {
      return err(DomainError.validation('The new holder must already be a member'));
    }

    const previous = subscription.transferOwnership(input.toUserId, input.by);
    if (!previous.ok) return previous;

    const saved = await this.subscriptions.save(subscription);
    if (!saved.ok) return err(saved.error);

    // The previous holder becomes an EDITOR wherever they were not a member.
    for (const workspace of workspaces) {
      if (workspace.hasMember(previous.value)) {
        workspace.changeMemberRole(previous.value, Role.EDITOR, input.by);
      } else {
        const profileEmail = Email.create(subscription.ownerEmail);
        if (profileEmail.ok) {
          workspace.addMember(previous.value, profileEmail.value, Role.EDITOR, null, input.by);
        }
      }
      await this.workspaces.save(workspace);
    }

    await this.links.link({
      userId: input.toUserId,
      subscriptionId: input.context.subscriptionId,
      isOwner: true,
      isDefault: true,
      joinedAt: Instant.now().toISOString(),
    });
    await this.links.link({
      userId: previous.value,
      subscriptionId: input.context.subscriptionId,
      isOwner: false,
      isDefault: true,
      joinedAt: Instant.now().toISOString(),
    });
    return ok();
  }
}
