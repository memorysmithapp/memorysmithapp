/**
 * Lambda entrypoint of the core deployable: the one place that knows this runs
 * on Lambda, and the one place that wires the AWS-backed adapters.
 *
 * Everything above it is transport-agnostic, which is what makes the same code
 * run under `vitest` against in-memory adapters and under Lambda against
 * DynamoDB and S3.
 */

import type { Context } from 'hono';
import { handle } from 'hono/aws-lambda';
import { deploymentFromVariables } from '@memorysmithapp/contracts';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
  DomainError,
  NoteId,
  NotebookId,
  ok,
  type SubscriptionContext,
  type SubscriptionId,
} from '@memorysmithapp/kernel';
import { CognitoTokenVerifier } from '@memorysmithapp/svc-access/adapters/auth';
import type { AccessRequest, AccessUseCases } from '@memorysmithapp/svc-access/adapters/http';
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
import { CognitoAccountDirectory } from '@memorysmithapp/svc-access/adapters/cognito';
import {
  ListPlatformQueue,
  ReviewSubscription,
} from '@memorysmithapp/svc-access/application/platform';
import {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  ResolveAuthorship,
} from '@memorysmithapp/svc-access/application/connectors';
import {
  ChangeMemberRole,
  ListMembers,
  RemoveMember,
  TransferOwnership,
} from '@memorysmithapp/svc-access/application/members';
import type {
  KnowledgeRequest,
  KnowledgeUseCases,
} from '@memorysmithapp/svc-knowledge/adapters/http';
import {
  ClearMemberCeilings,
  ClearNotebookRoleLimit,
  CreateNotebook,
  DeleteGuidance,
  DeleteNotebook,
  GetNotebook,
  GetNotebookContext,
  ListNotebooks,
  PutGuidance,
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
import type { AuditUseCases } from '@memorysmithapp/svc-audit/adapters/http';
import {
  GetNoteHistory,
  GetNotebookActivity,
  ReadRevision,
} from '@memorysmithapp/svc-audit/application';
import type { DiscoveryUseCases } from '@memorysmithapp/svc-discovery/adapters/http';
import type { SearchMeasure } from '@memorysmithapp/svc-discovery/domain';
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
import type {
  PortabilityRequest,
  PortabilityUseCases,
} from '@memorysmithapp/svc-portability/adapters/http';
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
  type OwnNotebooks,
} from '@memorysmithapp/svc-portability/application/models';
import type { Transfer } from '@memorysmithapp/svc-portability/domain/transfer';
import { readZip } from '@memorysmithapp/svc-portability/adapters/zip';
import { Email } from '@memorysmithapp/svc-access/domain/values';
import {
  CancelTransfer,
  DeleteTransfer,
  DownloadTransfer,
  GetTransfer,
  ListTransfers,
  StartExport,
  StartImport,
} from '@memorysmithapp/svc-portability/application/transfers';
import {
  SqsPreviewQueue,
  SqsPrintQueue,
  SqsTransferQueue,
} from '@memorysmithapp/svc-portability/adapters/sqs';
import { S3PrintStore } from '@memorysmithapp/svc-portability/adapters/prints';
import { S3PreviewStore } from '@memorysmithapp/svc-portability/adapters/previews';
import { GetPrint, StartPrint } from '@memorysmithapp/svc-portability/application/prints';
import { GetPreview, StartPreview } from '@memorysmithapp/svc-portability/application/previews';
import { SQSClient } from '@aws-sdk/client-sqs';
import {
  ImportFromExport,
  PrepareImport,
  type NotebookWriter,
} from '@memorysmithapp/svc-portability/application/import';
import { KnowledgeNotebookWriter } from './import-writer.js';
import { KnowledgeFileKeeper } from './file-keeper.js';
import { S3FileStore } from '@memorysmithapp/svc-knowledge/adapters/file-store';
import {
  S3ArchiveStore,
  S3PartStore,
  S3UploadStore,
} from '@memorysmithapp/svc-portability/adapters/s3';
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
  type FileKeeper,
} from '@memorysmithapp/svc-portability/application/uploads';
import { createApp } from './app.js';
import {
  DynamoCatalogReports,
  DynamoCatalogStore,
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
  CloudFrontCatalogCache,
  DynamoSubscriptionAccess,
  forgetPublication,
  NO_EDGE_CACHE,
  publicCatalogUseCasesOf,
  SesAuthorNotifier,
} from './catalog.js';
import {
  buildAccess,
  buildConnectorBindings,
  buildAudit,
  buildDiscovery,
  buildKnowledge,
  buildModels,
  readVersionDocument,
  buildShares,
  buildSubscriptionUsage,
  buildTransfers,
  PICTURE_CATALOGUE,
  readStorageBudget,
  roleOf,
  type Infrastructure,
} from './composition-root.js';
import { KnowledgeNoteCatalog } from './note-catalog.js';
import {
  contextThrough,
  DeleteNotebookAndShares,
  modelSourcesOf,
  openShared,
  openShareOf,
  shareUseCasesOf,
} from './shares.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const infra: Infrastructure = {
  db: DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  }),
  s3: new S3Client({}),
  knowledgeTable: required('KNOWLEDGE_TABLE'),
  accessTable: required('ACCESS_TABLE'),
  auditTable: required('AUDIT_TABLE'),
  discoveryTable: required('DISCOVERY_TABLE'),
  portabilityTable: required('PORTABILITY_TABLE'),
  contentBucket: required('CONTENT_BUCKET'),
  // Where a link to a kept file or an export is answered: a host of the
  // product, not the bucket's name (#255).
  filesOrigin: required('FILES_ORIGIN'),
};

