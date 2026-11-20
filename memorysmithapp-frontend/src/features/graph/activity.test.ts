import { describe, expect, it } from 'vitest';
import { assistantOf, attributeTerms, planOf, type GraphContext } from './activity';

const graph: GraphContext = {
  notes: [
    { id: 'A', name: 'Projeto Atlas', folderId: 'P', facets: { status: ['aberta'] } },
    { id: 'B', name: 'Ata 12', folderId: 'R', facets: { status: ['concluída'] } },
    { id: 'C', name: 'Ata 13', folderId: 'R', facets: { status: ['aberta'] } },
  ],
  folderName: (id) => ({ P: 'Projetos', R: 'Reuniões' })[id] ?? null,
  tables: [{ id: 'T1', name: 'Gastos' }],
  dashboards: [{ id: 'D1', name: 'Painel', tables: ['T1'] }],
  files: [{ id: 'F1', name: 'curva.png' }],
};
const who = { userId: 'u1', client: 'Claude', person: 'Heitor' };
const entry = (rest: Record<string, unknown>) => ({ id: '1', at: '', who, ...rest }) as never;

describe("what an agent's activity lights on the graph (#495)", () => {
  it('lights the note a read or a write names', () => {
    expect(planOf(entry({ kind: 'read', tool: 'read_note', noteId: 'A' }), graph)).toMatchObject({
      kind: 'read',
      notes: ['A'],
      target: { kind: 'note', name: 'Projeto Atlas' },
    });
    expect(planOf(entry({ kind: 'write', tool: 'update_note', noteId: 'B' }), graph)).toMatchObject(
      {
        kind: 'write',
        notes: ['B'],
      },
    );
    // A note created before the graph read it again is said as a new note.
    expect(
      planOf(entry({ kind: 'write', tool: 'create_note', noteId: 'Z' }), graph)?.target,
    ).toEqual({ kind: 'newNote' });
  });

  it('lights a folder and its notes, and the whole notebook as a wave', () => {
    expect(planOf(entry({ kind: 'read', tool: 'list_notes', folderId: 'R' }), graph)).toMatchObject(
      {
        notes: ['folder/R', 'B', 'C'],
        target: { kind: 'folder', name: 'Reuniões' },
        wave: false,
      },
    );
    expect(planOf(entry({ kind: 'read', tool: 'get_notebook_context' }), graph)).toMatchObject({
      notes: ['A', 'B', 'C'],
      target: { kind: 'context' },
      wave: true,
    });
  });

  it('lights the notes carrying the value a search names, and its value node', () => {
    expect(
      planOf(entry({ kind: 'read', tool: 'search_notes', query: 'status:aberta reunião' }), graph),
    ).toMatchObject({ notes: ['A', 'C'], values: ['status:aberta'], wave: false });
    expect(attributeTerms('tags:"em dia" -status:aberta palavra')).toEqual([
      { facet: 'tags', value: 'em dia' },
    ]);
  });

  it('lights the table, the dashboard and the file a tool names, by name or identifier (#502)', () => {
    expect(
      planOf(entry({ kind: 'write', tool: 'insert_rows', table: 'gastos' }), graph),
    ).toMatchObject({ notes: ['table/T1'], target: { kind: 'table', name: 'Gastos' } });
    expect(planOf(entry({ kind: 'read', tool: 'query_table', table: 't1' }), graph)?.notes).toEqual(
      ['table/T1'],
    );
    // Reading a dashboard reads the tables it draws from.
    expect(
      planOf(entry({ kind: 'read', tool: 'read_dashboard', dashboard: 'Painel' }), graph),
    ).toMatchObject({
      notes: ['dashboard/D1', 'table/T1'],
      target: { kind: 'dashboard', name: 'Painel' },
    });
    expect(planOf(entry({ kind: 'read', tool: 'read_file', fileId: 'F1' }), graph)).toMatchObject({
      notes: ['file/F1'],
      target: { kind: 'file', name: 'curva.png' },
    });
    expect(planOf(entry({ kind: 'read', tool: 'list_tables' }), graph)?.notes).toEqual([
      'table/T1',
    ]);
    // One the graph does not hold is said, and lights nothing.
    expect(
      planOf(entry({ kind: 'read', tool: 'query_table', table: 'Outra' }), graph),
    ).toMatchObject({ notes: [], target: { kind: 'table' } });
  });

  it('names an assistant by its connector and its person', () => {
    expect(assistantOf(entry({ kind: 'read' }))).toEqual({
      key: 'u1|Claude',
      name: 'Claude · Heitor',
    });
  });

  it('lights only the notes a search found, in its order, and the value it names (#506)', () => {
    expect(
      planOf(
        entry({
          kind: 'read',
          tool: 'search_notes',
          query: 'status:aberta reunião',
          noteIds: ['C', 'Z'],
        }),
        graph,
      ),
    ).toMatchObject({ notes: ['C'], values: ['status:aberta'], wave: false });
    expect(
      planOf(entry({ kind: 'read', tool: 'search_notes', query: 'nada', noteIds: [] }), graph),
    ).toMatchObject({ notes: [], wave: false, target: { kind: 'search', query: 'nada' } });
  });

  it('says a listing of tables, dashboards or files as the whole of them', () => {
    expect(planOf(entry({ kind: 'read', tool: 'list_files' }), graph)).toMatchObject({
      notes: ['file/F1'],
      target: { kind: 'files' },
    });
    expect(planOf(entry({ kind: 'read', tool: 'list_dashboards' }), graph)?.target).toEqual({
      kind: 'dashboards',
    });
  });
});
