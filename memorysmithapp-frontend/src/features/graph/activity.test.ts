import { describe, expect, it } from 'vitest';
import {
  assistantOf,
  attributeTerms,
  captionOf,
  planOf,
  slotFor,
  type GraphContext,
} from './activity';

const graph: GraphContext = {
  notes: [
    { id: 'A', name: 'Projeto Atlas', folderId: 'P', facets: { status: ['aberta'] } },
    { id: 'B', name: 'Ata 12', folderId: 'R', facets: { status: ['concluída'] } },
    { id: 'C', name: 'Ata 13', folderId: 'R', facets: { status: ['aberta'] } },
  ],
  folderName: (id) => ({ P: 'Projetos', R: 'Reuniões' })[id] ?? null,
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

  it("lights a folder's notes, and the whole notebook as a wave", () => {
    expect(planOf(entry({ kind: 'read', tool: 'list_notes', folderId: 'R' }), graph)).toMatchObject(
      {
        notes: ['B', 'C'],
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

  it('says tables, dashboards and files in the log alone, since they are no nodes', () => {
    expect(planOf(entry({ kind: 'write', tool: 'insert_rows' }), graph)).toMatchObject({
      notes: [],
      target: { kind: 'table' },
    });
  });

  it('takes a colour no attribute and no assistant holds, and one at random when none is free', () => {
    expect(slotFor([])).toBe(0);
    expect(slotFor([0, 2])).toBe(1);
    expect(slotFor([0, 1, 2], () => 0.9)).toBe(2);
    expect(slotFor([0, 1, 2], () => 0)).toBe(0);
  });

  it('names an assistant by its connector and its person, and says what a write changed', () => {
    expect(assistantOf(entry({ kind: 'read' }))).toEqual({
      key: 'u1|Claude',
      name: 'Claude · Heitor',
    });
    expect(
      captionOf(
        entry({
          kind: 'projected',
          added: [
            { facet: 'status', value: 'concluída' },
            { facet: 'tags', value: 'urgente' },
          ],
          removed: [{ facet: 'status', value: 'aberta' }],
        }),
      ),
    ).toBe('status: aberta → concluída · tags: + urgente');
  });
});
