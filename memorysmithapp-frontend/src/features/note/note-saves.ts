import type { SaveAction, SaveNotice, SaveOutcome } from '@memorysmithapp/markdown-renderer';

/**
 * The saves of one edit session of the note page (#300, RN-KNW-052,
 * RN-AUD-013).
 *
 * The editor of `@memorysmithapp/markdown-renderer` hands the whole note on
 * every change of its text, and saving each one would turn every keystroke
 * into a revision. So the changes are grouped by a PAUSE: the write goes out
 * when the person stops typing for a moment, and the number of revisions
 * follows the pauses, never the keys. Every write is still a revision of its
 * own, immutable, and carries the identifier of the session, which is what
 * lets the history show the session as one entry.
 *
 * What the editor is answered:
 *
 * - every change answers the promise of the write that will carry it, so the
 *   editor says *Saving…* until it lands, and going back to reading waits;
 * - a write refused because somebody else wrote rejects with a notice that
 *   says so and offers their version or saving anyway — a write on the
 *   revision that now exists, which leaves the other one in the history;
 * - any other refusal rejects with what it was and the offer to try again;
 * - a write that changed the name of the note resolves with a notice saying
 *   how many links go pending and how many resolve, and offers to keep the old
 *   name as an alias. The name compared is the one the note had when edit mode
 *   opened.
 *
 * Kept apart from the component so each of those can be proved without a
 * browser, and with a clock the test owns.
 */

/** How long the text has to rest before it is written. */
export const SAVE_PAUSE_MS = 1500;

/** What a write answers: the revision it produced. */
export interface WrittenNote {
  readonly revision: string;
}

/** What a refused write carries, as the API states it. */
export interface WriteRefusal {
  /** The code of the error taxonomy: `CONFLICT`, `VALIDATION`, … */
  readonly code: string | null;
  /** The revision that exists now, when the refusal is a divergence. */
  readonly currentRevision: string | null;
  /** What the API said, in the words a person reads. */
  readonly message: string;
}

/** How a rename lands on the notebook's links. */
export interface RenameCost {
  /** Links that reached the old name and go pending. */
  readonly losing: number;
  /** Pending links to the new name that resolve. */
  readonly gaining: number;
}

/** The words of the notices, in the reader's language. */
export interface SaveWords {
  readonly conflictTitle: string;
  readonly conflictMessage: string;
  readonly reload: string;
  readonly saveAnyway: string;
  readonly failedTitle: string;
  readonly retry: string;
  readonly renamedTitle: string;
  readonly renamed: (from: string | null, to: string | null, cost: RenameCost) => string;
  readonly keepBroken: string;
  readonly keepAlias: (name: string) => string;
  readonly understood: string;
}

export interface SavePorts {
  /** Writes the note on a revision, in a session; `keepalive` when the page is going away. */
  write(input: {
    content: string;
    baseRevision: string;
    session: string;
    keepalive: boolean;
  }): Promise<WrittenNote>;
  /** Reads the error a write threw as the refusal it is. */
  refusalOf(error: unknown): WriteRefusal;
  /** Reads the note again, as the server has it now. */
  reload(): Promise<{ raw: string; revision: string }>;
  /** Gives the editor a text of the host's: the other version, or the note with an alias. */
  replace(raw: string): void;
  /** The name a text states, or `null` (RN-KNW-035, RN-KNW-036). */
  nameOf(raw: string): string | null;
  /** The text with the old name kept as an alias. */
  withAlias(raw: string, alias: string): string;
  /** What a rename does to the notebook's links, answered before the index catches up. */
  renameCost(from: string | null, to: string | null): Promise<RenameCost>;
  /** A write landed: the page reads again what it shows around the note. */
  written(renamed: boolean): void;
  readonly words: SaveWords;
}