/**
 * The client that signs the address of a part of an upload (RN-PRT-027). The
 * SDK adds a checksum to what it signs by default, and for a URL signed before
 * the bytes exist that is the CRC32 of an empty body: a plain PUT of the real
 * part would be refused. This one signs only what a PUT needs.
 */
const signer = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' });

/** Where a signed part is answered: a host of the product, not the bucket's name (#241). */
const uploadsOrigin = required('UPLOADS_ORIGIN');

function partsOf(): S3PartStore {
  return new S3PartStore(infra.s3, signer, infra.contentBucket, uploadsOrigin);
}

const sqs = new SQSClient({});
const transferQueueUrl = required('TRANSFER_QUEUE_URL');
// Where a print is handed to the renderer, a function of its own (RN-PRT-031).
const printQueueUrl = required('PRINT_QUEUE_URL');

const verifier = new CognitoTokenVerifier(required('COGNITO_ISSUER'));

/** The app client of the connector proxy, whose tokens write as a connector. */
const connectorClientId = required('CONNECTOR_CLIENT_ID');

/**
 * Whether API Gateway authorized this request with IAM. Only a route behind the
 * IAM authorizer carries `authorizer.iam`, and only a principal allowed to
 * invoke that route gets through to carry one.
 */
function signedWithIam(c: Context): boolean {
  const env = c.env as
    { event?: { requestContext?: { authorizer?: { iam?: unknown } } } } | undefined;
  return Boolean(env?.event?.requestContext?.authorizer?.iam);
}

/** Where the language of an account is recorded: on the account, in the pool (RN-ACC-018). */
const accountDirectory = new CognitoAccountDirectory(
  required('USER_POOL_ID'),
  required('WEB_CLIENT_ID'),
);

/** The shares of notebooks between subscriptions, and what they open (RN-ACC-024). */
const sharing = buildShares(infra);

/**
 * The community catalog (#360): its entries and reports, at the level of the
 * platform, and the edge in front of its public route, emptied on a withdrawal.
 */
const catalog = new DynamoCatalogStore(infra.db, infra.portabilityTable);
const catalogReports = new DynamoCatalogReports(infra.db, infra.portabilityTable);
const catalogCache = process.env['CATALOG_DISTRIBUTION_ID']
  ? new CloudFrontCatalogCache(process.env['CATALOG_DISTRIBUTION_ID'])
  : NO_EDGE_CACHE;
const catalogReading: CatalogReading = {
  catalog,
  access: new DynamoSubscriptionAccess(infra.db, infra.accessTable),
};
/** Where a version is read from, wherever its subscription is: the key names it. */
const versionDocuments = {
  read: (key: string) =>
    readVersionDocument(
      (at) => new S3UploadStore(infra.s3, infra.contentBucket).read(at),
      readZip,
      key,
    ),
};

function notebookIdOf(raw: string): NotebookId | null {
  const parsed = NotebookId.create(raw);
  return parsed.ok ? parsed.value : null;
}

