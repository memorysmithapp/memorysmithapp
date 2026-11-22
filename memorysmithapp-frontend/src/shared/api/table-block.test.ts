/**
 * A `table` block answered from the notebook (#366): a row of `system-notes`
 * is a note, and leads to it (#531).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableRequest } from '@memorysmithapp/markdown-renderer';

const queryTable = vi.fn();
vi.mock('./source', () => ({ queryTable: (...args: unknown[]) => queryTable(...args) }));

const { answerTableBlock } = await import('./table-block');

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const REQUEST = { table: 'system-notes', sort: [], page: 1, size: 10 } as unknown as TableRequest;

function page(name: string, rows: Array<{ rowId: string; values: Record<string, unknown> }>) {
  return {
    table: {
      name,
      schema: {
        type: 'object',
        properties: { note: { type: 'string' }, name: { type: 'string' } },
      },
    },
    rows,
    total: rows.length,
  };
}

beforeEach(() => queryTable.mockReset());

describe('a table block over the notes (#531)', () => {
  it('leads from each row to its note', async () => {
    queryTable.mockResolvedValue(
      page('system-notes', [
        {
          rowId: '01M81GP8WWVJF4B1F2MG452FXX',
          values: { note: '01M81GP8WWVJF4B1F2MG452FXX', name: 'Torneira' },
        },
        { rowId: '01M81GPA0D2ZQ9GT05KWMT72BD', values: { name: 'Relatório' } },
      ]),
    );
    const answer = await answerTableBlock(NOTEBOOK, REQUEST);
    expect(answer?.links).toEqual([
      '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/notes/01m81gp8wwvjf4b1f2mg452fxx',
      '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/notes/01m81gpa0d2zq9gt05kwmt72bd',
    ]);
  });

  it('answers no address for a table whose rows are no notes', async () => {
    queryTable.mockResolvedValue(page('gastos', [{ rowId: 'r1', values: { name: 'mercado' } }]));
    const answer = await answerTableBlock(NOTEBOOK, { ...REQUEST, table: 'gastos' });
    expect(answer).not.toHaveProperty('links');
  });
});
