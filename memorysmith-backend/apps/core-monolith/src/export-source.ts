/**
 * What the Knowledge context hands over for an export. It lives HERE, in the
 * composition root, for the same reason the note catalogue does: the notebook and
 * its notes belong to Knowledge, and having Portability query them directly
 * would invert the one-way arrow between the contexts (architecture-guide.md,
 * section 3.1).
 *
 * Deleted notes never reach here: `listByNotebook` already leaves them out, which
 * is what RN-PRT-006 asks for.
 */

import { NotebookId } from '@memorysmith/kernel';
import type {
  ContentSlotRepository,
  ContentStore,
  FileRepository,
  FileStore,
  FolderNumbers,
  NoteRepository,
  NotebookRepository,
} from '@memorysmith/svc-knowledge/domain';
import type { ExportSource } from '@memorysmith/svc-portability/application';
import type { ExportInput } from '@memorysmith/svc-portability/domain';

/**
 * How many blobs are read from the object store at once. One at a time makes
 * a six-hundred-note notebook take longer than the request is allowed to live;
 * all at once opens six hundred sockets and gets throttled. This is the middle.
 */
const READ_CONCURRENCY = 24;

async function mapWithConcurrency<T, U>(
  items: T[],
  limit: number,
  map: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array<U>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await map(items[index] as T);
    }
  });

  await Promise.all(workers);
  return results;
}

interface KnowledgeSide {
  readonly notebooks: NotebookRepository;
  readonly notes: NoteRepository;
  /** The Guidance and the Templates, each an aggregate of its own. */
  readonly slots: ContentSlotRepository;
  readonly content: ContentStore;
  /** The last number each folder issued, which the export carries (RN-PRT-016). */
  readonly numbers: FolderNumbers;
  /** The files the notebook keeps, which travel with it (RN-PRT-025). */
  readonly files: FileRepository;
  readonly fileStore: FileStore;
}

export class KnowledgeExportSource implements ExportSource {
  constructor(private readonly knowledge: KnowledgeSide) {}

  async load(notebookId: string): Promise<ExportInput | null> {
    const parsed = NotebookId.create(notebookId);
    if (!parsed.ok) return null;

    const notebook = await this.knowledge.notebooks.findById(parsed.value);
    // A notebook of another subscription never even reaches here: the key the
    // repository builds carries the subscription of the token (RN-SUB-004).
    if (!notebook) return null;

    const folders = notebook.folders.all();
    const notes = await this.knowledge.notes.listByNotebook(parsed.value);

    // Every Template of the notebook in one Query, rather than one read per
    // folder: they live in the same partition (RN-KNW-044).
    const templateOf = new Map(
      (await this.knowledge.slots.listTemplates(parsed.value)).map((template) => [
        template.folderId.value,
        template.ref,
      ]),
    );
    const guidanceSlot = await this.knowledge.slots.findGuidance(parsed.value);
    const lastNumbers = await this.knowledge.numbers.lastIssued(parsed.value);
    const kept = await this.knowledge.files.list(parsed.value);

    const [guidance, templates, bodies, fileBytes] = await Promise.all([
      guidanceSlot ? this.knowledge.content.read(guidanceSlot.ref) : Promise.resolve(null),
      mapWithConcurrency(folders, READ_CONCURRENCY, async (folder) => {
        const ref = templateOf.get(folder.id.value);
        return ref ? this.knowledge.content.read(ref) : null;
      }),
      mapWithConcurrency(notes, READ_CONCURRENCY, (note) =>
        this.knowledge.content.read(note.bodyRef),
      ),
      // The bytes themselves, because an archive whose pictures live somewhere
      // else is not an archive (RN-PRT-025).
      mapWithConcurrency(kept, READ_CONCURRENCY, (file) =>
        this.knowledge.fileStore.read(file.contentRef),
      ),
    ]);

    return {
      notebookName: notebook.name.value,
      notebookDescription: notebook.description.value,
      guidance,
      folders: folders.map((folder, index) => ({
        folderId: folder.id.value,
        parentFolderId: folder.parentFolderId?.value ?? null,
        name: folder.name.value,
        description: folder.description.value,
        position: folder.position.value,
        templateContent: templates[index] ?? null,
        ...(lastNumbers.get(folder.id.value)
          ? { lastNumber: lastNumbers.get(folder.id.value) as number }
          : {}),
      })),
      // Nothing derived travels: no name and no slug, because the name is
      // read from the body wherever it is needed (RN-PRT-010).
      notes: notes.map((note, index) => ({
        noteId: note.id.value,
        folderId: note.folderId.value,
        position: note.position.value,
        createdAt: note.createdBy.at.toISOString(),
        updatedAt: note.updatedBy.at.toISOString(),
        content: bodies[index] ?? '',
      })),
      /**
       * The files, with no identifier of their own: an import mints one, and
       * nothing addresses a file by id. A note reaches one by NAME, which is
       * what makes the `![[name]]` of an imported note find its picture.
       */
      files: kept.map((file, index) => ({
        name: file.name,
        description: file.description,
        mimeType: file.mimeType,
        tags: [...file.tags],
        path: file.path,
        bytes: Buffer.from(fileBytes[index] ?? new Uint8Array()).toString('base64'),
      })),
    };
  }
}
