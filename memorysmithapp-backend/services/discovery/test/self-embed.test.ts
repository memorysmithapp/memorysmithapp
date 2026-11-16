/**
 * An embed never reaches the note it is written in (#472, RN-DSC-067, §5.2).
 *
 * A note named `foto.jpg` embedding `![[foto.jpg]]` beside a file `foto.jpg`
 * shows the file: the page draws it, and the graph has to say so, or
 * `check_notebook` lists the file as shown by nobody. The history is played
 * through the projector, which is what decides the order of the writes, and
 * against the graph in memory, which is the reference, and the DynamoDB one,
 * which has to agree with it.
 */

import { describe, expect, it } from 'vitest';
import {
  InMemoryContentIndex,
  InMemoryFacetIndex,
  InMemoryLinkGraph,
  InMemoryProjectedVersions,
  InMemoryStructureProjection,
} from '../src/adapters/memory.js';
import {
  DynamoContentIndex,
  DynamoFacetIndex,
  DynamoLinkGraph,
  DynamoProjectedVersions,
  DynamoStructureProjection,
} from '../src/adapters/aws.js';
import { ProjectNote, type ProjectionDependencies } from '../src/application/projections.js';
import type { LinkGraph } from '../src/domain/ports.js';
import { dynamoTable } from './dynamo-table.js';

const NOTEBOOK = 'notebook-1';
const SUBSCRIPTION = { value: 'SUB' } as never;

type Dependencies = Omit<ProjectionDependencies, 'content'>;

function inMemory(): Dependencies {
  return {
    graph: new InMemoryLinkGraph(),
    facets: new InMemoryFacetIndex(),
    index: new InMemoryContentIndex(),
    structure: new InMemoryStructureProjection(),
    versions: new InMemoryProjectedVersions(),
  };
}

function inDynamo(): Dependencies {
  const { db } = dynamoTable();
  return {
    graph: new DynamoLinkGraph(SUBSCRIPTION, db as never, 't'),
    facets: new DynamoFacetIndex(SUBSCRIPTION, db as never, 't'),
    index: new DynamoContentIndex(SUBSCRIPTION, db as never, 't'),
    structure: new DynamoStructureProjection(SUBSCRIPTION, db as never, 't'),
    versions: new DynamoProjectedVersions(SUBSCRIPTION, db as never, 't'),
  };
}

/** A notebook whose notes are written and deleted through the projector. */
function notebook(dependencies: Dependencies) {
  const content = new Map<string, string>();
  const versions = new Map<string, number>();
  const project = new ProjectNote({
    ...dependencies,
    content: { read: async (ref) => content.get(ref.versionId) ?? '' },
  });
  const next = (noteId: string): number => {
    const version = (versions.get(noteId) ?? 0) + 1;
    versions.set(noteId, version);
    return version;
  };
  return {
    graph: dependencies.graph,
    write: async (noteId: string, markdown: string) => {
      const version = next(noteId);
      content.set(`v${noteId}${version}`, markdown);
      await project.project({
        kind: 'written',
        notebookId: NOTEBOOK,
        noteId,
        folderId: 'f1',
        contentRef: { contentId: `c${noteId}`, versionId: `v${noteId}${version}` },
        version,
      });
    },
    remove: async (noteId: string) => {
      await project.project({
        kind: 'deleted',
        notebookId: NOTEBOOK,
        noteId,
        folderId: 'f1',
        contentRef: null,
        version: next(noteId),
      });
    },
  };
}

/** What the notebook's health and the note's links say, in a shape both graphs agree on. */
async function health(graph: LinkGraph, noteId: string) {
  return {
    outgoing: (await graph.outgoingOf(NOTEBOOK, noteId))
      .map((each) => `${each.target}:${each.kind}:${each.notes.map((n) => n.noteId).join(',')}`)
      .sort(),
    pending: (await graph.pending(NOTEBOOK))
      .map((each) => `${each.fromNote.noteId}->${each.targetName}`)
      .sort(),
    unshown: (await graph.unshownAttachments(NOTEBOOK)).sort(),
  };
}

const FOTO = '---\nname: foto.jpg\n---\n![[foto.jpg]]\n';

describe.each([
  ['the graph in memory', inMemory],
  ['the DynamoDB graph over a table in memory', inDynamo],
])('%s: an embed never reaches its own note (#472, RN-DSC-067)', (_label, open) => {
  it('shows the file of its own name, and leaves nothing pending', async () => {
    const { graph, write } = notebook(open());
    await graph.keepAttachment(NOTEBOOK, 'foto.jpg');
    await write('n1', FOTO);

    expect(await health(graph, 'n1')).toEqual({
      outgoing: ['foto.jpg:attachment:'],
      pending: [],
      unshown: [],
    });
  });

  it('is pending when the notebook keeps no file of that name', async () => {
    const { graph, write } = notebook(open());
    await write('n1', FOTO);

    expect(await health(graph, 'n1')).toEqual({
      outgoing: ['foto.jpg:pending:'],
      pending: ['n1->foto.jpg'],
      unshown: [],
    });
  });

  it('reaches another note of the name first, and the file again once it is gone', async () => {
    const { graph, write, remove } = notebook(open());
    await graph.keepAttachment(NOTEBOOK, 'foto.jpg');
    await write('n1', FOTO);
    await write('n2', '---\nname: foto.jpg\n---\nAnother note named foto.jpg.\n');

    expect(await health(graph, 'n1')).toEqual({
      outgoing: ['foto.jpg:note:n2'],
      pending: [],
      unshown: ['foto.jpg'],
    });
    expect((await graph.backlinks(NOTEBOOK, 'n2')).map((each) => each.noteId)).toEqual(['n1']);

    await remove('n2');
    expect(await health(graph, 'n1')).toEqual({
      outgoing: ['foto.jpg:attachment:'],
      pending: [],
      unshown: [],
    });
  });

  it('tries no alias when the note alone carries the name', async () => {
    const { graph, write } = notebook(open());
    await graph.keepAttachment(NOTEBOOK, 'foto.jpg');
    await write('n1', FOTO);
    await write('n2', '---\nname: Galeria\naliases: [foto.jpg]\n---\n');

    expect(await health(graph, 'n1')).toEqual({
      outgoing: ['foto.jpg:attachment:'],
      pending: [],
      unshown: [],
    });
    expect(await graph.backlinks(NOTEBOOK, 'n2')).toEqual([]);
  });

  it('leaves its own alias for the file, and a link to its own section is no pending link', async () => {
    const { graph, write } = notebook(open());
    await graph.keepAttachment(NOTEBOOK, 'obra.jpg');
    await write(
      'n1',
      '---\nname: Foto da obra\naliases: [obra.jpg]\n---\n![[obra.jpg]]\n\nVer [[Foto da obra#Fachada]].\n',
    );

    const answered = await health(graph, 'n1');
    expect(answered.outgoing).toContain('obra.jpg:attachment:');
    expect(answered.pending).toEqual([]);
    expect(answered.unshown).toEqual([]);
  });
});
