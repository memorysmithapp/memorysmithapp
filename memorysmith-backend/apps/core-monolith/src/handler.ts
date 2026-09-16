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
import { deploymentFromVariables } from '@memorysmith/contracts';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import {
  DomainError,
  NotebookId,
  type SubscriptionContext,
  type SubscriptionId,
} from '@memorysmith/kernel';
import { CognitoTokenVerifier } from '@memorysmith/svc-access/adapters/auth';
import type { AccessRequest, AccessUseCases } from '@memorysmith/svc-access/adapters/http';
import {
  GetSession,
  RequestSubscription,
  SwitchActiveSubscription,
} from '@memorysmith/svc-access/application/onboarding';
import { ChooseLanguage } from '@memorysmith/svc-access/application/account';
import { CognitoAccountDirectory } from '@memorysmith/svc-access/adapters/cognito';
import {
  ListPlatformQueue,
  ReviewSubscription,
} from '@memorysmith/svc-access/application/platform';
import {
  BindConnector,
  ConnectorOfSession,
  RebindConnector,
  ResolveAuthorship,
} from '@memorysmith/svc-access/application/connectors';
import {
  ChangeMemberRole,
  ListMembers,
  RemoveMember,
  TransferOwnership,
} from '@memorysmith/svc-access/application/members';
import type { KnowledgeRequest, KnowledgeUseCases } from '@memorysmith/svc-knowledge/adapters/http';
import {
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
} from '@memorysmith/svc-knowledge/application/notebooks';
import {
  CreateFolder,
  DeleteTemplate,
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
import type { AuditUseCases } from '@memorysmith/svc-audit/adapters/http';
import {
  GetNoteHistory,
  GetNotebookActivity,
  ReadRevision,
} from '@memorysmith/svc-audit/application';
import type { DiscoveryUseCases } from '@memorysmith/svc-discovery/adapters/http';
import type { SearchMeasure } from '@memorysmith/svc-discovery/domain';
import {
  Backlinks,
  NoteLinks,
  ResolveLinkTarget,
  GetFacetStats,
  RelatedNotes,
  SearchNotes,
  NotebookGraphQuery,
  NotebookHealth,
} from '@memorysmith/svc-discovery/application/queries';
import type { PortabilityUseCases } from '@memorysmith/svc-portability/adapters/http';
import { ExportNotebook } from '@memorysmith/svc-portability/application';
import { createZip, readZip } from '@memorysmith/svc-portability/adapters/zip';
import {
  ImportNotebook,
  PrepareImport,
  type NotebookWriter,
} from '@memorysmith/svc-portability/application/import';
import { KnowledgeNotebookWriter } from './import-writer.js';
import { parseNotebookDocument } from './composition-root.js';
import { S3ArchiveStore, S3UploadStore } from '@memorysmith/svc-portability/adapters/s3';
import { createApp } from './app.js';
import {
  buildAccess,
  buildConnectorBindings,
  buildAudit,
  buildDiscovery,
  buildKnowledge,
  readStorageBudget,
  roleOf,
  type Infrastructure,
} from './composition-root.js';
import { KnowledgeNoteCatalog } from './note-catalog.js';
import { KnowledgeExportSource } from './export-source.js';
import { serializeNotebookDocument } from './composition-root.js';

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
  contentBucket: required('CONTENT_BUCKET'),
};

const verifier = new CognitoTokenVerifier(required('COGNITO_ISSUER'));

/** The app client of the connector proxy, whose tokens write as a connector. */
const connectorClientId = required('CONNECTOR_CLIENT_ID');

/**
 * Whether API Gateway authorized this request with IAM. Only a route behind the
 * IAM authorizer carries `authorizer.iam`, and only a principal allowed to
 * invoke that route gets through to carry one (section 14.1).
 */
function signedWithIam(c: Context): boolean {
  const env = c.env as
    { event?: { requestContext?: { authorizer?: { iam?: unknown } } } } | undefined;
  return Boolean(env?.event?.requestContext?.authorizer?.iam);
}

/** Where the language of an account is recorded: on the account, in the pool (RN-ACC-018). */
const accountDirectory = new CognitoAccountDirectory(required('USER_POOL_ID'));

/** The Access use cases, each built from the subscription of this request. */
const accessUseCases: AccessUseCases = {
  requestSubscription: (request) => {
    const { onboarding, links } = buildAccess(infra, request.context);
    return new RequestSubscription(onboarding, links);
  },
  chooseLanguage: () => new ChooseLanguage(accountDirectory),
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
    return new RemoveMember(scoped.subscriptions, buildAccess(infra, request.context).links);
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
  deleteNotebook: (request) => new DeleteNotebook(buildKnowledge(infra, request.subscription)),
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
  listNotes: (request) => new ListNotes(buildKnowledge(infra, request.subscription)),
  readNote: (request) => new ReadNote(buildKnowledge(infra, request.subscription)),
  createNote: (request) => new CreateNote(buildKnowledge(infra, request.subscription)),
  updateNote: (request) => new UpdateNote(buildKnowledge(infra, request.subscription)),
  reorderNote: (request) => new ReorderNote(buildKnowledge(infra, request.subscription)),
  moveNote: (request) => new MoveNote(buildKnowledge(infra, request.subscription)),
  deleteNote: (request) => new DeleteNote(buildKnowledge(infra, request.subscription)),
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
      createNote: new CreateNote(knowledge),
      deleteNotebook: new DeleteNotebook(knowledge),
    },
    request.ctx,
    request.subscription.subscriptionId,
  );
}

const portabilityUseCases: PortabilityUseCases = {
  exportNotebook: (request) =>
    new ExportNotebook(
      new KnowledgeExportSource(buildKnowledge(infra, request.subscription)),
      new S3ArchiveStore(infra.s3, infra.contentBucket),
      createZip,
      request.subscription.subscriptionId.value,
      serializeNotebookDocument,
    ),
  prepareImport: (request) =>
    new PrepareImport(
      new S3UploadStore(infra.s3, infra.contentBucket),
      request.subscription.subscriptionId.value,
    ),
  importNotebook: (request) =>
    new ImportNotebook(
      new S3UploadStore(infra.s3, infra.contentBucket),
      request.write,
      readZip,
      parseNotebookDocument,
      request.subscription.subscriptionId.value,
    ),
};

function discoveryFor(context: SubscriptionContext) {
  const built = buildDiscovery(infra, context);
  return {
    graph: built.graph,
    facets: built.facets,
    content: built.index,
    structure: built.structure,
    catalog: new KnowledgeNoteCatalog(buildKnowledge(infra, context)),
    /**
     * One line per search, in the logs of the function (RN-DSC-027). A notebook
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
  connectorBindings: {
    verifier,
    connectorClientId,
    signedWithIam,
    bindConnector: (context) => new BindConnector(buildConnectorBindings(infra, context)),
    rebindConnector: (context) => new RebindConnector(buildConnectorBindings(infra, context)),
  },
  notebookWriterFor,
  accessUseCases,
  knowledgeUseCases,
  auditUseCases,
  discoveryUseCases,
  portabilityUseCases,
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
      await import('@memorysmith/svc-access/application/context')
    ).ResolveRequestContext(scoped.subscriptions);
    const resolved = await authorizer.execute(context);
    if (!resolved.ok) return { ok: false as const, error: resolved.error };

    const knowledgeRequest: KnowledgeRequest = {
      ctx: resolved.value,
      subscription: context,
      // The person, and the connector the proxy bound this token to when the
      // token is the proxy's (RN-AGT-001, section 12.1).
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
});

export const handler = handle(app);
