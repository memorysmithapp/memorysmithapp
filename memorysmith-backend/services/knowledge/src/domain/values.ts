/**
 * Value objects of the Knowledge context. All immutable, self-validating in
 * the constructor and compared by value. No raw string crosses the boundary of
 * the domain (architecture-guide.md, section 6.5).
 */

import { DomainError, err, ok, type Result } from '@memorysmith/kernel';

function bounded(
  raw: string,
  min: number,
  max: number,
  label: string,
): Result<string, DomainError> {
  if (typeof raw !== 'string') {
    return err(DomainError.validation(`${label} must be text`));
  }
  const trimmed = raw.trim();
  if (trimmed.length < min || trimmed.length > max) {
    return err(DomainError.validation(`${label} must have ${min} to ${max} characters`));
  }
  return ok(trimmed);
}

export class NotebookName {
  private readonly __notebookName!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<NotebookName, DomainError> {
    const bounds = bounded(raw, 1, 120, 'The notebook name');
    return bounds.ok ? ok(new NotebookName(bounds.value)) : bounds;
  }

  equals(other: unknown): boolean {
    return other instanceof NotebookName && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}

/** What shows up in the notebook catalogue. Optional, unlike a folder description. */
export class ShortText {
  private readonly __shortText!: void;
  private constructor(readonly value: string) {}

  static readonly EMPTY = new ShortText('');

  static create(raw: string): Result<ShortText, DomainError> {
    if (typeof raw !== 'string') return err(DomainError.validation('The description must be text'));
    const trimmed = raw.trim();
    if (trimmed.length > 500) {
      return err(DomainError.validation('The description must have at most 500 characters'));
    }
    return ok(new ShortText(trimmed));
  }

  equals(other: unknown): boolean {
    return other instanceof ShortText && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}

export class FolderName {
  private readonly __folderName!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<FolderName, DomainError> {
    const bounds = bounded(raw, 1, 120, 'The folder name');
    return bounds.ok ? ok(new FolderName(bounds.value)) : bounds;
  }

  equals(other: unknown): boolean {
    return other instanceof FolderName && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * MANDATORY, 1 to 500 characters (RN-KNW-006). An empty description is not
 * accepted because this is the text that steers where the agent writes, and it
 * is also what the semantic index uses as the context prefix of every chunk.
 * Making it optional would degrade both at once.
 */
export class FolderDescription {
  private readonly __folderDescription!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<FolderDescription, DomainError> {
    const bounds = bounded(raw, 1, 500, 'The folder description');
    return bounds.ok ? ok(new FolderDescription(bounds.value)) : bounds;
  }

  equals(other: unknown): boolean {
    return other instanceof FolderDescription && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }
}

/**
 * There is no NoteName value object, and the absence is the decision: a name
 * is not given, it is the `name:` the content states, so there is nothing
 * here to validate or refuse. A note whose
 * content states no name has none, and it is written all the same
 * (RN-KNW-035, RN-KNW-036).
 */

/**
 * Removing a folder that holds folders or notes requires an EXPLICIT policy
 * (RN-KNW-007). There is no implicit default, which is why the missing case
 * answers PRECONDITION_FAILED rather than picking one.
 */
export class RemovalPolicy {
  private readonly __removalPolicy!: void;
  private constructor(readonly value: 'CASCADE' | 'REJECT_IF_NOT_EMPTY') {}

  static readonly CASCADE = new RemovalPolicy('CASCADE');
  static readonly REJECT_IF_NOT_EMPTY = new RemovalPolicy('REJECT_IF_NOT_EMPTY');

  static create(raw: string): Result<RemovalPolicy, DomainError> {
    if (raw === 'CASCADE') return ok(RemovalPolicy.CASCADE);
    if (raw === 'REJECT_IF_NOT_EMPTY') return ok(RemovalPolicy.REJECT_IF_NOT_EMPTY);
    return err(
      DomainError.preconditionFailed(
        'Removing a folder requires an explicit policy: CASCADE or REJECT_IF_NOT_EMPTY',
      ),
    );
  }

  get cascades(): boolean {
    return this.value === 'CASCADE';
  }

  toString(): string {
    return this.value;
  }
}

/** Product limits, declared so they become tests (software-vision.md, 14). */
export const NOTEBOOK_LIMITS = {
  maxFolders: 200,
  maxDepth: 6,
  maxNoteBytes: 1_048_576,
} as const;

/**
 * Where a file sits inside its notebook (#166, RN-KNW-048).
 *
 * It is written like a path of a filesystem and it exists because a file was
 * written into it: there is no folder to create and nothing to delete when the
 * last file leaves. It organises and it does NOT address — the name does that
 * — so two files never collide over a path and moving one breaks no note.
 *
 * Normalised so that `pasta/sub`, `/pasta/sub/` and `//pasta///sub` are the
 * one path they obviously are, and `/` is the root.
 */
export function filePath(raw: string): Result<string, DomainError> {
  if (typeof raw !== 'string') return err(DomainError.validation('The path must be text'));
  const segments = raw
    .split('/')
    .map((segment) => segment.normalize('NFC').trim())
    .filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return err(DomainError.validation('A path of a notebook has no . or .. segment'));
  }
  const path = segments.length === 0 ? '/' : `/${segments.join('/')}`;
  if (path.length > 1024) {
    return err(DomainError.validation('A path goes up to 1024 characters'));
  }
  return ok(path);
}

/** The subjects of a file, trimmed, deduplicated and bounded like a tag is. */
export function fileTags(raw: readonly string[]): Result<readonly string[], DomainError> {
  if (!Array.isArray(raw)) return err(DomainError.validation('The tags must be a list'));
  const tags: string[] = [];
  for (const each of raw) {
    if (typeof each !== 'string') return err(DomainError.validation('A tag must be text'));
    const tag = each.normalize('NFC').trim();
    if (tag.length === 0) continue;
    if (tag.length > 40) return err(DomainError.validation('A tag goes up to 40 characters'));
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > 20) return err(DomainError.validation('A file carries up to 20 tags'));
  return ok(tags);
}
