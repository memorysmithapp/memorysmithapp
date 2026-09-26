/**
 * What a row of Transfers says (#155).
 *
 * It used to say the name of the notebook and a size, so an export and an
 * import of the same notebook read the same — and the size of an import is
 * always zero, because an import keeps nothing: the upload is discarded the
 * moment it ends (RN-PRT-014). `0 B` beside an export of 1 MB reads as a job
 * that did nothing, and it had written a whole notebook.
 */

import { describe, expect, it } from 'vitest';
import type { TransferDto } from '@memorysmith/contracts';
import {
  STALLED_AFTER_MS,
  fileOf,
  isOpenUpload,
  isStalled,
  isWorking,
  lineOf,
  notebookUnavailable,
  outcomeOf,
} from './transfers';

/** The words, as a test can read them: the key and what was put in it. */
const say = (key: string, values?: Record<string, unknown>): string =>
  `${key}(${Object.entries(values ?? {})
    .map(([name, value]) => `${name}=${String(value)}`)
    .join(',')})`;

const size = (bytes: number): string => `${bytes} B`;

function transfer(over: Partial<TransferDto>): TransferDto {
  return {
    transferId: '01JBQ2X0000000000000000001',
    kind: 'export',
    status: 'ready',
    notebookId: '01JBQ2X0000000000000000002',
    notebookName: 'Normas e Legislacao',
    requestedAt: '2026-09-18T10:00:00.000Z',
    finishedAt: '2026-09-18T10:00:04.000Z',
    done: 0,
    total: 0,
    bytes: 0,
    failure: null,
    fileName: null,
    ...over,
  };
}

describe('what a row of Transfers says', () => {
  it('says the direction and the notebook, once', () => {
    // It used to name the notebook and then the file named after it, which is
    // the same words twice over three lines of a panel (#160).
    const line = lineOf(
      transfer({ kind: 'export', fileName: 'Normas e Legislacao.notebook' }),
      say,
    );
    expect(line).toBe('transfers.line.export(notebook=Normas e Legislacao)');
    expect(lineOf(transfer({ kind: 'import' }), say)).toBe(
      'transfers.line.import(notebook=Normas e Legislacao)',
    );
  });

  it('keeps the file for the line under it', () => {
    expect(fileOf(transfer({ kind: 'import', fileName: 'backup-2026-09.notebook' }), say)).toBe(
      'transfers.fromFile(file=backup-2026-09.notebook)',
    );
  });

  it('says nothing about a file a transfer was recorded without', () => {
    expect(fileOf(transfer({ kind: 'import', fileName: null }), say)).toBeNull();
  });
});

describe('what a transfer that ended produced', () => {
  it('is the bytes an export keeps, which count towards the plan', () => {
    expect(outcomeOf(transfer({ kind: 'export', bytes: 1_048_576 }), say, size)).toBe('1048576 B');
  });

  it('is what an import WROTE, and never a size', () => {
    const wrote = outcomeOf(transfer({ kind: 'import', done: 42, bytes: 0 }), say, size);
    expect(wrote).toBe('transfers.wrote(count=42)');
    expect(wrote).not.toContain('B');
  });

  it('says what an import of a design alone produced, rather than nothing', () => {
    // Everything but the notes is a selection somebody makes on purpose
    // (RN-PRT-017), and `0 notes written` reads as a failure.
    expect(outcomeOf(transfer({ kind: 'import', done: 0 }), say, size)).toBe(
      'transfers.wroteNothing()',
    );
  });
});

describe('an upload of an agent (#240, RN-PRT-028, RN-PRT-029)', () => {
  const upload = (over: Partial<TransferDto> = {}, lastPartAt: string | null = null) =>
    transfer({
      kind: 'agent',
      status: 'running',
      finishedAt: null,
      total: 3,
      done: 1,
      bytes: 20_000_000,
      fileName: 'quadro.jpg',
      upload: {
        mimeType: 'image/jpeg',
        purpose: 'A foto do quadro',
        platform: 'Claude',
        transport: 'url',
        sha256: 'a'.repeat(64),
        partSize: 8_388_608,
        partCount: 3,
        received: [1],
        lastPartAt,
      },
      ...over,
    });

  it('is not a job a worker ends, so it does not poll every two seconds', () => {
    expect(isWorking(upload())).toBe(false);
    expect(isOpenUpload(upload())).toBe(true);
    expect(isWorking(transfer({ status: 'running' }))).toBe(true);
    expect(isOpenUpload(upload({ status: 'failed' }))).toBe(false);
  });

  it('reads as stopped a quarter of an hour after its last part, and never threatens', () => {
    const last = '2026-09-26T12:00:00.000Z';
    const at = new Date(last).getTime();
    expect(isStalled(upload({}, last), at + STALLED_AFTER_MS - 1)).toBe(false);
    expect(isStalled(upload({}, last), at + STALLED_AFTER_MS + 1)).toBe(true);
    // With no part yet, the clock runs from when it started.
    const started = new Date('2026-09-18T10:00:00.000Z').getTime();
    expect(isStalled(upload(), started + STALLED_AFTER_MS + 1)).toBe(true);
    expect(isStalled(transfer({ status: 'running' }), Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('says its notebook is unavailable when it is not one the person sees, and nothing before it knows', () => {
    const one = upload();
    expect(notebookUnavailable(one, null)).toBe(false);
    expect(notebookUnavailable(one, new Set([one.notebookId ?? '']))).toBe(false);
    expect(notebookUnavailable(one, new Set(['someone-else']))).toBe(true);
    expect(notebookUnavailable(transfer({ kind: 'import', notebookId: null }), new Set())).toBe(
      false,
    );
  });
});
