/**
 * Workspace: Aggregate Root, the unit of collaboration inside a subscription.
 *
 * THE OWNER IS NOT A MEMBER ITEM. Ownership lives in a single field on the
 * subscription, which is how "exactly one OWNER" stops being a rule to check
 * and becomes the shape of the data (architecture-guide.md, section 9.4). A
 * membership here is EDITOR or VIEWER, and nothing else.
 */

import {
  type Authorship,
  createEvent,
  DomainError,
  err,
  type Instant,
  ok,
  Role,
  Slug,
  type SubscriptionId,
  type UserId,
  type WorkspaceId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import { type Email, type WorkspaceName } from '../values.js';

export interface Membership {
  readonly userId: UserId;
  readonly email: Email;
  readonly role: Role;
  readonly invitedBy: UserId | null;
  readonly joinedAt: Instant;
}

export class Workspace {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: WorkspaceId,
    readonly subscriptionId: SubscriptionId,
    private _name: WorkspaceName,
    private _slug: Slug,
    readonly isDefault: boolean,
    private readonly _members: Map<string, Membership>,
    readonly createdAt: Instant,
    private _version: number,
  ) {}

  static create(input: {
    id: WorkspaceId;
    subscriptionId: SubscriptionId;
    name: WorkspaceName;
    isDefault: boolean;
    by: Authorship;
  }): Result<Workspace, DomainError> {
    const slug = Slug.from(input.name.value);
    if (!slug.ok) return slug;

    const workspace = new Workspace(
      input.id,
      input.subscriptionId,
      input.name,
      slug.value,
      input.isDefault,
      new Map(),
      input.by.at,
      0,
    );
    workspace.record('WorkspaceCreated', 'WORKSPACE', input.id.value, input.by, {
      workspaceId: input.id.value,
      name: input.name.value,
      slug: slug.value.value,
      isDefault: input.isDefault,
    });
    return ok(workspace);
  }

  static rehydrate(input: {
    id: WorkspaceId;
    subscriptionId: SubscriptionId;
    name: WorkspaceName;
    slug: Slug;
    isDefault: boolean;
    members: Membership[];
    createdAt: Instant;
    version: number;
  }): Workspace {
    return new Workspace(
      input.id,
      input.subscriptionId,
      input.name,
      input.slug,
      input.isDefault,
      new Map(input.members.map((member) => [member.userId.value, member])),
      input.createdAt,
      input.version,
    );
  }

  get name(): WorkspaceName {
    return this._name;
  }
  get slug(): Slug {
    return this._slug;
  }
  get version(): number {
    return this._version;
  }
  get members(): Membership[] {
    return [...this._members.values()];
  }

  markPersisted(): void {
    this._version += 1;
  }

  memberRole(user: UserId): Role {
    return this._members.get(user.value)?.role ?? Role.NONE;
  }

  hasMember(user: UserId): boolean {
    return this._members.has(user.value);
  }

  rename(name: WorkspaceName, by: Authorship): Result<void, DomainError> {
    const slug = Slug.from(name.value);
    if (!slug.ok) return slug;
    this._name = name;
    this._slug = slug.value;
    void by;
    return ok();
  }

  /** Only the aceite of an invite creates a member (RN-ACC-004). */
  addMember(
    user: UserId,
    email: Email,
    role: Role,
    invitedBy: UserId | null,
    by: Authorship,
  ): Result<void, DomainError> {
    if (!role.equals(Role.EDITOR) && !role.equals(Role.VIEWER)) {
      return err(DomainError.validation('A workspace membership is EDITOR or VIEWER'));
    }
    if (this._members.has(user.value)) {
      return err(DomainError.conflict('That user is already a member of this workspace'));
    }
    // RN-ACC-003: the e-mail is unique among the members of a workspace.
    if (this.members.some((member) => member.email.equals(email))) {
      return err(DomainError.conflict('That e-mail already belongs to a member of this workspace'));
    }

    this._members.set(user.value, { userId: user, email, role, invitedBy, joinedAt: by.at });
    this.record('MemberJoined', 'MEMBER', user.value, by, {
      workspaceId: this.id.value,
      userId: user.value,
      role: role.name,
    });
    return ok();
  }

  changeMemberRole(user: UserId, role: Role, by: Authorship): Result<void, DomainError> {
    const member = this._members.get(user.value);
    if (!member) return err(DomainError.notFound('That user is not a member of this workspace'));
    if (!role.equals(Role.EDITOR) && !role.equals(Role.VIEWER)) {
      return err(DomainError.validation('A workspace membership is EDITOR or VIEWER'));
    }
    if (member.role.equals(role)) return ok();

    const from = member.role;
    this._members.set(user.value, { ...member, role });
    this.record('MemberRoleChanged', 'MEMBER', user.value, by, {
      workspaceId: this.id.value,
      userId: user.value,
      from: from.name,
      to: role.name,
    });
    return ok();
  }

  /**
   * Removing a member revokes access and preserves everything they wrote,
   * including the recorded authorship (RN-ACC-009). Nothing about their past
   * writes is touched here, because authorship lives on the events.
   */
  removeMember(user: UserId, by: Authorship): Result<void, DomainError> {
    if (!this._members.delete(user.value)) {
      return err(DomainError.notFound('That user is not a member of this workspace'));
    }
    this.record('MemberRemoved', 'MEMBER', user.value, by, {
      workspaceId: this.id.value,
      userId: user.value,
    });
    return ok();
  }

  get hasChanges(): boolean {
    return this.events.length > 0;
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    subject: Parameters<typeof createEvent>[0]['subject'],
    subjectId: string,
    by: Authorship,
    payload: Record<string, unknown>,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject,
        subjectId,
        authorship: by,
        payload,
      }),
    );
  }
}
