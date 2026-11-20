import type { GraphActivityDto } from '../../shared/api/backend';
import type { GraphContext } from './activity';

/**
 * The simulated activity of a notebook, on staging alone (#503): three
 * assistants working at once, so what the graph draws for the agents can be
 * shown without driving three of them by hand. Every event is built as the
 * activity route answers it, and lands on something the notebook holds; none
 * is sent anywhere.
 */

/** The assistants of the simulation, with fictitious persons. */
export const SIMULATED_ASSISTANTS = [
  { userId: 'simulated-claude', client: 'Claude', person: 'Ana' },
  { userId: 'simulated-grok', client: 'Grok', person: 'Bruno' },
  { userId: 'simulated-chatgpt', client: 'ChatGPT', person: 'Carla' },
] as const;

export type SimulatedAssistant = (typeof SIMULATED_ASSISTANTS)[number];

/** How long an assistant waits between two events, at least and at most. */
export const SIMULATED_STEP_MS = { min: 1_000, max: 3_000 } as const;

/** What one event of an assistant is: the entries it records. */
export interface SimulatedEvent {
  readonly entries: readonly GraphActivityDto[];
}

type Note = GraphContext['notes'][number];

function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items.length === 0 ? undefined : items[Math.floor(random() * items.length)];
}

/** Every value each attribute takes in the notebook. */
function valuesByAttribute(notes: readonly Note[]): Map<string, string[]> {
  const values = new Map<string, Set<string>>();
  for (const note of notes) {
    for (const [facet, list] of Object.entries(note.facets)) {
      const held = values.get(facet) ?? new Set<string>();
      for (const value of list) held.add(value);
      values.set(facet, held);
    }
  }
  return new Map([...values].map(([facet, held]) => [facet, [...held]]));
}

/**
 * One event of one assistant, drawn at random among those the notebook can
 * answer: a read of a note, of a folder, a search by text or by a value, the
 * context, a write that changes a property to a value the notebook already
 * uses, and a read or a write of a table, a dashboard or a file.
 */
export function simulatedEvent(
  graph: GraphContext,
  who: SimulatedAssistant,
  random: () => number,
  sequence: number,
  at: Date = new Date(),
): SimulatedEvent | null {
  const entry = (rest: Partial<GraphActivityDto>): GraphActivityDto => ({
    id: `simulated-${sequence}`,
    at: at.toISOString(),
    kind: 'read',
    who: { ...who },
    ...rest,
  });
  const notes = graph.notes;
  const values = valuesByAttribute(notes);
  const folders = [...new Set(notes.map((note) => note.folderId).filter(Boolean))];
  const tables = graph.tables ?? [];
  const dashboards = graph.dashboards ?? [];
  const files = graph.files ?? [];

  const choices: Array<{ weight: number; make: () => SimulatedEvent | null }> = [
    {
      weight: notes.length ? 4 : 0,
      make: () => {
        const note = pick(notes, random);
        const tool = pick(['read_note', 'backlinks', 'related_notes', 'note_history'], random);
        return note && tool ? { entries: [entry({ tool, noteId: note.id })] } : null;
      },
    },
    {
      weight: folders.length ? 2 : 0,
      make: () => {
        const folderId = pick(folders, random);
        return folderId ? { entries: [entry({ tool: 'list_notes', folderId })] } : null;
      },
    },
    {
      weight: notes.length ? 1 : 0,
      make: () => {
        const words = pick(notes, random)
          ?.name.split(/\s+/)
          .filter((word) => word.length > 3);
        const word = words ? pick(words, random) : undefined;
        if (!word) return null;
        // What a search by text found: the notes whose name holds the word (#506).
        const found = notes
          .filter((note) => note.name.toLowerCase().includes(word.toLowerCase()))
          .map((note) => note.id);
        return { entries: [entry({ tool: 'search_notes', query: word, noteIds: found })] };
      },
    },
    {
      weight: values.size ? 2 : 0,
      make: () => {
        const facet = pick([...values.keys()], random);
        const value = facet ? pick(values.get(facet) ?? [], random) : undefined;
        if (!facet || !value) return null;
        const term = /\s/.test(value) ? `${facet}:"${value}"` : `${facet}:${value}`;
        const found = notes
          .filter((note) => (note.facets[facet] ?? []).includes(value))
          .map((note) => note.id);
        return { entries: [entry({ tool: 'search_notes', query: term, noteIds: found })] };
      },
    },
    {
      weight: notes.length ? 0.5 : 0,
      make: () => ({ entries: [entry({ tool: 'get_notebook_context' })] }),
    },
    {
      weight: notes.length ? 3 : 0,
      make: () => {
        // A write is drawn one way whatever it changed (#504).
        const note = pick(notes, random);
        return note
          ? { entries: [entry({ kind: 'write', tool: 'update_note', noteId: note.id })] }
          : null;
      },
    },
    {
      weight: tables.length ? 2 : 0,
      make: () => {
        const table = pick(tables, random);
        const write = random() < 0.35;
        return table
          ? {
              entries: [
                entry({
                  kind: write ? 'write' : 'read',
                  tool: write ? 'insert_rows' : 'query_table',
                  table: table.name,
                }),
              ],
            }
          : null;
      },
    },
    {
      weight: dashboards.length ? 2 : 0,
      make: () => {
        const dashboard = pick(dashboards, random);
        return dashboard
          ? { entries: [entry({ tool: 'read_dashboard', dashboard: dashboard.name })] }
          : null;
      },
    },
    {
      weight: files.length ? 1.5 : 0,
      make: () => {
        const file = pick(files, random);
        return file ? { entries: [entry({ tool: 'read_file', fileId: file.id })] } : null;
      },
    },
    {
      weight: tables.length || files.length ? 0.5 : 0,
      make: () => ({
        entries: [entry({ tool: tables.length && random() < 0.5 ? 'list_tables' : 'list_files' })],
      }),
    },
  ];

  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  if (total === 0) return null;
  let roll = random() * total;
  for (const choice of choices) {
    roll -= choice.weight;
    if (roll < 0 && choice.weight > 0) return choice.make();
  }
  return null;
}

/** How long an assistant waits before its next event. */
export function simulatedDelay(random: () => number): number {
  return SIMULATED_STEP_MS.min + random() * (SIMULATED_STEP_MS.max - SIMULATED_STEP_MS.min);
}
