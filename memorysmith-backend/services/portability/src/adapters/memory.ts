/**
 * The parts of an upload, in memory, for the tests and the local harness
 * (RN-PRT-027). It keeps every object by key and revision as the bucket does,
 * and a multipart upload as a map of parts a case sends with `receivePart` —
 * which is what a script does with the signed address in production.
 */

import type { PrintJob, PrintQueue, PrintState, PrintStore } from '../application/Prints.js';
import type { PartStore } from '../application/Uploads.js';

export class InMemoryPartStore implements PartStore {
  /** Every revision written, as `key@version`. */
  readonly objects = new Map<string, Uint8Array>();
  private readonly multiparts = new Map<
    string,
    { key: string; parts: Map<number, { bytes: Uint8Array; at: string }> }
  >();
  private sequence = 0;

  constructor(
    /** Told of every object written, so a store of files can find the whole it adopts. */
    private readonly written: (key: string, versionId: string, bytes: Uint8Array) => void = () =>
      undefined,
  ) {}

  async startMultipart(key: string, _mimeType: string): Promise<string> {
    const multipartId = `mp-${++this.sequence}`;
    this.multiparts.set(multipartId, { key, parts: new Map() });
    return multipartId;
  }

  async signPart(key: string, multipartId: string, part: number, seconds: number): Promise<string> {
    return `memory://${key}?uploadId=${multipartId}&partNumber=${part}&expires=${seconds}`;
  }

  /** What a PUT to a signed address does. */
  receivePart(multipartId: string, part: number, bytes: Uint8Array): void {
    this.multiparts
      .get(multipartId)
      ?.parts.set(part, { bytes, at: new Date(Date.now() + this.sequence++).toISOString() });
  }

  async listParts(
    _key: string,
    multipartId: string,
  ): Promise<Array<{ part: number; lastModified: string | null }> | null> {
    const found = this.multiparts.get(multipartId);
    if (!found) return null;
    return [...found.parts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([part, each]) => ({ part, lastModified: each.at }));
  }

  async completeMultipart(key: string, multipartId: string): Promise<string> {
    const found = this.multiparts.get(multipartId);
    if (!found) throw new Error('NoSuchUpload');
    const ordered = [...found.parts.entries()].sort(([left], [right]) => left - right);
    const whole = Buffer.concat(ordered.map(([, each]) => each.bytes));
    this.multiparts.delete(multipartId);
    return this.putObject(key, whole);
  }

  async abortMultipart(_key: string, multipartId: string): Promise<void> {
    this.multiparts.delete(multipartId);
  }

  async putObject(key: string, bytes: Uint8Array): Promise<string> {
    const versionId = `v-${++this.sequence}`;
    this.objects.set(`${key}@${versionId}`, bytes);
    this.written(key, versionId, bytes);
    return versionId;
  }

  async readObject(key: string, versionId: string): Promise<Uint8Array | null> {
    return this.objects.get(`${key}@${versionId}`) ?? null;
  }

  async destroy(key: string, versionId: string): Promise<void> {
    this.objects.delete(`${key}@${versionId}`);
  }

  /** How many multipart uploads are still open, for a case to assert nothing leaked. */
  get openMultiparts(): number {
    return this.multiparts.size;
  }
}

/** A queue of prints that keeps what it was handed, for a test to read (#263). */
export class InMemoryPrintQueue implements PrintQueue {
  readonly sent: PrintJob[] = [];
  async send(job: PrintJob): Promise<void> {
    this.sent.push(job);
  }
}

/** Prints by subscription and identifier, as the bucket keeps them under the subscription. */
export class InMemoryPrintStore implements PrintStore {
  readonly states = new Map<string, PrintState>();
  set(subscriptionId: string, printId: string, state: PrintState): void {
    this.states.set(`${subscriptionId}/${printId}`, state);
  }
  async state(subscriptionId: string, printId: string): Promise<PrintState> {
    return this.states.get(`${subscriptionId}/${printId}`) ?? { status: 'running' };
  }
  async link(subscriptionId: string, printId: string, name: string, seconds: number) {
    return `https://files.example.test/s/${subscriptionId}/prints/${printId}.pdf?name=${encodeURIComponent(name)}&ttl=${seconds}`;
  }
}