/** The Access use cases, each built from the subscription of this request. */
const accessUseCases: AccessUseCases = {
  requestSubscription: (request) => {
    const { onboarding, links } = buildAccess(infra, request.context);
    return new RequestSubscription(onboarding, links);
  },
  chooseLanguage: () => new ChooseLanguage(accountDirectory),
  readProfile: (request) =>
    new ReadProfile(accountDirectory, buildAccess(infra, request.context).scoped?.avatars ?? null),
  editProfile: (request) =>
    new EditProfile(accountDirectory, buildAccess(infra, request.context).scoped?.avatars ?? null),
  setProfilePicture: (request) =>
    new SetProfilePicture(
      buildAccess(infra, request.context).scoped?.avatars ?? null,
      PICTURE_CATALOGUE,
    ),
  changePassword: () => new ChangePassword(accountDirectory),
  recordWelcome: (request) => new RecordWelcome(buildAccess(infra, request.context).links),
  getSession: (request) => {
    const { links, platform, scoped } = buildAccess(infra, request.context);
    const context = request.context;
    return new GetSession(
      links,
      scoped?.subscriptions ?? null,
      async (id: SubscriptionId) => {
        const found = await platform.findById(id);
        return found
          ? { status: found.status.name, type: found.type.name, quota: found.quota.name }
          : null;
      },
      // The stored bytes live in the Knowledge table, which Access does not
      // read; the root is what joins them (composition-root.ts).
      async () => (context ? (await readStorageBudget(infra, context)).usedBytes : 0),
      // The face of this person inside the active subscription, and the name
      // recorded on their account: the shell draws both and neither is in the
      // token — the name it carries is the one that was true when it was
      // minted (#168).
      async () => {
        const avatar = await scoped?.avatars.find(request.profile.userId);
        if (!avatar) return null;
        return { source: avatar.source.name, picture: pictureUrlOf(avatar) };
      },
      async () => accountDirectory.nameOf(request.profile.email),
    );
  },
  switchSubscription: (request) =>
    new SwitchActiveSubscription(buildAccess(infra, request.context).links),
  listPlatformQueue: (request) =>
    new ListPlatformQueue(buildAccess(infra, request.context).platform),
  reviewSubscription: (request) =>
    new ReviewSubscription(buildAccess(infra, request.context).platform),
  listMembers: (request) => new ListMembers(scopedOrThrow(request).subscriptions),
  changeMemberRole: (request) => new ChangeMemberRole(scopedOrThrow(request).subscriptions),
  removeMember: (request) => {
    const scoped = scopedOrThrow(request);
    const context = request.context;
    return new RemoveMember(scoped.subscriptions, buildAccess(infra, context).links, {
      // The ceilings of a member live in Knowledge (RN-ACC-014, #332).
      clearFor: (user, by) =>
        context
          ? new ClearMemberCeilings(buildKnowledge(infra, context)).execute({ userId: user, by })
          : Promise.resolve(ok()),
    });
  },
  transferOwnership: (request) => {
    const scoped = scopedOrThrow(request);
    return new TransferOwnership(scoped.subscriptions, buildAccess(infra, request.context).links);
  },
  connectorOfSession: (request) =>
    new ConnectorOfSession(
      buildAccess(infra, request.context).scoped?.connectors ?? null,
      connectorClientId,
    ),
  // Knowledge, Portability and Access joined where the budget is (#197).
  subscriptionUsage: (request) => buildSubscriptionUsage(infra, request.context),
  ...shareUseCasesOf({
    shares: sharing.shares,
    notebooks: sharing.notebooks,
    accounts: accountDirectory,
    subscriptionsOf: (request) => buildAccess(infra, request.context).scoped?.subscriptions ?? null,
  }),
};

function scopedOrThrow(request: AccessRequest) {
  const { scoped } = buildAccess(infra, request.context);
  if (!scoped) {
    // Unreachable through the routes, which check first; kept as an assertion
    // that a platform session cannot build a subscription-scoped repository.
    throw new Error('This session carries no subscription');
  }
  return scoped;
}

