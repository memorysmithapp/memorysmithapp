/**
 * An in-memory wiring of the whole monolith, for tests that need the two
 * contexts talking to each other: the isolation tests, and the
 * vertical slices.
 *
 * It is the same composition root shape as production; only the adapters
 * differ, which is the point of the hexagon.
 */

import { RESERVED_FRONTMATTER_KEYS, type Deployment } from '@memorysmithapp/contracts';
import {
  FILE_TYPE_CATALOGUE,
  PICTURE_CATALOGUE,
  serializeNotebookDocument,
} from '../src/composition-root.js';
import {
  DomainError,
  NotebookId,
  Role,
  ok,
  type SubscriptionContext,
  type EventPublisher,
  type DomainEvent,
} from '@memorysmithapp/kernel';
import type { TokenVerifier, VerifiedToken } from '@memorysmithapp/svc-access/adapters/auth';
import type { AccessRequest, AccessUseCases } from '@memorysmithapp/svc-access/adapters/http';
import type {
  KnowledgeRequest,
  KnowledgeUseCases,
} from '@memorysmithapp/svc-knowledge/adapters/http';
import {
  InMemoryAccessDatabase,
  InMemoryAccountDirectory,
  InMemoryAvatarRepository,
  InMemoryConnectorBindingRepository,
  InMemoryOnboarding,
  InMemoryPlatformAdmin,
  InMemorySubscriptionRepository,
  InMemoryAccountLookup,
  InMemoryShareRepository,
  InMemoryUserLinkRepository,
} from '@memorysmithapp/svc-access/adapters/memory';
import {
  contextThrough,
  DeleteNotebookAndShares,
  KnowledgeSharedNotebooks,
  modelLicencesOf,
  modelSourcesOf,
  openShared,
  openShareOf,
  shareUseCasesOf,
} from '../src/shares.js';
import {
  GetSession,
  RequestSubscription,
  SwitchActiveSubscription,
} from '@memorysmithapp/svc-access/application/onboarding';
import {
  ChangePassword,
  ChooseLanguage,
  EditProfile,
  pictureUrlOf,
  ReadProfile,
  RecordWelcome,
  SetProfilePicture,
} from '@memorysmithapp/svc-access/application/account';
import {
  ListPlatformQueue,
  ReviewSubscription,
} from '@memorysmithapp/svc-access/application/platform';
import {
  ChangeMemberRole,
  ListMembers,
  RemoveMember,
  TransferOwnership,
} from '@memorysmithapp/svc-access/application/members';
import { ResolveRequestContext } from '@memorysmithapp/svc-access/application/context';
import {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  ResolveAuthorship,
} from '@memorysmithapp/svc-access/application/connectors';
import {
  InMemoryContentSlotRepository,
  InMemoryFolderNumbers,
  InMemoryContentStore,
  InMemoryFileRepository,
  InMemoryFileStore,
  InMemoryTableRepository,
  InMemoryStorageBudget,
  InMemoryStorageUsage,
  InMemoryDatabase,
  InMemoryNoteRepository,
  InMemoryNotebookRepository,
} from '@memorysmithapp/svc-knowledge/adapters/memory';
import {
  ClearMemberCeilings,
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
} from '@memorysmithapp/svc-knowledge/application/notebooks';
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
} from '@memorysmithapp/svc-knowledge/application/folders';
import {
  CreateNote,
  DeleteNote,
  ListNotes,
  MoveNote,
  ReadNote,
  ReorderNote,
  UpdateNote,
} from '@memorysmithapp/svc-knowledge/application/notes';
import {
  CheckFileDestination,
  DeleteFile,
  KeepAssembledFile,
  KeepFile,
  LinkToFile,
  ListFiles,
} from '@memorysmithapp/svc-knowledge/application/files';
import {
  AlterTable,
  CreateTable,
  DeleteRows,
  DeleteTable,
  GetTable,
  InsertRows,
  ListTables,
  QueryTable,
  UpdateRows,
} from '@memorysmithapp/svc-knowledge/application/tables';
import { ImportTableRows } from '@memorysmithapp/svc-knowledge/application/table-imports';
import { SpreadsheetReader } from '@memorysmithapp/svc-knowledge/adapters/sheets';
import { InMemoryAuditTrail } from '@memorysmithapp/svc-audit/adapters/trail';
import type {
  PortabilityRequest,
  PortabilityUseCases,
} from '@memorysmithapp/svc-portability/adapters/http';
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
  type TransferWork,
} from '@memorysmithapp/svc-portability/application/transfers';
import {
  InMemoryModelStore,
  InMemoryTransferStore,
} from '@memorysmithapp/svc-portability/adapters/dynamo';
import {
  CreateFromVersion,
  CreateModelVersion,
  DeclareModel,
  DeleteModelVersion,
  ForgetModel,
  GetModel,
  ListModels,
  ViewModelVersion,
  type ModelCaller,
  type ModelDependencies,
  type ModelSources,
} from '@memorysmithapp/svc-portability/application/models';
import {
  InMemoryCatalogReports,
  InMemoryCatalogStore,
} from '@memorysmithapp/svc-portability/adapters/catalog';
import {
  CreateFromCatalog,
  PublicationOf,
  PublishModel,
  ReportModel,
  WithdrawModel,
  refreshPublication,
  type CatalogReading,
} from '@memorysmithapp/svc-portability/application/catalog';
import {
  catalogOperatorUseCasesOf,
  forgetPublication,
  NO_EDGE_CACHE,
  publicCatalogUseCasesOf,
} from '../src/catalog.js';
import {
  InMemoryPartStore,
  InMemoryPreviewQueue,
  InMemoryPreviewStore,
  InMemoryPrintQueue,
  InMemoryPrintStore,
} from '@memorysmithapp/svc-portability/adapters/memory';
import { GetPrint, StartPrint } from '@memorysmithapp/svc-portability/application/prints';
import { GetPreview, StartPreview } from '@memorysmithapp/svc-portability/application/previews';
import {
  BeginUpload,
  discardUpload,
  FinishUpload,
  GetUploadStatus,
  LinkUpload,
  RequestFile,
  ListUploads,
  ObserveUpload,
  PutUploadPart,
} from '@memorysmithapp/svc-portability/application/uploads';
import { KnowledgeFileKeeper } from '../src/file-keeper.js';
import { ExportNotebook } from '@memorysmithapp/svc-portability/application';
import { createZip, readZip } from '@memorysmithapp/svc-portability/adapters/zip';
import {
  ImportFromExport,
  ImportNotebook,
  PrepareImport,
} from '@memorysmithapp/svc-portability/application/import';
import { KnowledgeNotebookWriter } from '../src/import-writer.js';
import { parseNotebookDocument, readVersionDocument } from '../src/composition-root.js';
import { KnowledgeExportSource } from '../src/export-source.js';
import { AuditHistorySource } from '../src/history-source.js';
import { ImportedTrailWriter } from '../src/trail-writer.js';
import {
  GetNoteHistory,
  GetNotebookActivity,
  ReadRevision,
  RecordEvents,
} from '@memorysmithapp/svc-audit/application';
import { AuditEventConsumer } from '@memorysmithapp/svc-audit/adapters/consumer';
import type { AuditUseCases } from '@memorysmithapp/svc-audit/adapters/http';
import {
  InMemoryContentIndex,
  InMemoryProjectedVersions,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryNoteCatalog,
  InMemoryStructureProjection,
} from '@memorysmithapp/svc-discovery/adapters/memory';
import {
  Backlinks,
  NoteLinks,
  NotebookNames,
  AttachmentUses,
  ResolveLinkTarget,
  GetFacetStats,
  RelatedNotes,
  SearchNotes,
  NotebookGraphQuery,
  NotebookHealth,
} from '@memorysmithapp/svc-discovery/application/queries';
import type { DiscoveryUseCases } from '@memorysmithapp/svc-discovery/adapters/http';
import {
  ProjectNote,
  ProjectStructure,
} from '@memorysmithapp/svc-discovery/application/projections';
import { createApp } from '../src/app.js';
import { ReadStorageUsage } from '@memorysmithapp/svc-knowledge/application/usage';
import { Email, StorageQuota } from '@memorysmithapp/svc-access/domain/values';
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

  const tableRepositories = new Map<string, InMemoryTableRepository>();
  const tableRepositoryOf = (context: SubscriptionContext): InMemoryTableRepository => {
    const held = tableRepositories.get(context.subscriptionId.value);
    if (held) return held;
    const made = new InMemoryTableRepository(context, events);
    tableRepositories.set(context.subscriptionId.value, made);
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
    // The Tables of a notebook and their rows (#366), kept between calls too.
    tables: tableRepositoryOf(context),
    sheets: new SpreadsheetReader(),
    storage,
    // The same list production injects, from the same specification (RN-AGT-025).
    reservedVocabulary: RESERVED_FRONTMATTER_KEYS,
  });

  /** The shares of notebooks between subscriptions, over the same module production uses. */
  const accounts = new InMemoryAccountLookup();
  const sharing = {
    shares: new InMemoryShareRepository(accessDb, events),
    notebooks: new KnowledgeSharedNotebooks(
      (context) => knowledgeRepos(context).notebooks,
      async (id) => accessDb.subscriptions.get(`S#${id.value}`)?.subscription.status.name ?? null,
      (context) => modelLicencesOf(modelStoreOf(context)),
    ),
  };
  const notebookIdOf = (raw: string) => {
    const parsed = NotebookId.create(raw);
    return parsed.ok ? parsed.value : null;
  };

  const accessUseCases: AccessUseCases = {
    ...shareUseCasesOf({
      ...sharing,
      accounts,
      subscriptionsOf: (request) => scopedAccess(request)?.subscriptions ?? null,
    }),
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
      const context = request.context;
      return new RemoveMember(scoped!.subscriptions, links, {
        clearFor: (user, by) =>
          context
            ? new ClearMemberCeilings(knowledgeRepos(context)).execute({ userId: user, by })
            : Promise.resolve(ok()),
      });
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
        transit: () => transfers.transitUsage(),
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
    deleteNotebook: (request) =>
      new DeleteNotebookAndShares(
        knowledgeRepos(request.subscription),
        request.subscription,
        sharing.shares,
        async (notebookId) => {
          const models = modelStoreOf(request.subscription);
          await forgetPublication({ models, catalog, cache: NO_EDGE_CACHE }, notebookId.value);
          await new ForgetModel({ models, transfers }, async (transfer) => {
            await new DeleteTransfer(transfers, archiveStore, transfer.userId).execute(
              transfer.transferId,
            );
          }).execute(notebookId.value);
        },
      ),
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
    listTables: (request) => new ListTables(knowledgeRepos(request.subscription)),
    createTable: (request) => new CreateTable(knowledgeRepos(request.subscription)),
    getTable: (request) => new GetTable(knowledgeRepos(request.subscription)),
    alterTable: (request) => new AlterTable(knowledgeRepos(request.subscription)),
    deleteTable: (request) => new DeleteTable(knowledgeRepos(request.subscription)),
    queryTable: (request) => new QueryTable(knowledgeRepos(request.subscription)),
    insertRows: (request) => new InsertRows(knowledgeRepos(request.subscription)),
    updateRows: (request) => new UpdateRows(knowledgeRepos(request.subscription)),
    deleteRows: (request) => new DeleteRows(knowledgeRepos(request.subscription)),
    importTableRows: (request) => new ImportTableRows(knowledgeRepos(request.subscription)),
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
   * is the same contract with a shorter wire (ADR-005).
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
    attachments: () => new AttachmentUses(discoveryDeps),
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
  // A print is handed to a renderer the harness has none of: a case reads the
  // job it was handed, and sets what the renderer would have left (RN-PRT-031).
  const prints = { queue: new InMemoryPrintQueue(), store: new InMemoryPrintStore() };
  // A preview the same way: the job it was handed, and what the renderer left (#260).
  const previews = { queue: new InMemoryPreviewQueue(), store: new InMemoryPreviewStore() };
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
  /**
   * The parts of the uploads (RN-PRT-027). The whole they are joined into is
   * handed to the store of files of its subscription, which is where the
   * bucket would have it for the copy that makes it a file.
   */
  const parts = new InMemoryPartStore((key, versionId, bytes) => {
    const subscriptionId = /^s\/([^/]+)\/uploads\//.exec(key)?.[1];
    const store = subscriptionId ? fileStores.get(subscriptionId) : undefined;
    store?.assembled.set(`${key}@${versionId}`, bytes);
  });
  const exporterFor = async (request: PortabilityRequest, work: TransferWork) => {
    // The worker's rule: a notebook shared with the person is read through a
    // share still accepted, and kept where the person is (RN-ACC-027).
    let source = request.subscription;
    if (work.sourceSubscriptionId && work.sourceSubscriptionId !== work.subscriptionId) {
      const notebookId = notebookIdOf(work.notebookId ?? '');
      const share = notebookId
        ? await openShareOf(request.subscription.userId, notebookId, sharing)
        : null;
      if (!share) throw new Error('The notebook is no longer shared with the person');
      source = contextThrough(share);
    }
    return new ExportNotebook(
      new KnowledgeExportSource(knowledgeRepos(source)),
      archiveStore,
      createZip,
      request.subscription.subscriptionId.value,
      serializeNotebookDocument,
      // The history an export may be asked to carry (RN-PRT-022).
      new AuditHistorySource(auditTrail, revisions),
    );
  };
  const modelStores = new Map<string, InMemoryModelStore>();
  const modelStoreOf = (context: SubscriptionContext): InMemoryModelStore => {
    const held = modelStores.get(context.subscriptionId.value);
    if (held) return held;
    const made = new InMemoryModelStore();
    modelStores.set(context.subscriptionId.value, made);
    return made;
  };
  const modelsOf = (request: PortabilityRequest): ModelDependencies => ({
    models: modelStoreOf(request.subscription),
    transfers,
    notebooks: {
      own: async (notebookId) => {
        const parsed = NotebookId.create(notebookId);
        if (!parsed.ok) return null;
        const notebook = await knowledgeRepos(request.subscription).notebooks.findById(
          parsed.value,
        );
        if (!notebook || notebook.isDeleted) return null;
        return { name: notebook.name.value, noteCount: notebook.noteCount };
      },
    },
    queue: {
      send: async (work) => {
        await new RunExport(transfers, await exporterFor(request, work)).execute(work);
        // As the worker does: a version made ready joins a published model (#360).
        if (work.modelVersion && work.notebookId) {
          await refreshPublication(
            {
              models: modelStoreOf(request.subscription),
              transfers,
              catalog,
              cache: NO_EDGE_CACHE,
            },
            work.notebookId,
          );
        }
      },
    },
    budget: { current: async () => ({ usedBytes: 0, limitBytes: Number.MAX_SAFE_INTEGER }) },
    versions: {
      read: (key) => readVersionDocument(async (at) => archives.get(at) ?? null, readZip, key),
    },
  });
  /** Where a request reads a model from, by the same module production uses (#355). */
  const sourcesOf = (request: PortabilityRequest): ModelSources =>
    modelSourcesOf({
      user: request.subscription.userId,
      own: request.subscription,
      holds: async (notebookId) => (await modelsOf(request).notebooks.own(notebookId)) !== null,
      canRead: request.canRead,
      depsOf: (context) => ({
        models: modelStoreOf(context),
        transfers,
        versions: modelsOf(request).versions,
      }),
      sharing,
      parse: notebookIdOf,
    });
  /** The community catalog (#360), at the level of the platform, in memory. */
  const catalog = new InMemoryCatalogStore();
  const catalogReports = new InMemoryCatalogReports();
  const catalogReading: CatalogReading = {
    catalog,
    access: {
      grants: async (id) =>
        ['trial', 'active'].includes(
          accessDb.subscriptions.get(`S#${id}`)?.subscription.status.name ?? '',
        ),
    },
  };
  /** What the operator's withdrawals told their authors, for a test to read. */
  const authorMail: Array<{ to: string; name: string; reason: string }> = [];
  const callerOf = (request: PortabilityRequest): ModelCaller => ({
    subscriptionId: request.subscription.subscriptionId.value,
    userId: request.subscription.userId.value,
    isOwner: request.isOwner,
  });
  const portabilityUseCases: PortabilityUseCases = {
    startExport: (request) =>
      new StartExport(
        transfers,
        {
          send: async (work) => {
            await new RunExport(transfers, await exporterFor(request, work)).execute(work);
          },
        },
        {
          brief: async (notebookId: string) => {
            const parsed = NotebookId.create(notebookId);
            if (!parsed.ok) return null;
            const mine = await knowledgeRepos(request.subscription).notebooks.findById(
              parsed.value,
            );
            const share =
              mine && !mine.isDeleted
                ? null
                : await openShareOf(request.subscription.userId, parsed.value, sharing);
            if (!share && (!mine || mine.isDeleted)) return null;
            const repos = knowledgeRepos(share ? contextThrough(share) : request.subscription);
            const notebook = share ? await repos.notebooks.findById(parsed.value) : mine;
            if (!notebook || notebook.isDeleted) return null;
            const notes = await repos.notes.listByNotebook(parsed.value);
            return {
              name: notebook.name.value,
              noteCount: notes.length,
              ...(share ? { sourceSubscriptionId: share.ownerSubscriptionId.value } : {}),
            };
          },
        },
        { current: async () => ({ usedBytes: 0, limitBytes: Number.MAX_SAFE_INTEGER }) },
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    listTransfers: (request) =>
      new ListTransfers(transfers, request.subscription.userId.value, (transfer) =>
        new ObserveUpload(parts, request.subscription.subscriptionId.value).execute(transfer),
      ),
    getTransfer: (request) => new GetTransfer(transfers, request.subscription.userId.value),
    downloadTransfer: (request) =>
      new DownloadTransfer(transfers, archiveStore, request.subscription.userId.value),
    deleteTransfer: (request) =>
      new DeleteTransfer(transfers, archiveStore, request.subscription.userId.value, (transfer) =>
        discardUpload(parts, request.subscription.subscriptionId.value, transfer),
      ),
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
    beginUpload: (request) =>
      new BeginUpload(
        transfers,
        parts,
        request.files,
        {
          // What the session reads: the content and what the open uploads reserve.
          current: async () => {
            const [held, transit] = await Promise.all([
              storage.current(),
              transfers.transitUsage(),
            ]);
            return { usedBytes: held.usedBytes + transit.bytes, limitBytes: held.limitBytes };
          },
        },
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    listUploads: (request) =>
      new ListUploads(
        transfers,
        parts,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    uploadStatus: (request) =>
      new GetUploadStatus(
        transfers,
        parts,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    putUploadPart: (request) =>
      new PutUploadPart(
        transfers,
        parts,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    finishUpload: (request) =>
      new FinishUpload(
        transfers,
        parts,
        request.files,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    linkUpload: (request) =>
      new LinkUpload(transfers, request.files, request.subscription.userId.value),
    requestFile: (request) =>
      new RequestFile(
        transfers,
        parts,
        request.files,
        request.subscription.subscriptionId.value,
        request.subscription.userId.value,
      ),
    startPrint: (request) =>
      new StartPrint(prints.queue, request.subscription.subscriptionId.value),
    getPrint: (request) => new GetPrint(prints.store, request.subscription.subscriptionId.value),
    startPreview: (request) =>
      new StartPreview(previews.queue, previews.store, request.subscription.subscriptionId.value),
    getPreview: (request) =>
      new GetPreview(previews.store, request.subscription.subscriptionId.value),
    // The models of a subscription and their versions (#353), over the same
    // use cases production builds, with the worker inline.
    declareModel: (request) => new DeclareModel(modelsOf(request), callerOf(request)),
    getModel: (request) => new GetModel(sourcesOf(request)),
    listModels: (request) => new ListModels(modelsOf(request), request.canRead, sourcesOf(request)),
    createModelVersion: (request) => new CreateModelVersion(modelsOf(request), callerOf(request)),
    viewModelVersion: (request) => new ViewModelVersion(sourcesOf(request)),
    deleteModelVersion: (request) =>
      new DeleteModelVersion(modelsOf(request), callerOf(request), async (transfer) => {
        await new DeleteTransfer(transfers, archiveStore, transfer.userId).execute(
          transfer.transferId,
        );
        await refreshPublication(
          { ...modelsOf(request), catalog, cache: NO_EDGE_CACHE },
          transfer.notebookId ?? '',
        );
      }),
    createFromVersion: (request) =>
      new CreateFromVersion(
        sourcesOf(request),
        callerOf(request),
        uploadStore,
        portabilityUseCases.startImport(request),
      ),
    // The community catalog (#360), over the same use cases production builds.
    publishModel: (request) =>
      new PublishModel({ ...modelsOf(request), catalog, cache: NO_EDGE_CACHE }, callerOf(request)),
    withdrawModel: (request) =>
      new WithdrawModel({ ...modelsOf(request), catalog, cache: NO_EDGE_CACHE }, callerOf(request)),
    publicationOf: (request) =>
      new PublicationOf({ models: modelStoreOf(request.subscription), catalog }),
    createFromCatalog: (request) =>
      new CreateFromCatalog(
        catalogReading,
        callerOf(request),
        uploadStore,
        portabilityUseCases.startImport(request),
      ),
    reportModel: (request) =>
      new ReportModel(
        { ...catalogReading, reports: catalogReports },
        request.subscription.userId.value,
      ),
  };

  const app = createApp({
    deployment,
    verifier,
    connectorClientId: CONNECTOR_CLIENT_ID,
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
          createTable: new CreateTable(knowledgeRepos(request.subscription)),
          insertRows: new InsertRows(knowledgeRepos(request.subscription)),
          deleteNotebook: new DeleteNotebook(knowledgeRepos(request.subscription)),
        },
        request.ctx,
        request.subscription.subscriptionId,
        knowledgeRepos(request.subscription).content,
      ),
    /** What an upload in parts becomes a file with, over the same use cases (RN-PRT-027). */
    fileKeeperFor: (request) =>
      new KnowledgeFileKeeper(async (notebookId) => {
        const through =
          (await openShared(request, notebookId.value, { ...sharing, parse: notebookIdOf })) ??
          request;
        const knowledge = {
          ...knowledgeRepos(through.subscription),
          fileStore: fileStoreOf(through.subscription).withUploadsOf(
            fileStoreOf(request.subscription),
          ),
        };
        return {
          useCases: {
            destination: new CheckFileDestination(knowledge),
            keep: new KeepAssembledFile(knowledge),
          },
          ctx: through.ctx,
        };
      }),
    openSharedNotebook: (request, notebookId) =>
      openShared(request, notebookId, { ...sharing, parse: notebookIdOf }),
    accessUseCases,
    knowledgeUseCases,
    auditUseCases,
    discoveryUseCases,
    portabilityUseCases,
    publicCatalog: publicCatalogUseCasesOf(catalogReading, {
      read: (key) => readVersionDocument(async (at) => archives.get(at) ?? null, readZip, key),
    }),
    catalogOperator: catalogOperatorUseCasesOf({
      catalog,
      reports: catalogReports,
      cache: NO_EDGE_CACHE,
      notifier: {
        withdrawn: async (entry, reason) => {
          authorMail.push({ to: entry.authorEmail, name: entry.name, reason });
        },
      },
    }),
    nameOf: async (email) => {
      const parsed = Email.create(email);
      return parsed.ok ? accountDirectory.nameOf(parsed.value) : null;
    },
    // Discovery holds no notebook, so it asks the context that owns it.
    canReadNotebook: async (request, notebookId) => {
      const parsed = (await import('@memorysmithapp/kernel')).NotebookId.create(notebookId);
      if (!parsed.ok) return false;
      const notebook = await knowledgeRepos(request.subscription).notebooks.findById(parsed.value);
      // A deleted notebook is unreadable to every context, not only to Knowledge.
      return notebook !== null && !notebook.isDeleted;
    },
    // And Audit holds no note: what a notebook still holds, live, is a
    // Knowledge fact (RN-KNW-046).
    notebookHoldsNote: async (request, notebookId, noteId) => {
      const kernel = await import('@memorysmithapp/kernel');
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
    /** Who an e-mail belongs to, which a test registers to share with it. */
    accounts,
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
    prints,
    previews,
    uploads,
    transfers,
    parts,
    /** What the purge worker would have recorded, for the counters to read (#197). */
    relayed,
    /** The names of the accounts, which the catalog shows of an author (#357). */
    accountDirectory,
    /** The catalog and its reports, and what the authors were told (#360). */
    catalog,
    catalogReports,
    authorMail,
    /** Makes the discard of an upload fail, or stop failing when given null. */
    refuseDiscard: (error: Error | null): void => {
      refusals.discard = error;
    },
  };
}
