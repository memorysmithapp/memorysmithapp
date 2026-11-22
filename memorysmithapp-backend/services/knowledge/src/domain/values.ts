/**
 * Value objects of the Knowledge context. All immutable, self-validating in
 * the constructor and compared by value. No raw string crosses the boundary of
 * the domain.
 */

import { DomainError, err, ok, type Result } from '@memorysmithapp/kernel';

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

/**
 * How a folder orders its notes (RN-KNW-056): by the position written into it,
 * `manual`, which is the default, or by the name of each note, `alphabetical`.
 * The domain holds the order as data of the folder; comparing two names is the
 * one comparison the published language carries, so every edge that lists
 * notes — the routes, the connector and the screen — sorts with the same one.
 */
export type FolderNoteOrder = 'manual' | 'alphabetical';

export const FolderNoteOrder = {
  DEFAULT: 'manual' as FolderNoteOrder,
  create(raw: string): Result<FolderNoteOrder, DomainError> {
    if (raw === 'manual' || raw === 'alphabetical') return ok(raw);
    return err(
      DomainError.validation('A folder orders its notes "manual" or "alphabetical"', {
        noteOrder: raw,
      }),
    );
  },
};

/**
 * How a notebook's notes are drawn and printed (#493): the face, the alignment
 * of headings, text and tables, and the print page's settings. The domain
 * keeps it as data of the notebook; its values are validated at the edge by
 * the published schema, and an item written before it carries the default.
 */
export type StyleAlignment = 'left' | 'center' | 'right' | 'justify';
export type StyleOrientation = 'portrait' | 'landscape';
export interface NotebookStyle {
  readonly font: 'sans' | 'serif';
  readonly headings: StyleAlignment;
  readonly text: StyleAlignment;
  readonly tables: StyleAlignment;
  /** Whether justified text breaks words with a hyphen (#498). */
  readonly hyphenate: boolean;
  /** How the headings are numbered (#535). */
  readonly numbering: 'none' | 'decimal';
  /** How a note draws its properties when it writes no block (#530, RN-KNW-096). */
  readonly properties: DrawingSettings;
  /** The contents a note draws when it writes none, or none (#521, RN-KNW-097). */
  readonly contents: DrawingSettings | null;
  readonly orientation: StyleOrientation;
  readonly printTables: 'wrap' | 'shrink' | 'appendices';
  readonly appendixOrientation: StyleOrientation | null;
}

/**
 * The renderer's host settings of a `properties` or a `contents` block
 * (#530, #521): data of the notebook, in the structure the specification
 * gives them, validated at the edge by the published schema.
 */
export type DrawingSettings = { readonly [key: string]: unknown };

export const NotebookStyle = {
  /** How every note was drawn and printed before a notebook had a style. */
  DEFAULT: {
    font: 'sans',
    headings: 'left',
    text: 'left',
    tables: 'left',
    hyphenate: false,
    numbering: 'none',
    properties: {},
    contents: null,
    orientation: 'portrait',
    printTables: 'wrap',
    appendixOrientation: null,
  } as NotebookStyle,
  same(left: NotebookStyle, right: NotebookStyle): boolean {
    return (Object.keys(NotebookStyle.DEFAULT) as (keyof NotebookStyle)[]).every((key) =>
      typeof left[key] === 'object' || typeof right[key] === 'object'
        ? JSON.stringify(left[key]) === JSON.stringify(right[key])
        : left[key] === right[key],
    );
  },
};

/** Product limits, declared so they become tests. */
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
