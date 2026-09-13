/**
 * An in-memory wiring of the whole monolith, for tests that need the two
 * contexts talking to each other: the isolation tests of section 19, and the
 * vertical slices.
 *
 * It is the same composition root shape as production; only the adapters
 * differ, which is the point of the hexagon.
 */

import { RESERVED_FRONTMATTER_KEYS } from '@memorysmith/contracts';
import { serializeNotebookDocument } from '../src/composition-root.js';
import {
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
  InMemoryConnectorBindingRepository,
  InMemoryInviteRepository,
  InMemoryOnboarding,
  InMemoryPlatformAdmin,
  InMemorySubscriptionRepository,
  InMemoryUserLinkRepository,
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
  ListMembers,
  InviteMember,
  RemoveMember,
  TransferOwnership,
} from '@memorysmith/svc-access/application/members';
import { ResolveRequestContext } from '@memorysmith/svc-access/application/context';
import {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  ResolveAuthorship,
} from '@memorysmith/svc-access/application/connectors';
import {
  InMemoryContentStore,
  InMemoryStorageBudget,
  InMemoryDatabase,
  InMemoryNoteRepository,
  InMemoryNotebookRepository,
} from '@memorysmith/svc-knowledge/adapters/memory';
import {
  ClearNotebookRoleLimit,
  CreateNotebook,
  GetNotebook,
  GetNotebookContext,
  ListNotebooks,
  PutGuidance,
  DeleteNotebook,
  RenameNotebook,
  RestoreNotebook,
  SetNotebookRoleLimit,
} from '@memorysmith/svc-knowledge/application/notebooks';
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
  ReorderNote,
  RestoreNote,
  UpdateNote,
} from '@memorysmith/svc-knowledge/application/notes';
import { InMemoryAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import type { PortabilityUseCases } from '@memorysmith/svc-portability/adapters/http';
import { ExportNotebook } from '@memorysmith/svc-portability/application';
import { createZip, readZip } from '@memorysmith/svc-portability/adapters/zip';
import { ImportNotebook, PrepareImport } from '@memorysmith/svc-portability/application/import';
import { KnowledgeNotebookWriter } from '../src/import-writer.js';
import { parseNotebookDocument } from '../src/composition-root.js';
import { KnowledgeExportSource } from '../src/export-source.js';
import {
  GetNoteHistory,
  GetNotebookActivity,
  ReadRevision,
  RecordEvents,
} from '@memorysmith/svc-audit/application';
import { AuditEventConsumer } from '@memorysmith/svc-audit/adapters/consumer';
import type { AuditUseCases } from '@memorysmith/svc-audit/adapters/http';
import {
  InMemoryContentIndex,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryStructureProjection,
} from '@memorysmith/svc-discovery/adapters/memory';
import {
  Backlinks,
  ResolveLinkTarget,
  GetFacetStats,
  RelatedNotes,
  SearchNotes,
  NotebookGraphQuery,
  NotebookHealth,
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

/** The app client of the connector proxy, as the harness names it. */
export const CONNECTOR_CLIENT_ID = 'cimd-proxy-client';

/**
 * Stands in for what API Gateway adds to a request it authorized with IAM. In
 * production nobody but the proxy can make the gateway add it; here a test sets
 * this header to play the proxy.
 */
export const SIGNED_WITH_IAM = 'x-test-signed-with-iam';

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
      invites: new InMemoryInviteRepository(context, accessDb, events),
      connectors: new InMemoryConnectorBindingRepository(context, accessDb),
    };
  };

  /**
   * The knowledge repositories take a SubscriptionContext, so this function
   * simply cannot be called for a platform session: there is nothing to pass.
   */
  /** Shared by every use case of this app, exactly as the counter is in production. */
  const storage = new InMemoryStorageBudget();

  const knowledgeRepos = (context: SubscriptionContext) => ({
    notebooks: new InMemoryNotebookRepository(context, knowledgeDb, events),
    notes: new InMemoryNoteRepository(context, knowledgeDb, events),
    content: new InMemoryContentStore(context, knowledgeDb),
    storage,
    // The same list production injects, from the same specification (RN-AGT-025).
    reservedVocabulary: RESERVED_FRONTMATTER_KEYS,
  });

  const accessUseCases: AccessUseCases = {
    requestSubscription: () => new RequestSubscription(onboarding, links),
    getSession: (request) => {
      const scoped = scopedAccess(request);
      return new GetSession(
        links,
        scoped?.subscriptions ?? null,
        async (id) => {
          const found = accessDb.subscriptions.get(`S#${id.value}`)?.subscription;
          return found
            ? { status: found.status.name, type: found.type.name, quota: found.quota.name }
            : null;
        },
        async () => storage.usedBytes,
      );
    },
    switchSubscription: () => new SwitchActiveSubscription(links),
    listPlatformQueue: () => new ListPlatformQueue(platform),
    reviewSubscription: () => new ReviewSubscription(platform),
    listMembers: (request) => {
      const scoped = scopedAccess(request);
      return new ListMembers(scoped!.subscriptions);
    },
    inviteMember: (request) => {
      const scoped = scopedAccess(request);
      return new InviteMember(scoped!.subscriptions, scoped!.invites);
    },
    acceptInvite: (request) => {
      const scoped = scopedAccess(request);
      return new AcceptInvite(scoped!.invites, scoped!.subscriptions, links);
    },
    changeMemberRole: (request) => {
      const scoped = scopedAccess(request);
      return new ChangeMemberRole(scoped!.subscriptions);
    },
    removeMember: (request) => {
      const scoped = scopedAccess(request);
      return new RemoveMember(scoped!.subscriptions, links);
    },
    transferOwnership: (request) => {
      const scoped = scopedAccess(request);
      return new TransferOwnership(scoped!.subscriptions, links);
    },
    connectorOfSession: (request) =>
      new ConnectorOfSession(scopedAccess(request)?.connectors ?? null, CONNECTOR_CLIENT_ID),
  };

  const knowledgeUseCases: KnowledgeUseCases = {
    createNotebook: (request) => new CreateNotebook(knowledgeRepos(request.subscription)),
    listNotebooks: (request) => new ListNotebooks(knowledgeRepos(request.subscription)),
    getNotebook: (request) => new GetNotebook(knowledgeRepos(request.subscription)),
    renameNotebook: (request) => new RenameNotebook(knowledgeRepos(request.subscription)),
    deleteNotebook: (request) => new DeleteNotebook(knowledgeRepos(request.subscription)),
    restoreNotebook: (request) => new RestoreNotebook(knowledgeRepos(request.subscription)),
    putGuidance: (request) => new PutGuidance(knowledgeRepos(request.subscription)),
    getNotebookContext: (request) => new GetNotebookContext(knowledgeRepos(request.subscription)),
    setNotebookLimit: (request) => new SetNotebookRoleLimit(knowledgeRepos(request.subscription)),
    clearNotebookLimit: (request) =>
      new ClearNotebookRoleLimit(knowledgeRepos(request.subscription)),
    createFolder: (request) => new CreateFolder(knowledgeRepos(request.subscription)),
    patchFolder: (request) => new PatchFolder(knowledgeRepos(request.subscription)),
    reorderFolder: (request) => new ReorderFolder(knowledgeRepos(request.subscription)),
    removeFolder: (request) => new RemoveFolder(knowledgeRepos(request.subscription)),
    putTemplate: (request) => new PutTemplate(knowledgeRepos(request.subscription)),
    getTemplate: (request) => new GetTemplate(knowledgeRepos(request.subscription)),
    listNotes: (request) => new ListNotes(knowledgeRepos(request.subscription)),
    readNote: (request) => new ReadNote(knowledgeRepos(request.subscription)),
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
    notebookActivity: () => new GetNotebookActivity(auditTrail),
    readRevision: () => new ReadRevision(auditTrail, revisions),
  };
  const auditConsumer = new AuditEventConsumer(new RecordEvents(auditTrail));

  const discovery = {
    graph: new InMemoryLinkGraph(),
    facets: new InMemoryFacetIndex(),
    structure: new InMemoryStructureProjection(),
    catalog: new InMemoryNoteCatalog(),
    index: new InMemoryContentIndex(),
  };
  const discoveryDeps = {
    graph: discovery.graph,
    facets: discovery.facets,
    catalog: discovery.catalog,
    content: discovery.index,
  };
  /**
   * In production the bus drives these; in the test the harness does, which
   * is the same contract with a shorter wire (section 24).
   */
  const projectNote = new ProjectNote({
    graph: discovery.graph,
    facets: discovery.facets,
    index: discovery.index,
    structure: discovery.structure,
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
    resolveLinkTarget: () => new ResolveLinkTarget(discoveryDeps),
    health: () => new NotebookHealth(discoveryDeps),
    graph: () => new NotebookGraphQuery(discoveryDeps),
    search: () => new SearchNotes(discoveryDeps),
    facets: () => new GetFacetStats(discoveryDeps),
  };

  /**
   * The export in the harness: the same use case, the same tree builder and
   * the same zip writer as production. Only the object store is in memory, and
   * the archive it keeps is what the test reads back.
   */
  const archives = new Map<string, Buffer>();
  /**
   * The uploads of an import, in memory. The presigned address is a marker
   * this harness answers to itself: what the tests exercise is what happens
   * once the bytes are here.
   */
  const uploads = new Map<string, Buffer>();
  const uploadStore = {
    presignUpload: async (key: string) => `memory://upload/${key}`,
    read: async (key: string) => uploads.get(key) ?? null,
    discard: async (key: string) => void uploads.delete(key),
  };
  const portabilityUseCases: PortabilityUseCases = {
    exportNotebook: (request) =>
      new ExportNotebook(
        new KnowledgeExportSource(knowledgeRepos(request.subscription)),
        {
          put: async (key, archive) => {
            archives.set(key, archive);
          },
          presign: async (key, _ttl, filename) => `memory://${key}?filename=${filename}`,
        },
        createZip,
        request.subscription.subscriptionId.value,
        serializeNotebookDocument,
      ),
    prepareImport: (request) =>
      new PrepareImport(uploadStore, request.subscription.subscriptionId.value),
    importNotebook: (request) =>
      new ImportNotebook(
        uploadStore,
        request.write,
        readZip,
        parseNotebookDocument,
        request.subscription.subscriptionId.value,
      ),
  };

  const app = createApp({
    verifier,
    connectorBindings: {
      verifier,
      connectorClientId: CONNECTOR_CLIENT_ID,
      signedWithIam: (c) => c.req.header(SIGNED_WITH_IAM) === 'true',
      bindConnector: (context) =>
        new BindConnector(new InMemoryConnectorBindingRepository(context, accessDb)),
      rebindConnector: (context) =>
        new RebindConnector(new InMemoryConnectorBindingRepository(context, accessDb)),
    },
    /** The write side of an import, over the same use cases production uses. */
    notebookWriterFor: (request) =>
      new KnowledgeNotebookWriter(
        {
          createNotebook: new CreateNotebook(knowledgeRepos(request.subscription)),
          putGuidance: new PutGuidance(knowledgeRepos(request.subscription)),
          createFolder: new CreateFolder(knowledgeRepos(request.subscription)),
          putTemplate: new PutTemplate(knowledgeRepos(request.subscription)),
          createNote: new CreateNote(knowledgeRepos(request.subscription)),
          deleteNotebook: new DeleteNotebook(knowledgeRepos(request.subscription)),
        },
        request.ctx,
        request.subscription.subscriptionId,
      ),
    accessUseCases,
    knowledgeUseCases,
    auditUseCases,
    discoveryUseCases,
    portabilityUseCases,
    // Discovery holds no notebook, so it asks the context that owns it.
    canReadNotebook: async (request, notebookId) => {
      const parsed = (await import('@memorysmith/kernel')).NotebookId.create(notebookId);
      if (!parsed.ok) return false;
      const notebook = await knowledgeRepos(request.subscription).notebooks.findById(parsed.value);
      // A deleted notebook is unreadable to every context, not only to Knowledge.
      return notebook !== null && !notebook.isDeleted;
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
      const resolved = await new ResolveRequestContext(scoped!.subscriptions).execute(context);
      if (!resolved.ok) return { ok: false as const, error: resolved.error };

      const knowledgeRequest: KnowledgeRequest = {
        ctx: resolved.value,
        subscription: context,
        // The same resolution production makes, over the in-memory bindings.
        authorship: await new ResolveAuthorship(scoped!.connectors, CONNECTOR_CLIENT_ID).execute({
          user: context.userId,
          credential: request.credential,
        }),
        subscriptionRole: resolved.value.isOwner ? Role.OWNER : resolved.value.role,
      };
      return { ok: true as const, value: knowledgeRequest };
    },
  });

  return {
    app,
    accessDb,
    knowledgeDb,
    events,
    storage,
    verifier,
    links,
    platform,
    auditTrail,
    auditConsumer,
    discovery,
    projectNote,
    projectStructure,
    archives,
    uploads,
  };
}
