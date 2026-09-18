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
import { lineOf, outcomeOf } from './transfers';

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
  it('names the notebook an export came from and the file it saves as', () => {
    const line = lineOf(
      transfer({ kind: 'export', fileName: 'Normas e Legislacao.notebook' }),
      say,
    );
    expect(line).toBe(
      'transfers.line.export(notebook=Normas e Legislacao,file=Normas e Legislacao.notebook)',
    );
  });

  it('names the file an import came from and the notebook it created', () => {
    const line = lineOf(transfer({ kind: 'import', fileName: 'backup-2026-09.notebook' }), say);
    expect(line).toBe(
      'transfers.line.import(notebook=Normas e Legislacao,file=backup-2026-09.notebook)',
    );
  });

  it('says what it can about an import recorded before a file name was kept', () => {
    const line = lineOf(transfer({ kind: 'import', fileName: null }), say);
    expect(line).toBe('transfers.line.importNoFile(notebook=Normas e Legislacao)');
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
