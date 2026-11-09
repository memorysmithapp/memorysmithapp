/**
 * The tables and dashboards of a transfer, chosen as the other species are
 * (#399): the whole notebook says nothing and carries everything, part of it
 * names what goes, and a dashboard chosen without its table is an
 * inconsistency that holds the transfer.
 */

import { describe, expect, it } from 'vitest';
import {
  carriedTables,
  carryOf,
  EVERY_TABLE,
  inconsistentDashboards,
  transferTablesOf,
  type TablesChoice,
} from './tables-choice';

const tables = [
  { name: 'custos', rows: 7 },
  { name: 'tarefas', rows: 7 },
  // An archive that carried this one with its schema alone.
  { name: 'fornecedores', rows: null },
];
const over = (...names: string[]) => ({
  components: names.map((table) => ({ type: 'kpi', source: { table, measure: 'count()' } })),
});
const dashboards = [
  { name: 'Painel da obra', definition: over('custos', 'tarefas') },
  { name: 'Custos', definition: over('custos') },
];
const choosing = (change: Partial<TablesChoice>): TablesChoice => ({
  ...EVERY_TABLE,
  reach: 'choose',
  ...change,
});

describe('the whole notebook', () => {
  it('says nothing of the tables, which carries every one with its rows and every dashboard', () => {
    expect(transferTablesOf(true, choosing({ on: false }), tables, dashboards)).toEqual({});
    expect(carriedTables(EVERY_TABLE, tables, dashboards)).toEqual({ tables: 3, dashboards: 2 });
  });
});

describe('part of the notebook', () => {
  it('carries no table and no dashboard when they are left out', () => {
    expect(transferTablesOf(false, { ...EVERY_TABLE, on: false }, tables, dashboards)).toEqual({
      tables: [],
      dashboards: [],
    });
  });

  it('says nothing when all of them go', () => {
    expect(transferTablesOf(false, EVERY_TABLE, tables, dashboards)).toEqual({});
  });

  it('names each table with its schema or its rows, and each dashboard that goes', () => {
    const choice = choosing({
      carry: { custos: 'rows', tarefas: 'schema', fornecedores: 'none' },
      dashboards: { Custos: false },
    });
    expect(transferTablesOf(false, choice, tables, dashboards)).toEqual({
      tables: [
        { name: 'custos', rows: true },
        { name: 'tarefas', rows: false },
      ],
      dashboards: ['Painel da obra'],
    });
  });

  it('never offers the rows of a table the archive carries without them', () => {
    expect(carryOf(choosing({ carry: { fornecedores: 'rows' } }), tables[2]!)).toBe('schema');
  });
});

describe('a dashboard chosen whose table stays out', () => {
  it('is an inconsistency, naming the table, and does not count as carried', () => {
    const choice = choosing({ carry: { tarefas: 'none' } });
    expect(inconsistentDashboards(choice, tables, dashboards)).toEqual([
      { dashboard: 'Painel da obra', table: 'tarefas' },
    ]);
    expect(carriedTables(choice, tables, dashboards)).toEqual({ tables: 2, dashboards: 1 });
  });

  it('is resolved by unticking the dashboard, or by taking its table back', () => {
    expect(
      inconsistentDashboards(
        choosing({ carry: { tarefas: 'none' }, dashboards: { 'Painel da obra': false } }),
        tables,
        dashboards,
      ),
    ).toEqual([]);
    expect(
      inconsistentDashboards(choosing({ carry: { tarefas: 'schema' } }), tables, dashboards),
    ).toEqual([]);
  });
});