const knowledgeUseCases: KnowledgeUseCases = {
  createNotebook: (request) => new CreateNotebook(buildKnowledge(infra, request.subscription)),
  listNotebooks: (request) => new ListNotebooks(buildKnowledge(infra, request.subscription)),
  getNotebook: (request) => new GetNotebook(buildKnowledge(infra, request.subscription)),
  renameNotebook: (request) => new RenameNotebook(buildKnowledge(infra, request.subscription)),
  // Deleting a notebook takes its shares, both sides (RN-ACC-028).
  deleteNotebook: (request) =>
    new DeleteNotebookAndShares(
      buildKnowledge(infra, request.subscription),
      request.subscription,
      sharing.shares,
      // Its model and every version go with it (#353).
      // Its catalog entry goes first (#360), then the model and every version (#353).
      async (notebookId) => {
        const models = buildModels(infra, request.subscription);
        await forgetPublication({ models, catalog, cache: catalogCache }, notebookId.value);
        await new ForgetModel(
          { models, transfers: buildTransfers(infra, request.subscription) },
          (transfer) => destroyExport(request.subscription, transfer),
        ).execute(notebookId.value);
      },
    ),
  putGuidance: (request) => new PutGuidance(buildKnowledge(infra, request.subscription)),
  deleteGuidance: (request) => new DeleteGuidance(buildKnowledge(infra, request.subscription)),
  getNotebookContext: (request) =>
    new GetNotebookContext(buildKnowledge(infra, request.subscription)),
  setNotebookLimit: (request) =>
    new SetNotebookRoleLimit(buildKnowledge(infra, request.subscription)),
  clearNotebookLimit: (request) =>
    new ClearNotebookRoleLimit(buildKnowledge(infra, request.subscription)),
  createFolder: (request) => new CreateFolder(buildKnowledge(infra, request.subscription)),
  patchFolder: (request) => new PatchFolder(buildKnowledge(infra, request.subscription)),
  reorderFolder: (request) => new ReorderFolder(buildKnowledge(infra, request.subscription)),
  removeFolder: (request) => new RemoveFolder(buildKnowledge(infra, request.subscription)),
  putTemplate: (request) => new PutTemplate(buildKnowledge(infra, request.subscription)),
  getTemplate: (request) => new GetTemplate(buildKnowledge(infra, request.subscription)),
  deleteTemplate: (request) => new DeleteTemplate(buildKnowledge(infra, request.subscription)),
  nextNumber: (request) => new NextNumber(buildKnowledge(infra, request.subscription)),
  listNotes: (request) => new ListNotes(buildKnowledge(infra, request.subscription)),
  readNote: (request) => new ReadNote(buildKnowledge(infra, request.subscription)),
  createNote: (request) => new CreateNote(buildKnowledge(infra, request.subscription)),
  updateNote: (request) => new UpdateNote(buildKnowledge(infra, request.subscription)),
  reorderNote: (request) => new ReorderNote(buildKnowledge(infra, request.subscription)),
  moveNote: (request) => new MoveNote(buildKnowledge(infra, request.subscription)),
  deleteNote: (request) => new DeleteNote(buildKnowledge(infra, request.subscription)),
  keepFile: (request) => new KeepFile(buildKnowledge(infra, request.subscription)),
  listFiles: (request) => new ListFiles(buildKnowledge(infra, request.subscription)),
  linkToFile: (request) => new LinkToFile(buildKnowledge(infra, request.subscription)),
  deleteFile: (request) => new DeleteFile(buildKnowledge(infra, request.subscription)),
  listTables: (request) => new ListTables(buildKnowledge(infra, request.subscription)),
  createTable: (request) => new CreateTable(buildKnowledge(infra, request.subscription)),
  getTable: (request) => new GetTable(buildKnowledge(infra, request.subscription)),
  alterTable: (request) => new AlterTable(buildKnowledge(infra, request.subscription)),
  deleteTable: (request) => new DeleteTable(buildKnowledge(infra, request.subscription)),
  queryTable: (request) => new QueryTable(buildKnowledge(infra, request.subscription)),
  insertRows: (request) => new InsertRows(buildKnowledge(infra, request.subscription)),
  updateRows: (request) => new UpdateRows(buildKnowledge(infra, request.subscription)),
  deleteRows: (request) => new DeleteRows(buildKnowledge(infra, request.subscription)),
  importTableRows: (request) => new ImportTableRows(buildKnowledge(infra, request.subscription)),
};

const auditUseCases: AuditUseCases = {
  noteHistory: (request) => new GetNoteHistory(buildAudit(infra, request.subscription).trail),
  notebookActivity: (request) =>
    new GetNotebookActivity(buildAudit(infra, request.subscription).trail),
  readRevision: (request) => {
    const built = buildAudit(infra, request.subscription);
    return new ReadRevision(built.trail, built.revisions);
  },
};

