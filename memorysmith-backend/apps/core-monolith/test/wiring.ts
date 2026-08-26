/**
 * An in-memory wiring of the whole monolith, for tests that need the two
 * contexts talking to each other: the isolation tests of section 19, and the
 * vertical slices.
 *
 * It is the same composition root shape as production; only the adapters
 * differ, which is the point of the hexagon.
 */

import {
  Authorship,
  DomainError,
  Role,
  type SubscriptionContext,
  type EventPublisher,
  type DomainEvent,
} from '@memorysmith/kernel';
import type { TokenVerifier, VerifiedToken } from '@memorysmith/svc-access/adapters/auth';
import type { AccessRequest, AccessUseCases } from '@memorysmith/svc-access/adapters/http';
import type { KnowledgeRequest, KnowledgeUseCases } from '@memorysmith/svc-knowledge/adapters/http';
import {
  InMemoryAccessDatabase,
  InMemoryInviteRepository,
  InMemoryOnboarding,
  InMemoryPlatformAdmin,
  InMemorySubscriptionRepository,
  InMemoryUserLinkRepository,
  InMemoryWorkspaceRepository,
} from '@memorysmith/svc-access/adapters/memory';
import {
  GetSession,
  RequestSubscription,
  SwitchActiveSubscription,
} from '@memorysmith/svc-access/application/onboarding';
import {
  ListPlatformQueue,
  ReviewSubscription,
} from '@memorysmith/svc-access/application/platform';
import {
  AcceptInvite,
  ChangeMemberRole,
  CreateWorkspace,
  InviteMember,
  RemoveMember,
  TransferOwnership,
} from '@memorysmith/svc-access/application/members';
import { ResolveRequestContext } from '@memorysmith/svc-access/application/context';
import {
  InMemoryContentStore,
  InMemoryDatabase,
  InMemoryNoteRepository,
  InMemoryVaultRepository,
} from '@memorysmith/svc-knowledge/adapters/memory';
import {
  ClearVaultRoleLimit,
  CreateVault,
  GetVault,
  GetVaultContext,
  ListVaults,
  PutGuidance,
  RenameVault,
  SetVaultRoleLimit,
} from '@memorysmith/svc-knowledge/application/vaults';
import {
  CreateFolder,
  GetTemplate,
  PatchFolder,
  PutTemplate,
  RemoveFolder,
  ReorderFolder,
} from '@memorysmith/svc-knowledge/application/folders';
import {
  CreateNote,
  DeleteNote,
  ListNotes,
  MoveNote,
  ReadNote,
  ReadNoteBySlug,
  ReorderNote,
  RestoreNote,
  UpdateNote,
} from '@memorysmith/svc-knowledge/application/notes';
import { InMemoryAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import {
  GetNoteHistory,
  GetVaultActivity,
  ReadRevision,
  RecordEvents,
} from '@memorysmith/svc-audit/application';
import { AuditEventConsumer } from '@memorysmith/svc-audit/adapters/consumer';
import type { AuditUseCases } from '@memorysmith/svc-audit/adapters/http';
import {
  FakeEmbedder,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryStructureProjection,
  InMemoryVectorIndex,
} from '@memorysmith/svc-discovery/adapters/memory';
import {
  Backlinks,
  GetFacetStats,
  RelatedNotes,
  SearchNotes,
  VaultGraphQuery,
  VaultHealth,
} from '@memorysmith/svc-discovery/application/queries';
import type { DiscoveryUseCases } from '@memorysmith/svc-discovery/adapters/http';
import { ProjectNote, ProjectStructure } from '@memorysmith/svc-discovery/application/projections';
import { createApp } from '../src/app.js';

export class RecordingEventPublisher implements EventPublisher {
  readonly published: DomainEvent[] = [];
  async publish(events: DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }
  ofType(type: string): DomainEvent[] {
    return this.published.filter((event) => event.type === type);
  }
}

/** Tokens are minted by the test, not verified against Cognito. */
export class FakeTokenVerifier implements TokenVerifier {
  private readonly tokens = new Map<string, VerifiedToken>();

  issue(token: string, claims: VerifiedToken): string {
    this.tokens.set(token, claims);
    return token;
  }

  async verify(token: string): Promise<VerifiedToken | null> {
    return this.tokens.get(token) ?? null;
  }
}

export function buildTestApp() {
  const accessDb = new InMemoryAccessDatabase();
  const knowledgeDb = new InMemoryDatabase();
  const events = new RecordingEventPublisher();
  const verifier = new FakeTokenVerifier();

  const links = new InMemoryUserLinkRepository(accessDb);
  const onboarding = new InMemoryOnboarding(accessDb, events);
  const platform = new InMemoryPlatformAdmin(accessDb, events);

  const scopedAccess = (request: AccessRequest) => {
    const context = request.context;
    if (!context) return null;
    return {
      subscriptions: new InMemorySubscriptionRepository(context, accessDb, events),
      workspaces: new InMemoryWorkspaceRepository(context, accessDb, events),
      invites: new InMemoryInviteRepository(context, accessDb, events),
    };
  };

  /**
   * The knowledge repositories take a SubscriptionContext, so this function
   * simply cannot be called for a platform session: there is nothing to pass.
   */
  const knowledgeRepos = (context: SubscriptionContext) => ({
    vaults: new InMemoryVaultRepository(context, knowledgeDb, events),
    notes: new InMemoryNoteRepository(context, knowledgeDb, events),
    content: new InMemoryContentStore(context, knowledgeDb),
  });

  const accessUseCases: AccessUseCases = {
    requestSubscription: () => new RequestSubscription(onboarding, links),
    getSession: (request) => {
      const scoped = scopedAccess(request);
      return new GetSession(
        links,
        scoped?.subscriptions ?? null,
        scoped?.workspaces ?? null,
        async (id) => {
          const found = accessDb.subscriptions.get(`S#${id.value}`)?.subscription;
          return found
            ? { name: found.name.value, slug: found.slug.value, status: found.status.name }
            : null;
        },
      );
    },
    switchSubscription: () => new SwitchActiveSubscription(links),
    listPlatformQueue: () => new ListPlatformQueue(platform),
    reviewSubscription: () => new ReviewSubscription(platform),
    createWorkspace: (request) => {
      const scoped = scopedAccess(request);
      return new CreateWorkspace(scoped!.subscriptions, scoped!.workspaces);
    },
    inviteMember: (request) => {
      const scoped = scopedAccess(request);
      return new InviteMember(scoped!.subscriptions, scoped!.workspaces, scoped!.invites);
    },
    acceptInvite: (request) => {
      const scoped = scopedAccess(request);
      return new AcceptInvite(scoped!.invites, scoped!.workspaces, links);
    },
    changeMemberRole: (request) => {
      const scoped = scopedAccess(request);
      return new ChangeMemberRole(scoped!.subscriptions, scoped!.workspaces);
    },
    removeMember: (request) => {
      const scoped = scopedAccess(request);
      return new RemoveMember(scoped!.subscriptions, scoped!.workspaces, links);
    },
    transferOwnership: (request) => {
      const scoped = scopedAccess(request);
      return new TransferOwnership(scoped!.subscriptions, scoped!.workspaces, links);
    },
  };

  const knowledgeUseCases: KnowledgeUseCases = {
    createVault: (request) => new CreateVault(knowledgeRepos(request.subscription)),
    listVaults: (request) => new ListVaults(knowledgeRepos(request.subscription)),
    getVault: (request) => new GetVault(knowledgeRepos(request.subscription)),
    renameVault: (request) => new RenameVault(knowledgeRepos(request.subscription)),
    putGuidance: (request) => new PutGuidance(knowledgeRepos(request.subscription)),
    getVaultContext: (request) => new GetVaultContext(knowledgeRepos(request.subscription)),
    setVaultLimit: (request) => new SetVaultRoleLimit(knowledgeRepos(request.subscription)),
    clearVaultLimit: (request) => new ClearVaultRoleLimit(knowledgeRepos(request.subscription)),
    createFolder: (request) => new CreateFolder(knowledgeRepos(request.subscription)),
    patchFolder: (request) => new PatchFolder(knowledgeRepos(request.subscription)),
    reorderFolder: (request) => new ReorderFolder(knowledgeRepos(request.subscription)),
    removeFolder: (request) => new RemoveFolder(knowledgeRepos(request.subscription)),
    putTemplate: (request) => new PutTemplate(knowledgeRepos(request.subscription)),
    getTemplate: (request) => new GetTemplate(knowledgeRepos(request.subscription)),
    listNotes: (request) => new ListNotes(knowledgeRepos(request.subscription)),
    readNote: (request) => new ReadNote(knowledgeRepos(request.subscription)),
    readNoteBySlug: (request) => new ReadNoteBySlug(knowledgeRepos(request.subscription)),
    createNote: (request) => new CreateNote(knowledgeRepos(request.subscription)),
    updateNote: (request) => new UpdateNote(knowledgeRepos(request.subscription)),
    reorderNote: (request) => new ReorderNote(knowledgeRepos(request.subscription)),
    moveNote: (request) => new MoveNote(knowledgeRepos(request.subscription)),
    deleteNote: (request) => new DeleteNote(knowledgeRepos(request.subscription)),
    restoreNote: (request) => new RestoreNote(knowledgeRepos(request.subscription)),
  };

  // Audit and Discovery, wired in memory. In production they are fed by the
  // event bus; here the test drives them directly.
  const auditTrail = new InMemoryAuditTrail();
  const revisions = { read: async () => '' };
  const auditUseCases: AuditUseCases = {
    noteHistory: () => new GetNoteHistory(auditTrail),
    vaultActivity: () => new GetVaultActivity(auditTrail),
    readRevision: () => new ReadRevision(auditTrail, revisions),
  };
  const auditConsumer = new AuditEventConsumer(new RecordEvents(auditTrail));

  const discovery = {
    graph: new InMemoryLinkGraph(),
    vectors: new InMemoryVectorIndex(),
    facets: new InMemoryFacetIndex(),
    structure: new InMemoryStructureProjection(),
    catalog: new InMemoryNoteCatalog(),
    embedder: new FakeEmbedder(),
  };
  const discoveryDeps = {
    graph: discovery.graph,
    vectors: discovery.vectors,
    facets: discovery.facets,
    catalog: discovery.catalog,
    embedder: discovery.embedder,
  };
  /**
   * In production the bus drives these; in the test the harness does, which
   * is the same contract with a shorter wire (section 24).
   */
  const projectNote = new ProjectNote({
    graph: discovery.graph,
    vectors: discovery.vectors,
    facets: discovery.facets,
    structure: discovery.structure,
    embedder: discovery.embedder,
    content: {
      // The slot is addressed by its content id, exactly as the S3 adapter
      // addresses it; the version id alone is not unique across slots.
      read: async (ref) => {
        for (const [key, slot] of knowledgeDb.content) {
          if (!key.endsWith(`/${ref.contentId}.md`)) continue;
          return slot.revisions.get(ref.versionId) ?? '';
        }
        return '';
      },
    },
  });
  const projectStructure = new ProjectStructure(discovery.structure);

  const discoveryUseCases: DiscoveryUseCases = {
    related: () => new RelatedNotes(discoveryDeps),
    backlinks: () => new Backlinks(discoveryDeps),
    health: () => new VaultHealth(discoveryDeps),
    graph: () => new VaultGraphQuery(discoveryDeps),
    search: () => new SearchNotes(discoveryDeps),
    facets: () => new GetFacetStats(discoveryDeps),
  };

  const app = createApp({
    verifier,
    accessUseCases,
    knowledgeUseCases,
    auditUseCases,
    discoveryUseCases,
    // Discovery holds no vault, so it asks the context that owns it.
    canReadVault: async (request, vaultId) => {
      const parsed = (await import('@memorysmith/kernel')).VaultId.create(vaultId);
      if (!parsed.ok) return false;
      const vault = await knowledgeRepos(request.subscription).vaults.findById(parsed.value);
      return vault !== null;
    },
    resolveContext: async (request: AccessRequest) => {
      const context = request.context;
      if (!context) {
        return {
          ok: false as const,
          error: DomainError.forbidden('This session carries no active subscription'),
        };
      }
      const scoped = scopedAccess(request);
      const resolved = await new ResolveRequestContext(
        scoped!.subscriptions,
        scoped!.workspaces,
      ).execute(context);
      if (!resolved.ok) return { ok: false as const, error: resolved.error };

      const knowledgeRequest: KnowledgeRequest = {
        ctx: resolved.value,
        subscription: context,
        authorship: Authorship.byHuman(context.userId),
        workspaceRoleOf: (workspaceId) => resolved.value.roles.get(workspaceId) ?? Role.NONE,
      };
      return { ok: true as const, value: knowledgeRequest };
    },
  });

  return {
    app,
    accessDb,
    knowledgeDb,
    events,
    verifier,
    links,
    platform,
    auditTrail,
    auditConsumer,
    discovery,
    projectNote,
    projectStructure,
  };
}
