/**
 * A file a notebook keeps beside its notes (#166, RN-KNW-048).
 *
 * It is an Aggregate Root of its own, for the reason a note is: nothing about
 * a file is a transactional invariant of the tree, and loading a notebook to
 * keep a picture in it would put every upload in a queue behind every other
 * write of that notebook.
 *
 * **The name addresses and the path organises.** A note reaches a file with
 * `![[name]]` wherever it sits, so moving one between paths never breaks a
 * note — the path plays no part in identity, exactly as it plays none for a
 * note (RN-DSC-041). A notebook holds one file of each name (RN-KNW-049),
 * which the repository guards, because an EMBED cannot offer a choice the way
 * a link can: it expands one thing or nothing.
 *
 * **The extension decides nothing and the type decides everything.** The name
 * may end in `.png`, may end in `.txt` over a picture, may end in nothing at
 * all; what the product stores, serves and draws by is the type it was given.
 *
 * Which types exist and whether the bytes support the one declared is not
 * decided here: it is a list the product publishes and the composition root
 * injects (`FileTypes`), checked by the use case before a byte is stored
 * (RN-KNW-050). The aggregate never sees bytes, and the domain of a context
 * imports the kernel and nothing else.
 */

import {
  type Authorship,
  type FileId,
  type ContentRef,
  createEvent,
  DomainError,
  err,
  type Instant,
  ok,
  type SubscriptionId,
  type NotebookId,
  type DomainEvent,
  type Result,
} from '@memorysmith/kernel';
import { filePath, fileTags } from '../values.js';

const MAX_NAME = 512;
const MAX_DESCRIPTION = 500;

/** The four delimiters of the form that addresses it (SPEC.md §5.3). */
const UNADDRESSABLE = /[#[\]|]/;

export class NotebookFile {
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: FileId,
    readonly subscriptionId: SubscriptionId,
    readonly notebookId: NotebookId,
    private _name: string,
    private _description: string,
    readonly mimeType: string,
    private _tags: readonly string[],
    private _path: string,
    private _contentRef: ContentRef,
    readonly createdBy: Authorship,
    private _updatedBy: Authorship,
    private _deletedAt: Instant | null,
    private _version: number,
  ) {}

  static create(input: {
    id: FileId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    contentRef: ContentRef;
    by: Authorship;
  }): Result<NotebookFile, DomainError> {
    const name = input.name.normalize('NFC').trim();
    if (name.length === 0) return err(DomainError.validation('A file needs a name'));
    if (name.length > MAX_NAME)
      return err(DomainError.validation(`A name of a file goes up to ${MAX_NAME} characters`));
    if (UNADDRESSABLE.test(name)) {
      return err(
        DomainError.validation(
          'A name carrying #, [, ] or | cannot be addressed by a link, and a file exists to be addressed',
        ),
      );
    }
    if (input.description.length > MAX_DESCRIPTION) {
      return err(DomainError.validation(`A description goes up to ${MAX_DESCRIPTION} characters`));
    }
    const tags = fileTags(input.tags);
    if (!tags.ok) return tags;
    const path = filePath(input.path);
    if (!path.ok) return path;

    const file = new NotebookFile(
      input.id,
      input.subscriptionId,
      input.notebookId,
      name,
      input.description.trim(),
      input.mimeType.trim().toLowerCase(),
      tags.value,
      path.value,
      input.contentRef,
      input.by,
      input.by,
      null,
      0,
    );
    file.record('FileKept', input.by, input.contentRef, input.contentRef.bytes);
    return ok(file);
  }

  /** What the repository rebuilds from the item, with no rule re-run. */
  static rehydrate(input: {
    id: FileId;
    subscriptionId: SubscriptionId;
    notebookId: NotebookId;
    name: string;
    description: string;
    mimeType: string;
    tags: readonly string[];
    path: string;
    contentRef: ContentRef;
    createdBy: Authorship;
    updatedBy: Authorship;
    deletedAt: Instant | null;
    version: number;
  }): NotebookFile {
    return new NotebookFile(
      input.id,
      input.subscriptionId,
      input.notebookId,
      input.name,
      input.description,
      input.mimeType,
      input.tags,
      input.path,
      input.contentRef,
      input.createdBy,
      input.updatedBy,
      input.deletedAt,
      input.version,
    );
  }

  get name(): string {
    return this._name;
  }
  get description(): string {
    return this._description;
  }
  get tags(): readonly string[] {
    return this._tags;
  }
  get path(): string {
    return this._path;
  }
  get contentRef(): ContentRef {
    return this._contentRef;
  }
  get updatedBy(): Authorship {
    return this._updatedBy;
  }
  get deletedAt(): Instant | null {
    return this._deletedAt;
  }
  get version(): number {
    return this._version;
  }
  get isDeleted(): boolean {
    return this._deletedAt !== null;
  }

  /**
   * Deleting is definitive and the bytes go with it (rule 8, RN-KNW-051): the
   * purge destroys what this invalidated, and every note that referenced the
   * name renders pending from this instant.
   */
  delete(by: Authorship, at: Instant): Result<void, DomainError> {
    if (this.isDeleted) return err(DomainError.notFound('File not found'));
    this._deletedAt = at;
    this._updatedBy = by;
    this.record('FileDeleted', by, this._contentRef, -this._contentRef.bytes);
    return ok(undefined);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /** The version the repository writes under, which the caller never sets. */
  nextVersion(): number {
    return this._version + 1;
  }

  private record(
    type: Parameters<typeof createEvent>[0]['type'],
    by: Authorship,
    ref: ContentRef,
    bytesDelta: number,
  ): void {
    this.events.push(
      createEvent({
        type,
        subscriptionId: this.subscriptionId,
        subject: 'FILE',
        subjectId: this.id.value,
        authorship: by,
        payload: {
          notebookId: this.notebookId.value,
          fileId: this.id.value,
          name: this._name,
          mimeType: this.mimeType,
          path: this._path,
        },
        contentRef: ref,
        storageDelta: bytesDelta,
      }),
    );
  }
}
