/**
 * A note downloaded as a PDF made by the server (#263, RN-PRT-031).
 *
 * The print tab previews the pages a note prints on, and the browser prints
 * them — but not every device has a PDF printer in its dialog, or a person who
 * knows that "Save as PDF" is one. So the server makes the file: a Chromium of
 * its own opens THE SAME page the tab previews, as the person who asked, with
 * the choices they made, and saves its pages as a PDF. One page drawn once,
 * whoever prints it, so the file and the preview never differ.
 *
 * It is a job and not a request, as an export is (RN-PRT-019): starting a
 * browser and drawing a note does not fit in the 29 seconds the function behind
 * the API lives. The API sends one message and answers an identifier; what the
 * screen polls is whether the file is there. Nothing else records it: the file
 * is kept for a day under the subscription of whoever asked, and the link to it
 * is issued at the moment of the download, never stored.
 */

import {
  DomainError,
  err,
  Instant,
  canonicalUlid,
  ok,
  ulid,
  ulidTime,
  type Result,
} from '@memorysmith/kernel';

/** Where the properties go, how wide tables fit and which way the sheet lies (#258). */
export interface PrintChoices {
  readonly placement: 'cover' | 'end' | 'none';
  readonly tables: 'wrap' | 'shrink';
  readonly orientation: 'portrait' | 'landscape';
}

/**
 * What the renderer is handed. The page is opened as the person who asked, so
 * it reads only what they read: the token of their session travels with the
 * job, inside the account, and is never stored with the file.
 */
export interface PrintJob {
  readonly printId: string;
  readonly subscriptionId: string;
  readonly notebookId: string;
  readonly noteId: string;
  readonly accessToken: string;
  readonly choices: PrintChoices;
  /** The language the page is drawn in, as the person reads it. */
  readonly locale: string;
}

export interface PrintQueue {
  send(job: PrintJob): Promise<void>;
}

export type PrintState =
  | { readonly status: 'running' }
  | { readonly status: 'ready'; readonly name: string }
  | { readonly status: 'failed'; readonly failure: string };

export interface PrintStore {
  state(subscriptionId: string, printId: string): Promise<PrintState>;
  /** A link to the file, named after the note, answered on the files host. */
  link(subscriptionId: string, printId: string, name: string, seconds: number): Promise<string>;
}

export interface PrintDto {
  readonly printId: string;
  readonly status: 'running' | 'ready' | 'failed';
  readonly downloadUrl?: string;
  readonly expiresAt?: string;
  readonly failure?: string;
}

/** How long a link to the file lives: it is followed the moment it is answered. */
const LINK_SECONDS = 900;

/**
 * How long a print may take before it is said to have failed. A renderer that
 * died leaves no file and no failure behind, and the screen may not wait for
 * one forever.
 */
export const PRINT_DEADLINE_MILLIS = 3 * 60 * 1000;

export class StartPrint {
  constructor(
    private readonly queue: PrintQueue,
    private readonly subscriptionId: string,
  ) {}

  async execute(input: {
    notebookId: string;
    noteId: string;
    accessToken: string;
    choices: PrintChoices;
    locale: string;
  }): Promise<Result<{ printId: string }, DomainError>> {
    const noteId = canonicalUlid(input.noteId);
    if (!noteId) return err(DomainError.notFound('Note not found'));
    if (!input.accessToken) {
      return err(DomainError.validation('A print is made as the person who asks for it'));
    }
    const printId = ulid();
    await this.queue.send({
      printId,
      subscriptionId: this.subscriptionId,
      notebookId: input.notebookId,
      noteId,
      accessToken: input.accessToken,
      choices: input.choices,
      locale: input.locale,
    });
    return ok({ printId });
  }
}

export class GetPrint {
  constructor(
    private readonly store: PrintStore,
    private readonly subscriptionId: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async execute(asked: string): Promise<Result<PrintDto, DomainError>> {
    // An identifier that is not one names nothing, here as everywhere.
    const printId = canonicalUlid(asked);
    if (!printId) return err(DomainError.notFound('Print not found'));
    const state = await this.store.state(this.subscriptionId, printId);

    if (state.status === 'ready') {
      const expiresAt = Instant.fromEpochMillis(this.now() + LINK_SECONDS * 1000);
      return ok({
        printId,
        status: 'ready',
        downloadUrl: await this.store.link(
          this.subscriptionId,
          printId,
          `${state.name}.pdf`,
          LINK_SECONDS,
        ),
        expiresAt: expiresAt.ok ? expiresAt.value.toISOString() : new Date().toISOString(),
      });
    }
    if (state.status === 'failed') return ok({ printId, status: 'failed', failure: state.failure });
    if (this.now() - ulidTime(printId) > PRINT_DEADLINE_MILLIS) {
      return ok({ printId, status: 'failed', failure: 'TIMED_OUT' });
    }
    return ok({ printId, status: 'running' });
  }
}