const discoveryUseCases: DiscoveryUseCases = {
  related: (request) => new RelatedNotes(discoveryFor(request.subscription)),
  backlinks: (request) => new Backlinks(discoveryFor(request.subscription)),
  noteLinks: (request) => new NoteLinks(discoveryFor(request.subscription)),
  resolveLinkTarget: (request) => new ResolveLinkTarget(discoveryFor(request.subscription)),
  names: (request) => new NotebookNames(discoveryFor(request.subscription)),
  attachments: (request) => new AttachmentUses(discoveryFor(request.subscription)),
  health: (request) => new NotebookHealth(discoveryFor(request.subscription)),
  graph: (request) => new NotebookGraphQuery(discoveryFor(request.subscription)),
  search: (request) => new SearchNotes(discoveryFor(request.subscription)),
  facets: (request) => new GetFacetStats(discoveryFor(request.subscription)),
};

/**
 * The export reads the notebook through Knowledge and writes the archive into the
 * same content bucket, under the subscription prefix. Nothing new is stored:
 * an export is derived, and the bucket rule expires it by tag.
 */

/** The write side of an import, over the ordinary Knowledge use cases. */
function notebookWriterFor(request: KnowledgeRequest): NotebookWriter {
  const knowledge = buildKnowledge(infra, request.subscription);
  return new KnowledgeNotebookWriter(
    {
      createNotebook: new CreateNotebook(knowledge),
      putGuidance: new PutGuidance(knowledge),
      createFolder: new CreateFolder(knowledge),
      putTemplate: new PutTemplate(knowledge),
      restoreFolderNumber: new RestoreFolderNumber(knowledge),
      createNote: new CreateNote(knowledge),
      // An archive carries the files of the notebook, and they come back
      // through the door an upload uses (#166, RN-PRT-025).
      keepFile: new KeepFile(knowledge),
      createTable: new CreateTable(knowledge),
      insertRows: new InsertRows(knowledge),
      deleteNotebook: new DeleteNotebook(knowledge),
    },
    request.ctx,
    request.subscription.subscriptionId,
    knowledge.content,
  );
}

/** What an upload in parts becomes a file with, over the Knowledge use cases (RN-PRT-027). */
function fileKeeperFor(request: KnowledgeRequest): FileKeeper {
  return new KnowledgeFileKeeper(async (notebookId) => {
    // A notebook shared with this person is kept into as its owner's (#347).
    const through =
      (await openShared(request, notebookId.value, { ...sharing, parse: notebookIdOf })) ?? request;
    const knowledge = {
      ...buildKnowledge(infra, through.subscription),
      // The parts land in this person's subscription, and become a file of
      // the notebook's (INV-01: each key still starts with its subscription).
      fileStore: new S3FileStore(
        through.subscription,
        infra.s3,
        infra.contentBucket,
        infra.filesOrigin ?? null,
        request.subscription,
      ),
    };
    return {
      useCases: {
        destination: new CheckFileDestination(knowledge),
        keep: new KeepAssembledFile(knowledge),
      },
      ctx: through.ctx,
    };
  });
}

