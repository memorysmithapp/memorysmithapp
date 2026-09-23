/**
 * An in-memory wiring of the whole monolith, for tests that need the two
 * contexts talking to each other: the isolation tests of section 19, and the
 * vertical slices.
 *
 * It is the same composition root shape as production; only the adapters
 * differ, which is the point of the hexagon.
 */

import { RESERVED_FRONTMATTER_KEYS, type Deployment } from '@memorysmith/contracts';
import {
  FILE_TYPE_CATALOGUE,
  PICTURE_CATALOGUE,
  serializeNotebookDocument,
} from '../src/composition-root.js';
import {
  DomainError,
  NotebookId,
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
  InMemoryAccountDirectory,
  InMemoryAvatarRepository,
  InMemoryConnectorBindingRepository,
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
  ChangePassword,
  ChooseLanguage,
  EditProfile,
  pictureUrlOf,
  ReadProfile,
  RecordWelcome,
  SetProfilePicture,
} from '@memorysmith/svc-access/application/account';
import {
  ListPlatformQueue,
  ReviewSubscription,
} from '@memorysmith/svc-access/application/platform';
import {
  ChangeMemberRole,
  ListMembers,
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
  InMemoryContentSlotRepository,
  InMemoryFolderNumbers,
  InMemoryContentStore,
  InMemoryFileRepository,
  InMemoryFileStore,
  InMemoryStorageBudget,
  InMemoryStorageUsage,
  InMemoryDatabase,
  InMemoryNoteRepository,
  InMemoryNotebookRepository,
} from '@memorysmith/svc-knowledge/adapters/memory';
import {
  ClearNotebookRoleLimit,
  CreateNotebook,
  DeleteGuidance,
  GetNotebook,
  GetNotebookContext,
  ListNotebooks,
  PutGuidance,
  DeleteNotebook,
  RenameNotebook,
  SetNotebookRoleLimit,
} from '@memorysmith/svc-knowledge/application/notebooks';
import {
  CreateFolder,
  DeleteTemplate,
  NextNumber,
  RestoreFolderNumber,
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
  UpdateNote,
} from '@memorysmith/svc-knowledge/application/notes';
import {
  DeleteFile,
  KeepFile,
  LinkToFile,
  ListFiles,
} from '@memorysmith/svc-knowledge/application/files';
import { InMemoryAuditTrail } from '@memorysmith/svc-audit/adapters/trail';
import type {
  PortabilityRequest,
  PortabilityUseCases,
} from '@memorysmith/svc-portability/adapters/http';
import {
  CancelTransfer,
  DeleteTransfer,
  DownloadTransfer,
  GetTransfer,
  ListTransfers,
  RunExport,
  RunImport,
  StartExport,
  StartImport,
} from '@memorysmith/svc-portability/application/transfers';
import { InMemoryTransferStore } from '@memorysmith/svc-portability/adapters/dynamo';
import { ExportNotebook } from '@memorysmith/svc-portability/application';
import { createZip, readZip } from '@memorysmith/svc-portability/adapters/zip';
import {
  ImportFromExport,
  ImportNotebook,
  PrepareImport,
} from '@memorysmith/svc-portability/application/import';
import { KnowledgeNotebookWriter } from '../src/import-writer.js';
import { parseNotebookDocument } from '../src/composition-root.js';
import { KnowledgeExportSource } from '../src/export-source.js';
import { AuditHistorySource } from '../src/history-source.js';
import { ImportedTrailWriter } from '../src/trail-writer.js';
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
  InMemoryProjectedVersions,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryStructureProjection,
} from '@memorysmith/svc-discovery/adapters/memory';
import {
  Backlinks,
  NoteLinks,
  NotebookNames,
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
import { ReadStorageUsage } from '@memorysmith/svc-knowledge/application/usage';
import { StorageQuota } from '@memorysmith/svc-access/domain/values';
import { noSubscription, SubscriptionUsageReport } from '../src/usage.js';

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

/** What the harness says it is, unless a test asks for another environment. */
const TEST_DEPLOYMENT: Deployment = {
  environment: 'development',
  version: '0.0.0-test',
  commit: null,
};

export function buildTestApp(deployment: Deployment = TEST_DEPLOYMENT) {
  const accessDb = new InMemoryAccessDatabase();
  const knowledgeDb = new InMemoryDatabase();
  const events = new RecordingEventPublisher();
  const verifier = new FakeTokenVerifier();

  const links = new InMemoryUserLinkRepository(accessDb);
  // One directory for the whole run, so a name recorded by an edit is the
  // name the next session reads (#168).
  const accountDirectory = new InMemoryAccountDirectory();
  const onboarding = new InMemoryOnboarding(accessDb, events);
  const platform = new InMemoryPlatformAdmin(accessDb, events);

  const scopedAccess = (request: AccessRequest) => {
    const context = request.context;
    if (!context) return null;
    return {
      subscriptions: new InMemorySubscriptionRepository(context, accessDb, events),
      connectors: new InMemoryConnectorBindingRepository(context, accessDb),
      // The face of a person inside this subscription (#168).
      avatars: new InMemoryAvatarRepository(context, accessDb),
    };
  };

  /**
   * The knowledge repositories take a SubscriptionContext, so this function
   * simply cannot be called for a platform session: there is nothing to pass.
   */
  /** Shared by every use case of this app, exactly as the counter is in production. */
  const storage = new InMemoryStorageBudget();
  /**
   * Events no use case of the harness writes, because the worker that writes
   * them is not here: what a purge would have recorded, which a test adds to
   * say the purge ran (#197).
   */
  const relayed: DomainEvent[] = [];

  /**
   * One repository per subscription and kept between calls: a use case is
   * built per request, and a file kept by one has to be there for the next.
   */
  const fileRepositories = new Map<string, InMemoryFileRepository>();
  const fileStores = new Map<string, InMemoryFileStore>();
  const fileRepositoryOf = (context: SubscriptionContext): InMemoryFileRepository => {
    const held = fileRepositories.get(context.subscriptionId.value);
    if (held) return held;
    const made = new InMemoryFileRepository(context, events);
    fileRepositories.set(context.subscriptionId.value, made);
    return made;
  };
  const fileStoreOf = (context: SubscriptionContext): InMemoryFileStore => {
    const held = fileStores.get(context.subscriptionId.value);
    if (held) return held;
    const made = new InMemoryFileStore(context);
    fileStores.set(context.subscriptionId.value, made);
    return made;
  };

  const knowledgeRepos = (context: SubscriptionContext) => ({
    notebooks: new InMemoryNotebookRepository(context, knowledgeDb, events),
    notes: new InMemoryNoteRepository(context, knowledgeDb, events),
    slots: new InMemoryContentSlotRepository(context, knowledgeDb, events),
    numbers: new InMemoryFolderNumbers(context, knowledgeDb),
    content: new InMemoryContentStore(context, knowledgeDb),
    // The files of a notebook and their bytes (#166), each in a map of its own
    // per subscription, which is what the partition of the table is.
    files: fileRepositoryOf(context),
    fileStore: fileStoreOf(context),
    // The same list production injects, from the same published table (#166).
    fileTypes: FILE_TYPE_CATALOGUE,
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
        async () => {
          const avatar = await scoped?.avatars.find(request.profile.userId);
          return avatar ? { source: avatar.source.name, picture: pictureUrlOf(avatar) } : null;
        },
        async () => accountDirectory.nameOf(request.profile.email),
      );
    },
    switchSubscription: () => new SwitchActiveSubscription(links),
    chooseLanguage: () => new ChooseLanguage(accountDirectory),
    recordWelcome: () => new RecordWelcome(links),
    readProfile: (request) =>
      new ReadProfile(accountDirectory, scopedAccess(request)?.avatars ?? null),
    editProfile: (request) =>
      new EditProfile(accountDirectory, scopedAccess(request)?.avatars ?? null),
    setProfilePicture: (request) =>
      new SetProfilePicture(scopedAccess(request)?.avatars ?? null, PICTURE_CATALOGUE),
    changePassword: () => new ChangePassword(accountDirectory),
    listPlatformQueue: () => new ListPlatformQueue(platform),
    reviewSubscription: () => new ReviewSubscription(platform),
    listMembers: (request) => {
      const scoped = scopedAccess(request);
      return new ListMembers(scoped!.subscriptions);
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
    /**
     * What fills the space (#197). The counters are what the relay would have
     * made of every event this subscription recorded — the same arithmetic,
     * applied to a map — and the budget is the one the session reads.
     */
    subscriptionUsage: (request) => {
      const context = request.context;
      const scoped = scopedAccess(request);
      if (!context || !scoped) return { execute: async () => noSubscription() };
      return new SubscriptionUsageReport({
        resolve: () => new ResolveRequestContext(scoped.subscriptions).execute(context),
        knowledge: (ctx) => {
          const usage = new InMemoryStorageUsage();
          usage.record(
            [...events.published, ...relayed].filter(
              (event) => event.subscriptionId.value === context.subscriptionId.value,
            ),
          );
          return new ReadStorageUsage({
            notebooks: knowledgeRepos(context).notebooks,
            usage,
          }).execute({ ctx });
        },
        kept: () => transfers.keptUsage(),
        budget: async () => ({
          usedBytes: storage.usedBytes,
          limitBytes: (
            accessDb.subscriptions.get(`S#${context.subscriptionId.value}`)?.subscription.quota ??
            StorageQuota.DEFAULT
          ).bytes,
        }),
      });
    },
  };

  const knowledgeUseCases: KnowledgeUseCases = {
    createNotebook: (request) => new CreateNotebook(knowledgeRepos(request.subscription)),
    listNotebooks: (request) => new ListNotebooks(knowledgeRepos(request.subscription)),
    getNotebook: (request) => new GetNotebook(knowledgeRepos(request.subscription)),
    renameNotebook: (request) => new RenameNotebook(knowledgeRepos(request.subscription)),
    deleteNotebook: (request) => new DeleteNotebook(knowledgeRepos(request.subscription)),
    putGuidance: (request) => new PutGuidance(knowledgeRepos(request.subscription)),
    deleteGuidance: (request) => new DeleteGuidance(knowledgeRepos(request.subscription)),
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
    deleteTemplate: (request) => new DeleteTemplate(knowledgeRepos(request.subscription)),
    nextNumber: (request) => new NextNumber(knowledgeRepos(request.subscription)),
    listNotes: (request) => new ListNotes(knowledgeRepos(request.subscription)),
    readNote: (request) => new ReadNote(knowledgeRepos(request.subscription)),
    createNote: (request) => new CreateNote(knowledgeRepos(request.subscription)),
    updateNote: (request) => new UpdateNote(knowledgeRepos(request.subscription)),
    reorderNote: (request) => new ReorderNote(knowledgeRepos(request.subscription)),
    moveNote: (request) => new MoveNote(knowledgeRepos(request.subscription)),
    deleteNote: (request) => new DeleteNote(knowledgeRepos(request.subscription)),
    keepFile: (request) => new KeepFile(knowledgeRepos(request.subscription)),
    listFiles: (request) => new ListFiles(knowledgeRepos(request.subscription)),
    linkToFile: (request) => new LinkToFile(knowledgeRepos(request.subscription)),
    deleteFile: (request) => new DeleteFile(knowledgeRepos(request.subscription)),
  };

  // Audit and Discovery, wired in memory. In production they are fed by the
  // event bus; here the test drives them directly.
  const auditTrail = new InMemoryAuditTrail();
  /**
   * The past, read from the same in-memory store the present is written to.
   * It answers by the pair the entry carries, exactly as the object store
   * does, which is what lets a test read a note as it stood on a date — on an
   * imported notebook included (RN-PRT-023).
   */
  const revisions = {
    read: async (ref: { contentId: { value: string }; versionId: string }): Promise<string> => {
      for (const [key, slot] of knowledgeDb.content) {
        if (!key.endsWith(`/c/${ref.contentId.value}.md`)) continue;
        const found = slot.revisions.get(ref.versionId);
        if (found !== undefined) return found;
      }
      throw new Error(`No such revision: ${ref.contentId.value}@${ref.versionId}`);
    },
  };
  const auditUseCases: AuditUseCases = {
    noteHistory: () => new GetNoteHistory(auditTrail),
    notebookActivity: () => new GetNotebookActivity(auditTrail),
    readRevision: () => new ReadRevision(auditTrail, revisions),
  };
  const auditConsumer = new AuditEventConsumer(new RecordEvents(auditTrail, auditTrail));

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
    structure: discovery.structure,
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
    versions: new InMemoryProjectedVersions(),
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
    noteLinks: () => new NoteLinks(discoveryDeps),
    resolveLinkTarget: () => new ResolveLinkTarget(discoveryDeps),
    names: () => new NotebookNames(discoveryDeps),
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
  /**
   * What the store refuses. A discard runs after the notebook is written, so
   * setting this is how a test reads what an import answers when only its
   * cleanup failed.
   */
  const refusals: { discard: Error | null } = { discard: null };
  const uploadStore = {
    presignUpload: async (key: string) => `memory://upload/${key}`,
    read: async (key: string) => uploads.get(key) ?? null,
    discard: async (key: string) => {
      if (refusals.discard) throw refusals.discard;
      uploads.delete(key);
    },
    // A kept export becomes an upload without leaving the store (#207).
    copyFrom: async (source: string, key: string) => {
      const archive = archives.get(source);
      if (!archive) return false;
      uploads.set(key, archive);
      return true;
    },
  };
  const archiveStore = {
    put: async (key: string, archive: Buffer) => {
      archives.set(key, archive);
      // The harness is not versioned, so the revision is the key: what the
      // tests exercise is that deleting reaches the exact revision it stored.
      return { versionId: `v-${key}` };
    },
    presign: async (key: string, _ttl: number, filename: string) =>
      `memory://${key}?filename=${filename}`,
    destroy: async (key: string, _versionId: string) => void archives.delete(key),
  };
  /**
   * The transfers of the harness, in the same store production uses in memory,
   * and a queue that runs the worker inline: a test that had to wait for a
   * queue would be a test of the queue (RN-PRT-019).
   */
  const transfers = new InMemoryTransferStore();
  const exporterFor = (request: PortabilityRequest) =>
    new ExportNotebook(
      new KnowledgeExportSource(knowledgeRepos(request.subscription)),
      archiveStore,
      createZip,
      request.subscription.subscriptionId.value,
      serializeNotebookDocument,
      // The history an export may be asked to carry (RN-PRT-022).
      new AuditHistorySource(auditTrail, revisions),
    );
  const portabilityUseCases: PortabilityUseCases = {
    startExport: (request) =>
      new StartExport(
        transfers,
        {
          send: async (work) => {
            await new RunExport(transfers, exporterFor(request)).execute(work);
          },
        },
        {
          brief: async (notebookId: string) => {
            const parsed = NotebookId.create(notebookId);
            if (!parsed.ok) return null;
            const repos = knowledgeRepos(request.subscription);
            const notebook = await repos.notebooks.findById(parsed.value);
            if (!notebook || notebook.isDeleted) return null;
            const notes = await repos.notes.listByNotebook(parsed.value);
            return { name: notebook.name.value, noteCount: notes.length };
          },
        },
        { current: async () => ({ usedBytes: 0, limitBytes: Number.MAX_SAFE_INTEGER }) },
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    listTransfers: (request) => new ListTransfers(transfers, request.subscription.userId.value),
    getTransfer: (request) => new GetTransfer(transfers, request.subscription.userId.value),
    downloadTransfer: (request) =>
      new DownloadTransfer(transfers, archiveStore, request.subscription.userId.value),
    deleteTransfer: (request) =>
      new DeleteTransfer(transfers, archiveStore, request.subscription.userId.value),
    cancelTransfer: (request) => new CancelTransfer(transfers, request.subscription.userId.value),
    prepareImport: (request) =>
      new PrepareImport(uploadStore, request.subscription.subscriptionId.value),
    importFromExport: (request) =>
      new ImportFromExport(
        transfers,
        uploadStore,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    startImport: (request) =>
      new StartImport(
        transfers,
        {
          // The worker, inline: a test that had to wait for a queue would be a
          // test of the queue (RN-PRT-018).
          send: async (work) => {
            const author = request.authorship;
            if (!author.ok) return;
            await new RunImport(
              transfers,
              new ImportNotebook(
                uploadStore,
                request.write,
                readZip,
                parseNotebookDocument,
                request.subscription.subscriptionId.value,
                // Where a history the archive carried is written back, and the
                // transfer every reproduced entry records (RN-PRT-023).
                new ImportedTrailWriter(auditTrail, request.subscription.subscriptionId.value),
                work.transferId,
              ),
              author.value,
            ).execute(work);
          },
        },
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
  };

  const app = createApp({
    deployment,
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
          restoreFolderNumber: new RestoreFolderNumber(knowledgeRepos(request.subscription)),
          createNote: new CreateNote(knowledgeRepos(request.subscription)),
          keepFile: new KeepFile(knowledgeRepos(request.subscription)),
          deleteNotebook: new DeleteNotebook(knowledgeRepos(request.subscription)),
        },
        request.ctx,
        request.subscription.subscriptionId,
        knowledgeRepos(request.subscription).content,
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
    // And Audit holds no note: what a notebook still holds, live, is a
    // Knowledge fact (RN-KNW-046).
    notebookHoldsNote: async (request, notebookId, noteId) => {
      const kernel = await import('@memorysmith/kernel');
      const parsedNotebook = kernel.NotebookId.create(notebookId);
      const parsedNote = kernel.NoteId.create(noteId);
      if (!parsedNotebook.ok || !parsedNote.ok) return false;
      const repos = knowledgeRepos(request.subscription);
      const [notebook, note] = await Promise.all([
        repos.notebooks.findById(parsedNotebook.value),
        repos.notes.findById(parsedNotebook.value, parsedNote.value),
      ]);
      if (!notebook || notebook.isDeleted || !note || note.isDeleted) return false;
      return notebook.folders.has(note.folderId);
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
    /** What the purge worker would have recorded, for the counters to read (#197). */
    relayed,
    /** Makes the discard of an upload fail, or stop failing when given null. */
    refuseDiscard: (error: Error | null): void => {
      refusals.discard = error;
    },
  };
}
