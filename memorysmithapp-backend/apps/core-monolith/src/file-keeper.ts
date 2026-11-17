/**
 * The file an upload in parts becomes (#240, RN-PRT-027), over the ordinary
 * Knowledge use cases. Portability may not import Knowledge, so the port it
 * declares is filled here, per request, as the writer of an import is.
 *
 * The notebook is reached as any Knowledge route reaches it: of this
 * subscription, or through a share this person accepted, whose profile decides
 * whether they may keep a file there (#347). Each step resolves it again, so a
 * share reduced or revoked between two steps refuses the next one.
 */

import { DomainError, NotebookId, ok, type Authorship, type Result } from '@memorysmithapp/kernel';
import type { RequestContext } from '@memorysmithapp/svc-knowledge/domain';
import {
  CheckFileDestination,
  KeepAssembledFile,
} from '@memorysmithapp/svc-knowledge/application/files';
import { S3FileStore } from '@memorysmithapp/svc-knowledge/adapters/file-store';
import type { KnowledgeRequest } from '@memorysmithapp/svc-knowledge/adapters/http';
import type { FileKeeper } from '@memorysmithapp/svc-portability/application/uploads';
import { buildKnowledge, type buildShares, type Infrastructure } from './composition-root.js';
import { openShared } from './shares.js';

/** The use cases and the context a notebook is reached with, for one step of an upload. */
export interface FileKeeperReach {
  readonly useCases: { destination: CheckFileDestination; keep: KeepAssembledFile };
  readonly ctx: RequestContext;
}

export class KnowledgeFileKeeper implements FileKeeper {
  constructor(private readonly reach: (notebookId: NotebookId) => Promise<FileKeeperReach>) {}

  async destination(input: {
    notebookId: string;
    name: string;
    mimeType: string;
  }): Promise<Result<{ notebookName: string; mimeType: string }, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    // An identifier that is not one names nothing this caller may see (INV-09).
    if (!notebookId.ok) return { ok: false, error: DomainError.notFound('Notebook not found') };
    const { useCases, ctx } = await this.reach(notebookId.value);
    return useCases.destination.execute({
      ctx,
      notebookId: notebookId.value,
      name: input.name,
      mimeType: input.mimeType,
    });
  }

  async keepAssembled(input: {
    notebookId: string;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    assembled: { key: string; versionId: string; size: number; sha256: string };
    by: Authorship;
  }): Promise<Result<{ fileId: string; name: string; bytes: number }, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    if (!notebookId.ok) return { ok: false, error: DomainError.notFound('Notebook not found') };
    const { useCases, ctx } = await this.reach(notebookId.value);
    const kept = await useCases.keep.execute({
      ...input,
      ctx,
      notebookId: notebookId.value,
    });
    if (!kept.ok) return kept;
    return ok({
      fileId: kept.value.id.value,
      name: kept.value.name,
      bytes: kept.value.contentRef.bytes,
    });
  }
}

function notebookIdOf(raw: string): NotebookId | null {
  const parsed = NotebookId.create(raw);
  return parsed.ok ? parsed.value : null;
}

/**
 * What an upload in parts becomes a file with, over the Knowledge use cases
 * (RN-PRT-027), for the API and for the transfer worker that finishes an
 * upload (#480) alike.
 */
export function fileKeeperFor(
  infra: Infrastructure,
  sharing: ReturnType<typeof buildShares>,
  request: KnowledgeRequest,
): FileKeeper {
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
