/**
 * What a note naming a file reaches, by the form it named it in (#305,
 * RN-DSC-065), and which notes show each kept file (#307, RN-DSC-066).
 *
 * The same cases run against the in-memory graph, which is the reference, and
 * against the DynamoDB one after a delivery of staging, which has to agree with
 * it: they are written once, here, so the two cannot drift apart.
 */

import { describe, expect, it } from 'vitest';
import type { LinkGraph, NoteRef } from '../src/domain/ports.js';

const note = (noteId: string, name: string): NoteRef => ({
  noteId,
  name,
  aliases: [],
  folderId: 'f1',
});

const image = (name: string) => ({ name, anchor: null, form: 'image' as const });
const embed = (name: string) => ({ name, anchor: null, form: 'embed' as const });
const link = (name: string) => ({ name, anchor: null, form: 'link' as const });

/** What a graph answers about one file, in a shape two adapters agree on. */
async function answers(graph: LinkGraph, notebookId: string, noteId: string) {
  const uses = await graph.attachmentUses(notebookId);
  return {
    outgoing: (await graph.outgoingOf(notebookId, noteId))
      .map((each) => `${each.target}:${each.kind}`)
      .sort(),
    pending: (await graph.pending(notebookId))
      .map((each) => `${each.fromNote.noteId}->${each.targetName}`)
      .sort(),
    unshown: (await graph.unshownAttachments(notebookId)).sort(),
    uses: uses
      .map(
        (use) =>
          `${use.name}<-${use.notes
            .map((each) => each.noteId)
            .sort()
            .join(',')}`,
      )
      .sort(),
  };
}

export function describeAttachmentForms(
  label: string,
  open: () => { graph: LinkGraph; notebookId: string },
): void {
  describe(`${label}: a file named by an image, an embed and a link (#305, #307)`, () => {
    it('reaches the kept file by an image by path, and the file is shown by that note', async () => {
      const { graph, notebookId } = open();
      await graph.keepAttachment(notebookId, 'curva.png');
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [image('curva.png')]);

      expect(await answers(graph, notebookId, 'n1')).toEqual({
        outgoing: ['curva.png:attachment'],
        pending: [],
        unshown: [],
        uses: ['curva.png<-n1'],
      });
    });

    it('is pending while the file is not kept, and a note carrying the name never takes it', async () => {
      const { graph, notebookId } = open();
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [image('curva.png')]);
      await graph.replaceOutgoing(notebookId, note('n2', 'curva.png'), []);
      await graph.resolvePending(notebookId, note('n2', 'curva.png'));

      expect(await graph.backlinks(notebookId, 'n2')).toEqual([]);
      expect(await answers(graph, notebookId, 'n1')).toEqual({
        outgoing: ['curva.png:pending'],
        pending: ['n1->curva.png'],
        unshown: [],
        uses: [],
      });
    });

    it('leaves a plain link of a kept file pending, and the file shown by nobody', async () => {
      const { graph, notebookId } = open();
      await graph.keepAttachment(notebookId, 'curva.png');
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [link('curva.png')]);

      expect(await answers(graph, notebookId, 'n1')).toEqual({
        outgoing: ['curva.png:pending'],
        pending: ['n1->curva.png'],
        unshown: ['curva.png'],
        uses: ['curva.png<-'],
      });
    });

    it('answers a file a note links, embeds and draws as one target, shown once', async () => {
      const { graph, notebookId } = open();
      await graph.keepAttachment(notebookId, 'curva.png');
      await graph.keepAttachment(notebookId, 'fonte.pdf');
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [
        link('curva.png'),
        image('curva.png'),
        embed('fonte.pdf'),
      ]);
      await graph.replaceOutgoing(notebookId, note('n2', 'Anexo'), [image('fonte.pdf')]);

      expect(await answers(graph, notebookId, 'n1')).toEqual({
        outgoing: ['curva.png:attachment', 'fonte.pdf:attachment'],
        pending: ['n1->curva.png'],
        unshown: [],
        uses: ['curva.png<-n1', 'fonte.pdf<-n1,n2'],
      });
    });

    it('forgets what a deleted note showed, and what a rewrite stopped showing', async () => {
      const { graph, notebookId } = open();
      await graph.keepAttachment(notebookId, 'curva.png');
      await graph.keepAttachment(notebookId, 'capa.jpg');
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [
        image('curva.png'),
        image('capa.jpg'),
      ]);
      await graph.replaceOutgoing(notebookId, note('n1', 'Relatório'), [image('curva.png')]);
      expect((await answers(graph, notebookId, 'n1')).uses).toEqual([
        'capa.jpg<-',
        'curva.png<-n1',
      ]);

      await graph.removeNote(notebookId, 'n1');
      expect((await answers(graph, notebookId, 'n1')).unshown).toEqual(['capa.jpg', 'curva.png']);
    });
  });
}
