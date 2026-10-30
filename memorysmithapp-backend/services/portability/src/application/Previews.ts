/**
 * How a note is drawn, as an image an agent can see (#260, RN-PRT-032).
 *
 * An agent writes a note it cannot see: it knows the notation, and not what
 * the page makes of a table inside a callout or of a code span that widens a
 * column. A preview is the page drawing it — the same renderer a PDF is made
 * with (RN-PRT-031), opening a page of the application as the person the
 * connector acts for — captured as a PNG at the reading width.
 *
 * It draws a note already written, by its identifier, or a draft not written
 * yet, which is when "how will it look" is worth the most; and the whole note
 * or one part of it, addressed as a transclusion addresses one: `#Section`, or
 * `#^block`. A draft is kept beside the image, under the subscription, because
 * a note may be a megabyte and a message of the queue may not.
 *
 * It is a job, as a print is: starting a browser does not fit in a call of the
 * connector, which dies at about 29 seconds. The start answers an identifier,
 * and the image is asked for until it is there. Nothing records a preview but
 * the objects themselves, which the bucket expires in a day, and none of them
 * counts towards the storage of the subscription.
 */

import {
  DomainError,
  err,
  canonicalUlid,
  ok,
  ulid,
  ulidTime,
  type Result,
} from '@memorysmithapp/kernel';
import { PRINT_DEADLINE_MILLIS } from './Prints.js';

/** The width a preview is drawn at, and the tallest image it answers (#260). */
export const PREVIEW_WIDTH = 760;
export const PREVIEW_MAX_HEIGHT = 1600;

/** The largest draft a preview draws: the largest note a write accepts. */
const DRAFT_MAX_CHARACTERS = 1_048_576;

/**
 * What the renderer is handed. `kind` tells it from a print on the queue they
 * share. The draft does not travel here: the renderer reads it where the API
 * kept it, and the page reads everything else through the API, as the person.
 */
export interface PreviewJob {
  readonly kind: 'preview';
  readonly previewId: string;
  readonly subscriptionId: string;
  readonly notebookId: string;
  /** The note drawn, or null when a draft is. */
  readonly noteId: string | null;
  /** Whether a draft was kept beside the image, to be drawn instead of a note. */
  readonly draft: boolean;
  /** The folder a draft would be written in, when it was named. */
  readonly folderId: string | null;
  /**
   * The part drawn, as a transclusion writes it after the `#`: `Section`, or
   * `^block`. Null for the whole note.
   */
  readonly part: string | null;
  /** A Dashboard drawn instead of a note, by its name or identifier (#368). */
  readonly dashboard?: string | null;
  /** The view of that dashboard the image shows: its periods and a mark clicked (#369). */
  readonly filters?: Readonly<Record<string, string | null>> | null;
  readonly cross?: { readonly component: string; readonly key: string } | null;
  readonly accessToken: string;
  readonly locale: string;
}

export interface PreviewQueue {
  send(job: PreviewJob): Promise<void>;
}

/** The image as it was drawn: its size, and how tall the drawing was before it was cut. */
export interface PreviewImage {
  readonly png: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly drawnHeight: number;
}

export type PreviewState =
  | { readonly status: 'running' }
  | { readonly status: 'ready'; readonly image: PreviewImage }
  | { readonly status: 'failed'; readonly failure: string };

export interface PreviewStore {
  /** Keeps the draft the renderer will draw, under the subscription, for a day. */
  keepDraft(subscriptionId: string, previewId: string, content: string): Promise<void>;
  state(subscriptionId: string, previewId: string): Promise<PreviewState>;
}

export interface PreviewDto {
  readonly previewId: string;
  readonly status: 'running' | 'ready' | 'failed';
  readonly image?: {
    readonly mimeType: 'image/png';
    readonly base64: string;
    readonly width: number;
    readonly height: number;
    readonly drawnHeight: number;
    readonly cut: boolean;
  };
  readonly failure?: string;
}

/**
 * The part as a transclusion addresses it, without the `#` it may be written
 * with: `Section`, or `^block`. An anchor with nothing in it addresses
 * nothing, and is refused rather than read as the whole note.
 */
export function partOf(asked: string | undefined): Result<string | null, DomainError> {
  if (asked === undefined) return ok(null);
  const trimmed = asked.trim();
  const anchor = trimmed.startsWith('#') ? trimmed.slice(1).trim() : trimmed;
  if (anchor === '' || anchor === '^') {
    return err(
      DomainError.validation(
        'A part is addressed as a transclusion addresses one: #Section, or #^block',
      ),
    );
  }
  return ok(anchor);
}

export class StartPreview {
  constructor(
    private readonly queue: PreviewQueue,
    private readonly store: PreviewStore,
    private readonly subscriptionId: string,
  ) {}

