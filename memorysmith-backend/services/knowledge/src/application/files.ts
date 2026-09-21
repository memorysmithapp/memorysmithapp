/**
 * The files a notebook keeps beside its notes (#166).
 *
 * Three use cases and no fourth: a file is **kept**, **listed** and **deleted**.
 * There is no update, because there is nothing to update — new bytes under the
 * same name are a new file kept after the old one was let go, and a rename is
 * the same thing said differently. That keeps a file honest about what it is:
 * a name, a type and bytes that were put there once.
 *
 * Two rules run before a byte is stored, in this order, because each one
 * refuses cheaper than the next:
 *
 *  1. **The type is on the list** (RN-KNW-050) and **the bytes support it**.
 *     The second half is what makes the first mean anything: a document
 *     arriving under the type of a picture is refused here, naming both.
 *  2. **There is room** (RN-SUB-021). A file is current content of the
 *     subscription like a note is, and an upload with no room is refused
 *     before the work rather than after it.
 *
 * The name is guarded by the repository and not here, for the reason a note
 * name is: two uploads of one name arriving together would both find it free.
 */

import {
  type Authorship,
  DomainError,
  err,
  FileId,
  Instant,
  ok,
  type NotebookId,
  type Result,
} from '@memorysmith/kernel';
import type { RequestContext } from '../domain/access/AuthorizationPolicy.js';
import { NotebookFile } from '../domain/file/NotebookFile.js';
import type { FileRepository, FileStore, FileTypes, SignedFile } from '../domain/ports/index.js';
import { loadAuthorized, type NotebookDependencies } from './notebooks.js';
import { admitWrite } from '../domain/services/StorageQuota.js';

export interface FileDependencies extends NotebookDependencies {
  readonly files: FileRepository;
  readonly fileStore: FileStore;
  /** The list of what may be kept, injected by the composition root. */
  readonly fileTypes: FileTypes;
}

/**
 * What the connector may hand over inline, base64 (#166).
 *
 * An agent that must perform an HTTP PUT of its own is an agent that cannot
 * keep a file at all, so the bytes travel in the call — and a call is not a
 * place to move a film through. Above this the answer says what the ceiling is
 * and nothing is stored: a truncated file is worse than a refusal, because it
 * looks like a file.
 *
 * **The number is the transport, and it is stated rather than wished** (#172).
 * It was 8 MB, and 8 MB was unreachable: the request carrying the bytes is a
 * synchronous invocation, which stops at 6 MB, and base64 costs a third on top
 * of the file. So everything between 4.4 MB and 8 MB died in front of this
 * code, with a `413` from the platform that names no ceiling and no unit —
 * while the product believed it was accepting those files. 4 MiB encodes to
 * 5.33 MiB and leaves the envelope room to spare, which is why it is the
 * number here: a limit nobody can hit is not a limit, it is a promise.
 *
 * Whoever wants to keep more than this wants the bytes out of the request,
 * the way an import already takes them — a short-lived upload URL, followed
 * by a PUT — and that is a surface for a person rather than for an agent,
 * because an agent filling `contentBase64` pays for every byte twice.
 */
export const MAX_INLINE_BYTES = 4 * 1024 * 1024;

export class KeepFile {
  constructor(private readonly deps: FileDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    bytes: Uint8Array;
    by: Authorship;
  }): Promise<Result<NotebookFile, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const type = this.deps.fileTypes.canonical(input.mimeType);
    if (!type) {
      return err(
        DomainError.validation(
          `This notebook keeps ${this.deps.fileTypes.accepted.join(', ')}, and nothing else`,
        ),
      );
    }
    if (input.bytes.byteLength === 0) {
      return err(DomainError.validation('A file with no bytes is not a file'));
    }
    if (input.bytes.byteLength > MAX_INLINE_BYTES) {
      return err(
        DomainError.limitExceeded(
          `A file kept through this door goes up to ${MAX_INLINE_BYTES / (1024 * 1024)} MB`,
        ),
      );
    }
    if (!this.deps.fileTypes.supports(type, input.bytes)) {
      return err(
        DomainError.validation(
          `These bytes are not ${type}: what is served is the type that was declared, so a type the bytes contradict is refused`,
        ),
      );
    }

    const admitted = admitWrite(await this.deps.storage.current(), input.bytes.byteLength);
    if (!admitted.ok) return admitted;

    // The name is checked here to answer well, and guarded in the write to
    // answer correctly: this read is a courtesy and the condition is the rule.
    const held = await this.deps.files.findByName(
      input.notebookId,
      input.name.normalize('NFC').trim(),
    );
    if (held) {
      return err(
        DomainError.conflict(
          `This notebook already keeps a file called "${held.name}"`,
          held.id.value,
        ),
      );
    }

    // Bytes first, pointer second (section 10.5): a pointer to nothing is the
    // one state this order cannot produce.
    const ref = await this.deps.fileStore.put(input.bytes, type);

    const file = NotebookFile.create({
      id: FileId.generate(),
      subscriptionId: notebook.value.subscriptionId,
      notebookId: input.notebookId,
      name: input.name,
      description: input.description,
      mimeType: type,
      tags: input.tags,
      path: input.path,
      contentRef: ref,
      by: input.by,
    });
    if (!file.ok) return file;

    const saved = await this.deps.files.save(file.value);
    if (!saved.ok) return saved;
    return ok(file.value);
  }
}

export class ListFiles {
  constructor(private readonly deps: FileDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
  }): Promise<Result<NotebookFile[], DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;
    return ok(await this.deps.files.list(input.notebookId));
  }
}

/**
 * A link a browser follows on its own, which is what an `<img>` needs and what
 * a download is. It points at the object store and not at the API, so a file
 * somebody uploaded is served from an origin that is not the one the product
 * runs in (#166).
 */
export class LinkToFile {
  constructor(private readonly deps: FileDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    fileId: FileId;
  }): Promise<Result<SignedFile, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'read');
    if (!notebook.ok) return notebook;

    const file = await this.deps.files.findById(input.notebookId, input.fileId);
    if (!file) return err(DomainError.notFound('File not found'));
    return ok(await this.deps.fileStore.signedUrl(file.contentRef, file.name, file.mimeType));
  }
}

export class DeleteFile {
  constructor(private readonly deps: FileDependencies) {}

  async execute(input: {
    ctx: RequestContext;
    notebookId: NotebookId;
    fileId: FileId;
    by: Authorship;
  }): Promise<Result<void, DomainError>> {
    const notebook = await loadAuthorized(this.deps, input.ctx, input.notebookId, 'write');
    if (!notebook.ok) return notebook;

    const file = await this.deps.files.findById(input.notebookId, input.fileId);
    if (!file) return err(DomainError.notFound('File not found'));

    // Definitive, and the bytes go with it: the purge destroys what this
    // invalidated, and every note that referenced the name renders pending
    // from this instant (rule 8, RN-KNW-051).
    const deleted = file.delete(input.by, Instant.now());
    if (!deleted.ok) return deleted;
    return this.deps.files.save(file);
  }
}
