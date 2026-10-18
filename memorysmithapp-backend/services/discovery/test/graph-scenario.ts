/**
 * One history of a notebook, played against a link graph, with what the graph
 * answers after each step (#327, #328).
 *
 * The same history runs against a partition in the layout of 0.13 — read whole,
 * written whole — and against one in the layout of #328, read by the note and
 * written by the difference, and the two must answer the same after every
 * step. It is written once, here, so the unit tests over a table in memory and
 * the adapter tests over the DynamoDB of staging play the same notebook.
 */

import type { DynamoLinkGraph } from '../src/adapters/aws.js';
import type { LinkTarget, NoteRef } from '../src/domain/ports.js';

const ref = (noteId: string, name: string, aliases: string[] = []): NoteRef => ({
  noteId,
  name,
  aliases,
  folderId: 'f1',
});
const link = (name: string): LinkTarget => ({ name, anchor: null, form: 'link' });
const embed = (name: string): LinkTarget => ({ name, anchor: null, form: 'embed' });
const image = (name: string): LinkTarget => ({ name, anchor: null, form: 'image' });

export const SCENARIO_NOTES = ['n1', 'n2', 'n3', 'n4', 'n5'] as const;

/** Everything a reader of the graph can ask about these notes, in a stable shape. */
export async function answersOf(
  graph: DynamoLinkGraph,
  notebookId: string,
  noteIds: readonly string[] = SCENARIO_NOTES,
): Promise<unknown> {
  const known = new Set(noteIds);
  const whole = await graph.wholeGraph(notebookId);
  const ids = whole.nodes.map((node) => node.noteId);
  return {
    outgoing: await Promise.all(
      noteIds.map(async (noteId) =>
        (await graph.outgoingOf(notebookId, noteId))
          .map(
            (each) =>
              `${noteId}:${each.target}:${each.kind}:${each.by}:${each.notes
                .map((note) => `${note.noteId}/${note.name}`)
                .join(',')}`,
          )
          .sort(),
      ),
    ),
    backlinks: await Promise.all(
      noteIds.map(async (noteId) =>
        (await graph.backlinks(notebookId, noteId)).map((each) => each.noteId).sort(),
      ),
    ),
    pending: (await graph.pending(notebookId))
      .map((each) => `${each.fromNote.noteId}->${each.targetName}`)
      .sort(),
    edges: whole.edges.map(([from, to]) => `${ids[from]}->${ids[to]}`).sort(),
    nodes: ids.filter((id) => known.has(id)).sort(),
    uses: (await graph.attachmentUses(notebookId))
      .map((use) => `${use.name}<-${use.notes.map((each) => each.noteId).sort()}`)
      .sort(),
  };
}

/**
 * The history: links by name, by alias and to nothing, an embed and an image
 * of files kept and not, a note that keeps its links, one that changes them,
 * an alias taken back by a name, a deletion that lands a link on an alias, a
 * rename, and a file deleted. Each step is what the projector does with a
 * write: the targets replaced, then what was waiting resolved.
 */
export async function playScenario(
  graph: DynamoLinkGraph,
  notebookId: string,
  after: (step: string) => Promise<void>,
): Promise<void> {
  const write = async (note: NoteRef, links: LinkTarget[]): Promise<void> => {
    await graph.replaceOutgoing(notebookId, note, links);
    await graph.resolvePending(notebookId, note);
  };
  const achado = [
    link('Lei 14.133'),
    link('LGL'),
    link('Parecer'),
    embed('curva.png'),
    image('capa.jpg'),
    link('Ninguém ainda'),
  ];

  await write(ref('n1', 'Achado'), achado);
  await after('a note whose every target waits');
  await graph.keepAttachment(notebookId, 'curva.png');
  await after('a file kept');
  await write(ref('n2', 'Lei 14.133', ['LGL']), []);
  await after('the source, by its name and its alias');
  await write(ref('n3', 'Parecer'), [link('Achado')]);
  await after('a note linking back');
  await write(ref('n1', 'Achado'), achado);
  await after('an update that keeps every link');
  await write(ref('n1', 'Achado', ['Descoberta']), [
    ...achado.filter((target) => target.name !== 'Parecer'),
    link('Decreto'),
    embed('capa.jpg'),
  ]);
  await after('an update that changes its links and its aliases');
  await write(ref('n4', 'Antiga', ['Decreto']), [link('Descoberta')]);
  await after('a spelling that answers a waiting link');
  await write(ref('n5', 'Decreto'), []);
  await after('a name that takes the link back from the spelling');
  await graph.removeNote(notebookId, 'n5');
  await after('a deletion that lands the link on the spelling again');
  await write(ref('n2', 'Lei nova', ['LGL']), []);
  await write(ref('n1', 'Achado', ['Descoberta']), [
    ...achado.filter((target) => target.name !== 'Parecer'),
    link('Decreto'),
    embed('capa.jpg'),
  ]);
  await after('a rename, and the note linking to it written again');
  await graph.removeNote(notebookId, 'n2');
  await after('a deletion');
  await graph.forgetAttachment(notebookId, 'curva.png');
  await after('a file deleted');
}

/** A note of the layout of 0.13, which keeps a partition from being marked. */
export const LEGACY_NOTE = {
  SK: 'NOTE#n0',
  entity: 'GNOTE',
  noteId: 'n0',
  name: '',
  aliases: [],
  folderId: 'f1',
};

/** The keys of the layout both partitions share: what 0.13 wrote, and nothing of #328. */
export function sharedKeys(keys: readonly string[]): string[] {
  return keys.filter((sk) => !/^(FROM#|NAME#|GRAPH$)/.test(sk) && sk !== LEGACY_NOTE.SK);
}