const portabilityUseCases: PortabilityUseCases = {
  /**
   * Two writes and no work: the record and the message. Reading every note of
   * a notebook does not fit in the 29 seconds of this function (RN-PRT-019).
   */
  startExport: (request) =>
    new StartExport(
      buildTransfers(infra, request.subscription),
      new SqsTransferQueue(sqs, transferQueueUrl),
      {
        brief: async (notebookId: string) => {
          const parsed = NotebookId.create(notebookId);
          if (!parsed.ok) return null;
          const own = buildKnowledge(infra, request.subscription);
          const mine = await own.notebooks.findById(parsed.value);
          // A notebook of this subscription, or one shared with this person and
          // accepted: the export is kept here either way, and the share names
          // where the notebook is read from (RN-ACC-027).
          const share =
            mine && !mine.isDeleted
              ? null
              : await openShareOf(request.subscription.userId, parsed.value, sharing);
          if (!share && (!mine || mine.isDeleted)) return null;
          const knowledge = share ? buildKnowledge(infra, contextThrough(share)) : own;
          const notebook = share ? await knowledge.notebooks.findById(parsed.value) : mine;
          if (!notebook || notebook.isDeleted) return null;
          const notes = await knowledge.notes.listByNotebook(parsed.value);
          return {
            name: notebook.name.value,
            noteCount: notes.length,
            ...(share ? { sourceSubscriptionId: share.ownerSubscriptionId.value } : {}),
          };
        },
      },
      { current: () => readStorageBudget(infra, request.subscription) },
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  listTransfers: (request) =>
    new ListTransfers(
      buildTransfers(infra, request.subscription),
      request.subscription.userId.value,
      (transfer) =>
        new ObserveUpload(partsOf(), request.subscription.subscriptionId.value).execute(transfer),
    ),
  getTransfer: (request) =>
    new GetTransfer(buildTransfers(infra, request.subscription), request.subscription.userId.value),
  downloadTransfer: (request) =>
    new DownloadTransfer(
      buildTransfers(infra, request.subscription),
      new S3ArchiveStore(infra.s3, infra.contentBucket, infra.filesOrigin ?? null),
      request.subscription.userId.value,
    ),
  deleteTransfer: (request) =>
    new DeleteTransfer(
      buildTransfers(infra, request.subscription),
      new S3ArchiveStore(infra.s3, infra.contentBucket, infra.filesOrigin ?? null),
      request.subscription.userId.value,
      (transfer) => discardUpload(partsOf(), request.subscription.subscriptionId.value, transfer),
    ),
  cancelTransfer: (request) =>
    new CancelTransfer(
      buildTransfers(infra, request.subscription),
      request.subscription.userId.value,
    ),
  prepareImport: (request) =>
    new PrepareImport(
      new S3UploadStore(infra.s3, infra.contentBucket),
      request.subscription.subscriptionId.value,
    ),
  /** A kept export copied to an upload, inside the bucket (#207, RN-PRT-020). */
  importFromExport: (request) =>
    new ImportFromExport(
      buildTransfers(infra, request.subscription),
      new S3UploadStore(infra.s3, infra.contentBucket),
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  /** Two writes and no work, as the export: the worker writes the notebook. */
  startImport: (request) =>
    new StartImport(
      buildTransfers(infra, request.subscription),
      new SqsTransferQueue(sqs, transferQueueUrl),
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  // An upload in parts (#240, RN-PRT-027): its parts under the upload, its
  // file kept through Knowledge, its room reserved against the plan.
  beginUpload: (request) =>
    new BeginUpload(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.files,
      { current: () => readStorageBudget(infra, request.subscription) },
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  listUploads: (request) =>
    new ListUploads(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  uploadStatus: (request) =>
    new GetUploadStatus(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  putUploadPart: (request) =>
    new PutUploadPart(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  finishUpload: (request) =>
    new FinishUpload(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.files,
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  linkUpload: (request) =>
    new LinkUpload(
      buildTransfers(infra, request.subscription),
      request.files,
      request.subscription.userId.value,
    ),
  // A file the agent asks the person for (#253, RN-PRT-030).
  requestFile: (request) =>
    new RequestFile(
      buildTransfers(infra, request.subscription),
      partsOf(),
      request.files,
      request.subscription.subscriptionId.value,
      request.subscription.userId.value,
    ),
  startPrint: (request) =>
    new StartPrint(
      new SqsPrintQueue(sqs, printQueueUrl),
      request.subscription.subscriptionId.value,
    ),
  getPrint: (request) =>
    new GetPrint(
      new S3PrintStore(infra.s3, infra.contentBucket, infra.filesOrigin ?? null),
      request.subscription.subscriptionId.value,
    ),
  // How a note is drawn, for an agent to see (#260, RN-PRT-032): the renderer
  // of prints draws it, from the same queue.
  startPreview: (request) =>
    new StartPreview(
      new SqsPreviewQueue(sqs, printQueueUrl),
      new S3PreviewStore(infra.s3, infra.contentBucket),
      request.subscription.subscriptionId.value,
    ),
  getPreview: (request) =>
    new GetPreview(
      new S3PreviewStore(infra.s3, infra.contentBucket),
      request.subscription.subscriptionId.value,
    ),
  // ---- Notebook models (#353) -------------------------------------------
  declareModel: (request) => new DeclareModel(modelDependencies(request), modelCaller(request)),
  getModel: (request) => new GetModel(modelSources(request)),
  listModels: (request) =>
    new ListModels(modelDependencies(request), request.canRead, modelSources(request)),
  createModelVersion: (request) =>
    new CreateModelVersion(modelDependencies(request), modelCaller(request)),
  viewModelVersion: (request) => new ViewModelVersion(modelSources(request)),
  deleteModelVersion: (request) =>
    new DeleteModelVersion(modelDependencies(request), modelCaller(request), async (transfer) => {
      await destroyExport(request.subscription, transfer);
      // A published model lists the versions it retains (#360).
      await refreshPublication(
        { ...modelDependencies(request), catalog, cache: catalogCache },
        transfer.notebookId ?? '',
      );
    }),
  // A notebook created from a version, its parameters filled in by the
  // worker, as any import is written (#359).
  createFromVersion: (request) =>
    new CreateFromVersion(
      modelSources(request),
      modelCaller(request),
      new S3UploadStore(infra.s3, infra.contentBucket),
      portabilityUseCases.startImport(request),
    ),
  // ---- The community catalog (#360) ---------------------------------------
  publishModel: (request) =>
    new PublishModel(publicationDependencies(request), modelCaller(request)),
  withdrawModel: (request) =>
    new WithdrawModel(publicationDependencies(request), modelCaller(request)),
  publicationOf: (request) =>
    new PublicationOf({ models: buildModels(infra, request.subscription), catalog }),
  createFromCatalog: (request) =>
    new CreateFromCatalog(
      catalogReading,
      modelCaller(request),
      new S3UploadStore(infra.s3, infra.contentBucket),
      portabilityUseCases.startImport(request),
    ),
  reportModel: (request) =>
    new ReportModel(
      { ...catalogReading, reports: catalogReports },
      request.subscription.userId.value,
    ),
};

/** What publishing a model is built from, for one request (#360). */
function publicationDependencies(request: PortabilityRequest) {
  return { ...modelDependencies(request), catalog, cache: catalogCache };
}

/** What every use case of a model is built from, for one request (#353). */
function modelDependencies(request: PortabilityRequest): ModelDependencies {
  return {
    ...modelReadsOf(request.subscription),
    notebooks: ownNotebooks(request.subscription),
    queue: new SqsTransferQueue(sqs, transferQueueUrl),
    budget: { current: () => readStorageBudget(infra, request.subscription) },
  };
}

/** What reads the models of one subscription and their versions. */
function modelReadsOf(context: SubscriptionContext) {
  const uploads = new S3UploadStore(infra.s3, infra.contentBucket);
  return {
    models: buildModels(infra, context),
    transfers: buildTransfers(infra, context),
    versions: {
      read: (key: string) => readVersionDocument((at) => uploads.read(at), readZip, key),
    },
  };
}

/** Where this request reads a model from: its own subscription, or a share (#355). */
function modelSources(request: PortabilityRequest): ModelSources {
  return modelSourcesOf({
    user: request.subscription.userId,
    own: request.subscription,
    holds: async (notebookId) =>
      (await ownNotebooks(request.subscription).own(notebookId)) !== null,
    canRead: request.canRead,
    depsOf: modelReadsOf,
    sharing,
    parse: notebookIdOf,
  });
}

function modelCaller(request: PortabilityRequest): ModelCaller {
  return {
    subscriptionId: request.subscription.subscriptionId.value,
    userId: request.subscription.userId.value,
    isOwner: request.isOwner,
  };
}

/** A notebook of this subscription, never one reached through a share (#353). */
function ownNotebooks(context: SubscriptionContext): OwnNotebooks {
  return {
    own: async (notebookId) => {
      const parsed = NotebookId.create(notebookId);
      if (!parsed.ok) return null;
      const knowledge = buildKnowledge(infra, context);
      const notebook = await knowledge.notebooks.findById(parsed.value);
      if (!notebook || notebook.isDeleted) return null;
      return { name: notebook.name.value, noteCount: notebook.noteCount };
    },
  };
}

/**
 * Destroys one kept export, as its owner deleting it would: its bytes by the
 * revision the worker wrote, its record, and what it occupied (RN-PRT-020).
 */
async function destroyExport(context: SubscriptionContext, transfer: Transfer): Promise<void> {
  await new DeleteTransfer(
    buildTransfers(infra, context),
    new S3ArchiveStore(infra.s3, infra.contentBucket, infra.filesOrigin ?? null),
    transfer.userId,
  ).execute(transfer.transferId);
}

function discoveryFor(context: SubscriptionContext) {
  const built = buildDiscovery(infra, context);
  return {
    graph: built.graph,
    facets: built.facets,
    content: built.index,
    structure: built.structure,
    catalog: new KnowledgeNoteCatalog(buildKnowledge(infra, context)),
    /**
     * One line per search, in the logs of the function (ADR-012). A notebook
     * has no ceiling of notes, and this is what says when the scan stops being
     * affordable: a query over the log group finds the notebooks whose search
     * reads the most.
     */
    searchLog: {
      record: (measure: SearchMeasure) => {
        process.stdout.write(
          `${JSON.stringify({
            event: 'search',
            subscriptionId: context.subscriptionId.value,
            ...measure,
          })}
`,
        );
      },
    },
  };
}

const app = createApp({
  deployment: deploymentFromVariables(process.env),
  verifier,
  // A token of the proxy's app client is an agent's, and its line says so.
  connectorClientId,
  connectorBindings: {
    verifier,
    connectorClientId,
    signedWithIam,
    bindConnector: (context) => new BindConnector(buildConnectorBindings(infra, context)),
    rebindConnector: (context) => new RebindConnector(buildConnectorBindings(infra, context)),
  },
  notebookWriterFor,
  fileKeeperFor,
  openSharedNotebook: (request, notebookId) =>
    openShared(request, notebookId, { ...sharing, parse: notebookIdOf }),
  accessUseCases,
  knowledgeUseCases,
  auditUseCases,
  discoveryUseCases,
  portabilityUseCases,
  publicCatalog: publicCatalogUseCasesOf(catalogReading, versionDocuments),
  catalogOperator: catalogOperatorUseCasesOf({
    catalog,
    reports: catalogReports,
    cache: catalogCache,
    notifier: new SesAuthorNotifier(required('SENDER_ADDRESS')),
  }),
  nameOf: async (email) => {
    const parsed = Email.create(email);
    return parsed.ok ? accountDirectory.nameOf(parsed.value) : null;
  },
  resolveContext: async (request: AccessRequest) => {
    const context = request.context;
    if (!context) {
      return {
        ok: false as const,
        error: DomainError.forbidden('This session carries no active subscription'),
      };
    }
    const { scoped } = buildAccess(infra, context);
    if (!scoped) {
      return {
        ok: false as const,
        error: DomainError.forbidden('This session carries no active subscription'),
      };
    }
    const authorizer = new (
      await import('@memorysmithapp/svc-access/application/context')
    ).ResolveRequestContext(scoped.subscriptions);
    const resolved = await authorizer.execute(context);
    if (!resolved.ok) return { ok: false as const, error: resolved.error };

    const knowledgeRequest: KnowledgeRequest = {
      ctx: resolved.value,
      subscription: context,
      // The person, and the connector the proxy bound this token to when the
      // token is the proxy's (INV-07, RN-AGT-001).
      authorship: await new ResolveAuthorship(scoped.connectors, connectorClientId).execute({
        user: context.userId,
        credential: request.credential,
      }),
      subscriptionRole: roleOf(resolved.value),
    };
    return { ok: true as const, value: knowledgeRequest };
  },
  canReadNotebook: async (request, notebookId) => {
    const parsed = NotebookId.create(notebookId);
    if (!parsed.ok) return false;
    const notebook = await buildKnowledge(infra, request.subscription).notebooks.findById(
      parsed.value,
    );
    // A deleted notebook is unreadable to every context, not only to Knowledge:
    // Discovery and Portability ask this question, and both must get a no.
    if (!notebook || notebook.isDeleted) return false;
    return request.ctx.isOwner || request.subscriptionRole.canRead();
  },
  /**
   * The same chain the note use cases of Knowledge walk before answering, and
   * the one the trail has no way of walking: a removed folder rewrites nothing
   * under it, so the item of the note is still there, still pointing at its
   * content, until the purge takes it. Whether it is reachable is what the tree
   * says (RN-KNW-046).
   */
  notebookHoldsNote: async (request, notebookId, noteId) => {
    const parsedNotebook = NotebookId.create(notebookId);
    const parsedNote = NoteId.create(noteId);
    if (!parsedNotebook.ok || !parsedNote.ok) return false;

    const knowledge = buildKnowledge(infra, request.subscription);
    const [notebook, note] = await Promise.all([
      knowledge.notebooks.findById(parsedNotebook.value),
      knowledge.notes.findById(parsedNotebook.value, parsedNote.value),
    ]);
    if (!notebook || notebook.isDeleted || !note || note.isDeleted) return false;
    return notebook.folders.has(note.folderId);
  },
});

export const handler = handle(app);
