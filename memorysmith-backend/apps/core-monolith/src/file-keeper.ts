/**
 * The file an upload in parts becomes (#240, RN-PRT-027), over the ordinary
 * Knowledge use cases. Portability may not import Knowledge, so the port it
 * declares is filled here, per request, as the writer of an import is.
 */

import { DomainError, NotebookId, ok, type Authorship, type Result } from '@memorysmith/kernel';
import type { RequestContext } from '@memorysmith/svc-knowledge/domain';
import type {
  CheckFileDestination,
  KeepAssembledFile,
} from '@memorysmith/svc-knowledge/application/files';
import type { FileKeeper } from '@memorysmith/svc-portability/application/uploads';

export class KnowledgeFileKeeper implements FileKeeper {
  constructor(
    private readonly useCases: { destination: CheckFileDestination; keep: KeepAssembledFile },
    private readonly ctx: RequestContext,
  ) {}

  async destination(input: {
    notebookId: string;
    name: string;
    mimeType: string;
  }): Promise<Result<{ notebookName: string; mimeType: string }, DomainError>> {
    const notebookId = NotebookId.create(input.notebookId);
    // An identifier that is not one names nothing this caller may see (rule 9).
    if (!notebookId.ok) return { ok: false, error: DomainError.notFound('Notebook not found') };
    return this.useCases.destination.execute({
      ctx: this.ctx,
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
    const kept = await this.useCases.keep.execute({
      ...input,
      ctx: this.ctx,
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