export class NoteSaves {
  private revision: string;
  /** The last text the editor handed, written or not. */
  private latest: string;
  /** The last text that reached the server. */
  private saved: string;
  /** The name the note had when edit mode opened, which a rename is told against. */
  private readonly openName: string | null;
  /** The name a rename notice was last given for, so one rename is told once. */
  private told: string | null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private waiting: Array<{
    resolve: (value: void | SaveOutcome) => void;
    reject: (reason: unknown) => void;
  }> = [];
  /** The write in flight, which the next one waits for: one revision builds on the last. */
  private inFlight: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly ports: SavePorts,
    opened: { raw: string; revision: string },
    readonly session: string,
    private readonly pauseMs: number = SAVE_PAUSE_MS,
  ) {
    this.revision = opened.revision;
    this.latest = opened.raw;
    this.saved = opened.raw;
    this.openName = ports.nameOf(opened.raw);
    this.told = this.openName;
  }

  /** Whether there is typing the server does not have yet. */
  get pending(): boolean {
    return this.latest !== this.saved || this.timer !== null;
  }

  /** A change of the editor: written after the pause, and answered when it is. */
  change(raw: string): Promise<void | SaveOutcome> {
    this.latest = raw;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.pauseMs);
    return new Promise((resolve, reject) => this.waiting.push({ resolve, reject }));
  }

  /** Writes what is waiting now: the pause ended, the page is going away, or the mode changed. */
  flush(options: { keepalive?: boolean } = {}): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const waiting = this.waiting;
    this.waiting = [];
    const run = this.inFlight.then(() => this.write(this.latest, options.keepalive ?? false));
    this.inFlight = run.catch(() => undefined);
    return run.then(
      (outcome) => waiting.forEach((each) => each.resolve(outcome)),
      (refusal: unknown) => waiting.forEach((each) => each.reject(refusal)),
    );
  }

  /** Nothing more is written: the session ended. */
  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async write(raw: string, keepalive: boolean): Promise<void | SaveOutcome> {
    // Identical bytes are not a write (RN-KNW-028): the editor still hears it saved.
    if (raw === this.saved) return undefined;
    try {
      const written = await this.ports.write({
        content: raw,
        baseRevision: this.revision,
        session: this.session,
        keepalive,
      });
      const before = this.ports.nameOf(this.saved);
      this.revision = written.revision;
      this.saved = raw;
      const name = this.ports.nameOf(raw);
      this.ports.written(name !== before);
      return await this.renameNotice(name, raw);
    } catch (error) {
      throw this.refusal(error);
    }
  }

  /**
   * A write that changed the name says what that did, once per name, after it
   * landed: nothing is confirmed before, because the editor saves as it goes.
   * Going back to the name edit mode opened with is not news.
   */
  private async renameNotice(name: string | null, raw: string): Promise<void | SaveOutcome> {
    if (name === this.told) return undefined;
    this.told = name;
    if (name === this.openName) return undefined;
    const from = this.openName;
    const cost = await this.ports.renameCost(from, name).catch(() => ({ losing: 0, gaining: 0 }));
    const { words } = this.ports;
    const actions: SaveAction[] =
      from === null
        ? [{ label: words.understood, run: () => undefined }]
        : [
            { label: words.keepBroken, run: () => undefined },
            { label: words.keepAlias(from), run: () => this.keepAlias(from, raw) },
          ];
    return { title: words.renamedTitle, message: words.renamed(from, name, cost), actions };
  }

  /** The old name kept as an alias, so the links to it keep arriving (§5.2, step 8). */
  private async keepAlias(alias: string, saved: string): Promise<void | SaveOutcome> {
    // What the person typed after the rename stays: the alias goes into the
    // latest text, never into the one the notice was about.
    const base = this.latest === saved ? saved : this.latest;
    const aliased = this.ports.withAlias(base, alias);
    this.latest = aliased;
    this.ports.replace(aliased);
    return this.flushNow();
  }

  private flushNow(): Promise<void | SaveOutcome> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const run = this.inFlight.then(() => this.write(this.latest, false));
    this.inFlight = run.catch(() => undefined);
    return run;
  }

  private refusal(error: unknown): SaveNotice {
    const refused = this.ports.refusalOf(error);
    const { words } = this.ports;
    if (refused.code === 'CONFLICT' && refused.currentRevision !== null) {
      const current = refused.currentRevision;
      return {
        title: words.conflictTitle,
        message: words.conflictMessage,
        actions: [
          { label: words.reload, run: () => this.takeTheirs() },
          {
            label: words.saveAnyway,
            run: () => {
              // A write on the revision that exists now: theirs stays in the
              // history, one revision before this one.
              this.revision = current;
              return this.flushNow();
            },
          },
        ],
      };
    }
    return {
      title: words.failedTitle,
      message: refused.message,
      // The latest text, which may be more than the one refused.
      actions: [{ label: words.retry, run: () => this.flushNow() }],
    };
  }

  /** Their version, in the editor and as the base of the next write; this edit is discarded. */
  private async takeTheirs(): Promise<void> {
    const fresh = await this.ports.reload();
    this.revision = fresh.revision;
    this.latest = fresh.raw;
    this.saved = fresh.raw;
    this.told = this.ports.nameOf(fresh.raw);
    this.ports.replace(fresh.raw);
  }
}

/** A ULID for an edit session: the time it opened, then randomness (RN-AUD-013). */
export function newSessionId(now: number = Date.now()): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let time = '';
  let rest = now;
  for (let i = 0; i < 10; i += 1) {
    time = alphabet[rest % 32] + time;
    rest = Math.floor(rest / 32);
  }
  const random = crypto.getRandomValues(new Uint8Array(16));
  let tail = '';
  for (let i = 0; i < 16; i += 1) tail += alphabet[random[i]! % 32];
  return time + tail;
}
