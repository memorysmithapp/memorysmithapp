/**
 * The history of a notebook (#431, #446): its trail, the newest change first,
 * only what the notebook holds, an edit session as one change, and what an
 * import wrote as it created the notebook folded into its creation.
 */

import { describe, expect, it } from 'vitest';
import { notebookHistoryOf, type TrailEntry } from '../src/domain/NotebookHistory.js';

function entry(
  at: string,
  type: string,
  subjectId: string,
  payload: Record<string, unknown> = {},
  agent: string | null = null,
): TrailEntry {
  return {
    occurredAt: `2026-11-10T10:${at}:00.000Z`,
    type,
    subject: 'NOTE',
    subjectId,
    payload,
    agent,
  };
}

describe('the history of a notebook (#431, #446)', () => {
  it('lists the newest change first, with what changed, through what and the line left', () => {
    const history = notebookHistoryOf([
      entry('00', 'NoteCreated', 'n1', { name: 'Ata' }),
      entry('05', 'NoteUpdated', 'n1', { name: 'Ata', message: 'Fixed the date' }, 'Claude'),
    ]);
    expect(history.truncated).toBe(false);
    expect(history.changes).toEqual([
      expect.objectContaining({
        type: 'NoteUpdated',
        name: 'Ata',
        agent: 'Claude',
        message: 'Fixed the date',
        saves: 1,
      }),
      expect.objectContaining({ type: 'NoteCreated', name: 'Ata', agent: null, message: null }),
    ]);
  });

  it('leaves out what a notebook created from it would not carry', () => {
    const history = notebookHistoryOf([
      entry('00', 'NotebookShared', 'nb'),
      entry('01', 'NotebookRoleLimitSet', 'nb'),
      entry('02', 'NotePurged', 'n1'),
      entry('03', 'GuidanceUpdated', 'nb'),
      entry('04', 'RowsInserted', 't1', { table: 'gastos' }),
    ]);
    expect(history.changes.map((change) => [change.type, change.name])).toEqual([
      ['RowsInserted', 'gastos'],
      ['GuidanceUpdated', null],
    ]);
  });

  it('counts an edit session as one change, saying how many saves and since when', () => {
    const history = notebookHistoryOf([
      entry('00', 'NoteUpdated', 'n1', { session: 's1' }),
      entry('01', 'NoteUpdated', 'n1', { session: 's1', message: 'Reworded' }),
      entry('02', 'NoteUpdated', 'n1', { session: 's1' }),
      entry('03', 'NoteUpdated', 'n2', { session: 's1' }),
      entry('04', 'NoteUpdated', 'n1', { session: 's2' }),
    ]);
    expect(
      history.changes.map((change) => [
        change.subjectId,
        change.saves,
        change.since,
        change.message,
      ]),
    ).toEqual([
      ['n1', 1, '2026-11-10T10:04:00.000Z', null],
      ['n2', 1, '2026-11-10T10:03:00.000Z', null],
      ['n1', 3, '2026-11-10T10:00:00.000Z', 'Reworded'],
    ]);
    expect(history.changes[2]?.occurredAt).toBe('2026-11-10T10:02:00.000Z');
  });

  it('answers at most its limit, saying older changes were left out', () => {
    const trail = Array.from({ length: 5 }, (_, at) =>
      entry(String(at).padStart(2, '0'), 'NoteCreated', `n${at}`),
    );
    const history = notebookHistoryOf(trail, 3);
    expect(history.changes.map((change) => change.subjectId)).toEqual(['n4', 'n3', 'n2']);
    expect(history.truncated).toBe(true);
    expect(notebookHistoryOf(trail, 5).truncated).toBe(false);
  });

  it('folds what an import wrote as it created the notebook into its creation, from its model (#446)', () => {
    const stamp = '2026-11-10T10:00:00.000Z';
    const history = notebookHistoryOf([
      {
        ...entry('00', 'NotebookCreated', 'nb', {
          name: 'Licitações de Itu',
          fromModel: { name: 'Licitações de {{orgao}}' },
        }),
        subject: 'NOTEBOOK',
        at: stamp,
      },
      { ...entry('01', 'FolderAdded', 'f1', { name: 'Editais' }), at: stamp },
      { ...entry('02', 'NoteCreated', 'n1', { name: 'Pregão 1' }), at: stamp },
      { ...entry('09', 'NoteUpdated', 'n1', { name: 'Pregão 1' }), at: '2026-11-10T10:09:00.000Z' },
    ]);
    expect(history.changes.map((change) => [change.type, change.fromModel])).toEqual([
      ['NoteUpdated', null],
      ['NotebookCreated', 'Licitações de {{orgao}}'],
    ]);
  });

  it('keeps every change of a notebook created blank, and says which the person asking made', () => {
    const history = notebookHistoryOf([
      { ...entry('00', 'NotebookCreated', 'nb', { name: 'Atas' }), at: 'a', you: true },
      { ...entry('01', 'NoteCreated', 'n1', { name: 'Ata 1' }), at: 'b', you: false },
    ]);
    expect(history.changes.map((change) => [change.type, change.fromModel, change.you])).toEqual([
      ['NoteCreated', null, false],
      ['NotebookCreated', null, true],
    ]);
  });

  it('folds nothing into a creation that came from no model, though a write shares its instant', () => {
    const stamp = '2026-11-10T10:00:00.000Z';
    const history = notebookHistoryOf([
      { ...entry('00', 'NotebookCreated', 'nb', { name: 'Atas' }), at: stamp },
      { ...entry('00', 'FolderAdded', 'f1', { name: 'Atas' }), at: stamp },
    ]);
    expect(history.changes).toHaveLength(2);
  });

  it('folds nothing written through another connector at the same instant', () => {
    const stamp = '2026-11-10T10:00:00.000Z';
    const history = notebookHistoryOf([
      {
        ...entry('00', 'NotebookCreated', 'nb', { name: 'Atas', fromModel: { name: 'Atas' } }),
        at: stamp,
      },
      { ...entry('00', 'NoteCreated', 'n1', { name: 'Ata 1' }, 'Claude'), at: stamp },
    ]);
    expect(history.changes).toHaveLength(2);
  });
});
