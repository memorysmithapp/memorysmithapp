import { describe, expect, it } from 'vitest';
import { planOf, type GraphContext } from './activity';
import { SIMULATED_ASSISTANTS, simulatedDelay, simulatedEvent } from './simulation';

const graph: GraphContext = {
  notes: [
    { id: 'A', name: 'Projeto Atlas', folderId: 'P', facets: { status: ['aberta'] } },
    { id: 'B', name: 'Reunião de equipe', folderId: 'R', facets: { status: ['concluída'] } },
  ],
  folderName: (id) => ({ P: 'Projetos', R: 'Reuniões' })[id] ?? null,
  tables: [{ id: 'T1', name: 'Gastos' }],
  dashboards: [{ id: 'D1', name: 'Painel', tables: ['T1'] }],
  files: [{ id: 'F1', name: 'curva.png' }],
};

/** A generator that answers the same numbers for the same seed. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('the simulation of several agents (#503)', () => {
  it('builds events that land on what the notebook holds, from the three assistants', () => {
    const random = seeded(7);
    const tools = new Set<string>();
    for (let sequence = 0; sequence < 400; sequence += 1) {
      const who = SIMULATED_ASSISTANTS[sequence % SIMULATED_ASSISTANTS.length]!;
      const event = simulatedEvent(graph, who, random, sequence);
      expect(event).not.toBeNull();
      for (const entry of event!.entries) {
        expect(entry.who).toEqual(who);
        tools.add(entry.tool ?? '');
        const plan = planOf(entry, graph);
        expect(plan).not.toBeNull();
        if (entry.tool !== 'list_files' && entry.tool !== 'list_tables') {
          expect(plan!.notes.length + plan!.values.length).toBeGreaterThan(0);
        }
      }
      for (const entry of event!.entries) {
        // A search says the notes it found, which the notebook holds (#506).
        if (entry.tool === 'search_notes') {
          expect(entry.noteIds?.every((id) => ['A', 'B'].includes(id))).toBe(true);
        }
        expect(entry.kind).not.toBe('projected');
      }
    }
    for (const tool of [
      'read_note',
      'list_notes',
      'search_notes',
      'update_note',
      'query_table',
      'read_dashboard',
      'read_file',
    ]) {
      expect(tools).toContain(tool);
    }
  });

  it('names Claude, Grok and ChatGPT with fictitious persons, and waits one to three seconds', () => {
    expect(SIMULATED_ASSISTANTS.map((each) => `${each.client} · ${each.person}`)).toEqual([
      'Claude · Ana',
      'Grok · Bruno',
      'ChatGPT · Carla',
    ]);
    expect(simulatedDelay(() => 0)).toBe(1_000);
    expect(simulatedDelay(() => 0.999999)).toBeLessThan(3_000);
  });

  it('says nothing for a notebook that holds nothing', () => {
    expect(
      simulatedEvent(
        { notes: [], folderName: () => null },
        SIMULATED_ASSISTANTS[0],
        Math.random,
        1,
      ),
    ).toBeNull();
  });
});
