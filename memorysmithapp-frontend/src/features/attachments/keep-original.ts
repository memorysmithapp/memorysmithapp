import { bytesSupport, fileTypeOf, type NotebookFileDto } from '@memorysmithapp/contracts';
import { ATTACH_MAX_BYTES, attachFile, type AttachPhase, type AttachPorts } from '../note/attach';

/**
 * The person's original kept in the place of the copy a notebook holds (#466,
 * RN-KNW-091), once they answered yes to the question the check ends with.
 *
 * A file has no update: new bytes under the same name are a new file kept
 * after the old one was let go. So this is the two things the product already
 * does, in the one order that leaves the least to chance:
 *
 *  1. everything the API would refuse after the copy is gone is asked first,
 *     here, by the same checks it runs — the type is on the list, the bytes
 *     support it, the size fits (RN-KNW-075, RN-KNW-055);
 *  2. the copy is let go (INV-08) only at the moment the upload is declared,
 *     because a name is free to declare only once nothing holds it;
 *  3. the original goes through the editor's own checked upload, under the
 *     same name, description, tags and path, and the finish keeps it only when
 *     the whole hashes to what the check computed.
 *
 * Both steps are the person's, and enter the trail as any other. An upload the
 * connection dropped is left open and resumed by the next attempt, which finds
 * it by the hash of the file and the name it keeps (RN-KNW-055).
 */

export interface KeepOriginalPorts {
  readonly attach: AttachPorts;
  /** Lets the kept copy go. */
  remove(): Promise<void>;
  /** The files of the notebook, read again to check what was kept. */
  list(): Promise<NotebookFileDto[]>;
}

/** Why the original was not sent, before anything changed. */
export class OriginalRefusal extends Error {
  constructor(readonly reason: 'EMPTY' | 'TOO_LARGE' | 'TYPE_NOT_KEPT' | 'TYPE_CONTRADICTED') {
    super(reason);
  }
}

export type KeepOriginalPhase = AttachPhase | { phase: 'letting-go' };

/** What the notebook holds under the name once the original was sent. */
export interface KeptOriginal {
  readonly file: NotebookFileDto | null;
  /** The file now kept has the size and SHA-256 of the person's. */
  readonly identical: boolean;
}

/** A thing that is not there, which a delete repeated after a dropped attempt meets. */
const isGone = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === 'NOT_FOUND';

export async function keepOriginal(
  ports: KeepOriginalPorts,
  input: {
    notebookId: string;
    /** The file the notebook keeps, whose place the original takes. */
    kept: NotebookFileDto;
    /** The person's file. */
    file: File;
    /** Its SHA-256, which the check already computed. */
    sha256: string;
    purpose: string;
  },
  phase: (now: KeepOriginalPhase) => void = () => undefined,
): Promise<KeptOriginal> {
  const { file, kept, sha256 } = input;
  if (file.size === 0) throw new OriginalRefusal('EMPTY');
  if (file.size > ATTACH_MAX_BYTES) throw new OriginalRefusal('TOO_LARGE');
  // The type the person's system gives the file, or the copy's when it gives none.
  const declared = file.type ? fileTypeOf(file.type) : fileTypeOf(kept.mimeType);
  if (!declared) throw new OriginalRefusal('TYPE_NOT_KEPT');
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (!bytesSupport(declared.mimeType, head)) throw new OriginalRefusal('TYPE_CONTRADICTED');

  const name = kept.name.normalize('NFC');
  const replacing: AttachPorts = {
    ...ports.attach,
    // The check hashed this very file a moment ago.
    hash: (_file, progress) => {
      progress(file.size, file.size);
      return Promise.resolve(sha256);
    },
    // Only an upload of this file under this name is the one to resume.
    open: async () =>
      (await ports.attach.open()).filter(
        (transfer) => (transfer.fileName ?? '').normalize('NFC') === name,
      ),
    begin: async (request) => {
      phase({ phase: 'letting-go' });
      try {
        await ports.remove();
      } catch (error) {
        // Let go by an attempt the connection dropped: nothing holds the name.
        if (!isGone(error)) throw error;
      }
      return ports.attach.begin(request);
    },
  };

  await attachFile(
    replacing,
    {
      notebookId: input.notebookId,
      file: new File([file], kept.name, { type: declared.mimeType }),
      name: kept.name,
      description: kept.description,
      tags: kept.tags,
      path: kept.path,
      purpose: input.purpose,
    },
    undefined,
    phase,
  );

  const now = (await ports.list()).find((each) => each.name.normalize('NFC') === name) ?? null;
  return {
    file: now,
    identical: now !== null && now.bytes === file.size && now.sha256 === sha256,
  };
}
