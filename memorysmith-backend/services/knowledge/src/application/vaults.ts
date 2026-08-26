/**
 * Vault use cases (architecture-guide.md, section 14.1).
 *
 * FIXED RULE, NO EXCEPTION: every Knowledge use case loads the vault and calls
 * policy.require BEFORE anything else (section 14.2). The three inputs of that
 * decision arrive at no extra cost, because the workspaceId and the ceilings
 * came back in the same Query that loaded the vault.
 */

import {
  type Authorship,
  type ContentRef,
  DomainError,
  err,
  ok,
  Role,
  VaultId,
  VaultRoleLimit,
  type WorkspaceId,
  type Result,
  type UserId,
} from '@memorysmith/kernel';
import { AuthorizationPolicy, type RequestContext } from '../domain/access/AuthorizationPolicy.js';
import { composeVaultContext } from '../domain/services/VaultContextComposer.js';
import { Vault } from '../domain/vault/Vault.js';
import { ShortText, VaultName } from '../domain/values.js';
import type { ContentStore, VaultRepository } from '../domain/ports/index.js';

export interface VaultDependencies {
  readonly vaults: VaultRepository;
  readonly content: ContentStore;
}

/** Loads a vault and authorizes in one step, so no caller can forget. */
async function loadAuthorized(
  deps: VaultDependencies,
  ctx: RequestContext,
  vaultId: VaultId,
  action: 'read' | 'write' | 'administer',
): Promise<Result<Vault, DomainError>> {
  const vault = await deps.vaults.findById(vaultId);
  // A vault of another subscription never even reaches here: the key the
  // repository builds carries the subscription of the token (RN-SUB-004).
  if (!vault) return err(DomainError.notFound('Vault not found'));

  const allowed = AuthorizationPolicy.require(ctx, vault, action);
  if (!allowed.ok) return allowed;
  return ok(vault);
}

export class CreateVault {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    workspaceId: WorkspaceId;
    name: string;
    description: string;
    subscriptionId: Parameters<typeof Vault.create>[0]['subscriptionId'];
    by: Authorship;
  }): Promise<Result<Vault, DomainError>> {
    // Creating a vault is a workspace-level decision: OWNER or EDITOR.
    const role = input.ctx.isOwner
      ? Role.OWNER
      : (input.ctx.roles.get(input.workspaceId.value) ?? Role.NONE);
    if (!role.canWrite()) {
      return err(DomainError.forbidden('Workspace not found'));
    }

    const name = VaultName.create(input.name);
    if (!name.ok) return name;
    const description = ShortText.create(input.description);
    if (!description.ok) return description;

    const vault = Vault.create({
      id: VaultId.generate(),
      subscriptionId: input.subscriptionId,
      workspaceId: input.workspaceId,
      name: name.value,
      description: description.value,
      by: input.by,
    });
    if (!vault.ok) return vault;

    const saved = await this.deps.vaults.save(vault.value);
    return saved.ok ? ok(vault.value) : err(saved.error);
  }
}

export class ListVaults {
  constructor(private readonly deps: VaultDependencies) {}

  /** Only the vaults whose workspace the caller can read (RN-ACC-012). */
  async execute(input: { ctx: RequestContext }): Promise<Result<Vault[], DomainError>> {
    const all = await this.deps.vaults.listAll();
    return ok(all.filter((vault) => AuthorizationPolicy.effectiveRole(input.ctx, vault).canRead()));
  }
}

export class GetVault {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
  }): Promise<Result<{ vault: Vault; guidance: string | null; role: Role }, DomainError>> {
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'read');
    if (!vault.ok) return vault;

    const guidance = vault.value.guidanceRef
      ? await this.deps.content.read(vault.value.guidanceRef)
      : null;
    return ok({
      vault: vault.value,
      guidance,
      role: AuthorizationPolicy.effectiveRole(input.ctx, vault.value),
    });
  }
}

export class RenameVault {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
    name: string;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    // Renaming and deleting a vault belong to the OWNER (software-vision 5.2).
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'administer');
    if (!vault.ok) return vault;

    const name = VaultName.create(input.name);
    if (!name.ok) return name;

    const renamed = vault.value.rename(name.value, input.by);
    if (!renamed.ok) return renamed;

    const saved = await this.deps.vaults.save(vault.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

/**
 * Writes the content FIRST and the pointer second (section 10.5). If the
 * transaction fails, an unreferenced blob is left in S3: invisible, harmless,
 * collected by the weekly orphan job. The reverse order would produce a
 * pointer to content that does not exist, in the middle of the hot path.
 */
export class PutGuidance {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
    content: string;
    by: Authorship;
  }): Promise<Result<ContentRef, DomainError>> {
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'write');
    if (!vault.ok) return vault;

    const current = vault.value.guidanceRef;
    const ref = current
      ? await this.deps.content.overwrite(current.contentId, input.content)
      : await this.deps.content.create(input.content);

    const applied = vault.value.setGuidance(ref, input.by);
    if (!applied.ok) return applied;
    if (!vault.value.hasChanges) return ok(ref); // identical bytes: no revision

    const saved = await this.deps.vaults.save(vault.value);
    return saved.ok ? ok(ref) : err(saved.error);
  }
}

/** The composed document the agent reads: guidance plus the annotated tree. */
export class GetVaultContext {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
  }): Promise<Result<string, DomainError>> {
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'read');
    if (!vault.ok) return vault;

    const guidance = vault.value.guidanceRef
      ? await this.deps.content.read(vault.value.guidanceRef)
      : null;
    return ok(composeVaultContext({ vault: vault.value, guidance }));
  }
}

export class SetVaultRoleLimit {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
    userId: UserId;
    /** The only admitted value is VIEWER (RN-ACC-012). */
    limit: string;
    workspaceRole: Role;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'administer');
    if (!vault.ok) return vault;

    const limit = VaultRoleLimit.create(input.limit);
    if (!limit.ok) return limit;
    // RN-ACC-011: the ceiling only demotes. Setting one above the workspace
    // role is refused with VALIDATION rather than silently ignored.
    if (!input.workspaceRole.atLeast(limit.value.role)) {
      return err(DomainError.validation('A vault ceiling can only lower a role, never raise it'));
    }

    const applied = vault.value.setRoleLimit(input.userId, limit.value, input.by);
    if (!applied.ok) return applied;

    const saved = await this.deps.vaults.save(vault.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export class ClearVaultRoleLimit {
  constructor(private readonly deps: VaultDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    vaultId: VaultId;
    userId: UserId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const vault = await loadAuthorized(this.deps, input.ctx, input.vaultId, 'administer');
    if (!vault.ok) return vault;

    const cleared = vault.value.clearRoleLimit(input.userId, input.by);
    if (!cleared.ok) return cleared;

    const saved = await this.deps.vaults.save(vault.value);
    return saved.ok ? ok() : err(saved.error);
  }
}

export { loadAuthorized };