  async execute(input: {
    notebookId: string;
    noteId?: string | undefined;
    content?: string | undefined;
    folderId?: string | undefined;
    part?: string | undefined;
    dashboard?: string | undefined;
    filters?: Readonly<Record<string, string | null>> | undefined;
    cross?: { readonly component: string; readonly key: string } | undefined;
    accessToken: string;
    locale: string;
  }): Promise<Result<{ previewId: string }, DomainError>> {
    /**
     * A Dashboard is drawn as the person reads it (#368): the whole of it, at
     * the width of a computer, as a PNG the person keeps or an agent looks at.
     */
    if (input.dashboard !== undefined) {
      if (input.noteId !== undefined || input.content !== undefined || input.part !== undefined) {
        return err(
          DomainError.validation(
            'A preview draws a dashboard, or a note or a draft, and never both',
          ),
        );
      }
      if (!input.accessToken) {
        return err(DomainError.validation('A preview is drawn as the person who asks for it'));
      }
      const previewId = ulid();
      await this.queue.send({
        kind: 'preview',
        previewId,
        subscriptionId: this.subscriptionId,
        notebookId: input.notebookId,
        noteId: null,
        draft: false,
        folderId: null,
        part: null,
        dashboard: input.dashboard,
        filters: input.filters ?? null,
        cross: input.cross ?? null,
        accessToken: input.accessToken,
        locale: input.locale,
      });
      return ok({ previewId });
    }
    const hasNote = input.noteId !== undefined;
    const hasDraft = input.content !== undefined;
    if (hasNote === hasDraft) {
      return err(
        DomainError.validation(
          'A preview draws a note already written, by its identifier, or a draft, by its ' +
            'content: exactly one of the two',
        ),
      );
    }
    if (hasNote && input.folderId !== undefined) {
      return err(
        DomainError.validation(
          'A folder is named for a draft, where it would be written; a note is drawn where it is',
        ),
      );
    }
    if (!input.accessToken) {
      return err(DomainError.validation('A preview is drawn as the person who asks for it'));
    }
    const part = partOf(input.part);
    if (!part.ok) return part;

    let noteId: string | null = null;
    if (hasNote) {
      noteId = canonicalUlid(input.noteId ?? '');
      if (!noteId) return err(DomainError.notFound('Note not found'));
    }
    let folderId: string | null = null;
    if (input.folderId !== undefined) {
      folderId = canonicalUlid(input.folderId);
      if (!folderId) return err(DomainError.notFound('Folder not found'));
    }
    const content = input.content ?? '';
    if (hasDraft && content.trim() === '') {
      return err(DomainError.validation('A draft with nothing in it draws nothing'));
    }
    if (content.length > DRAFT_MAX_CHARACTERS) {
      return err(DomainError.validation('A draft is at most as long as a note may be'));
    }

    const previewId = ulid();
    if (hasDraft) await this.store.keepDraft(this.subscriptionId, previewId, content);
    await this.queue.send({
      kind: 'preview',
      previewId,
      subscriptionId: this.subscriptionId,
      notebookId: input.notebookId,
      noteId,
      draft: hasDraft,
      folderId,
      part: part.value,
      accessToken: input.accessToken,
      locale: input.locale,
    });
    return ok({ previewId });
  }
}

export class GetPreview {
  constructor(
    private readonly store: PreviewStore,
    private readonly subscriptionId: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async execute(asked: string): Promise<Result<PreviewDto, DomainError>> {
    // An identifier that is not one names nothing, here as everywhere.
    const previewId = canonicalUlid(asked);
    if (!previewId) return err(DomainError.notFound('Preview not found'));
    const state = await this.store.state(this.subscriptionId, previewId);

    if (state.status === 'ready') {
      const { png, width, height, drawnHeight } = state.image;
      return ok({
        previewId,
        status: 'ready',
        image: {
          mimeType: 'image/png',
          base64: Buffer.from(png).toString('base64'),
          width,
          height,
          drawnHeight,
          cut: drawnHeight > height,
        },
      });
    }
    if (state.status === 'failed') {
      return ok({ previewId, status: 'failed', failure: state.failure });
    }
    // A renderer that died leaves neither, and nobody waits for one forever.
    if (this.now() - ulidTime(previewId) > PRINT_DEADLINE_MILLIS) {
      return ok({ previewId, status: 'failed', failure: 'TIMED_OUT' });
    }
    return ok({ previewId, status: 'running' });
  }
}

/**
 * The rectangle the image is cut from: the reading width, and the height the
 * part was drawn at, up to the tallest image a preview answers.
 */
export function clipOf(drawnHeight: number): { width: number; height: number; cut: boolean } {
  const drawn = Math.max(1, Math.ceil(drawnHeight));
  return {
    width: PREVIEW_WIDTH,
    height: Math.min(drawn, PREVIEW_MAX_HEIGHT),
    cut: drawn > PREVIEW_MAX_HEIGHT,
  };
}
