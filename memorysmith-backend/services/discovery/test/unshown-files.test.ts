import { describe, expect, it } from 'vitest';
import { InMemoryLinkGraph } from '../src/adapters/memory.js';

const NOTEBOOK = '01JBQ2X00000000000000000V1';
const note = (noteId: string, name: string) => ({
  noteId,
  name,
  aliases: [],
  folderId: '01JBQ2X00000000000000000F1',
});

describe('the files a notebook keeps and no note names (#253, RN-DSC-064)', () => {
  it('are the kept files no link of any note reaches', async () => {
    const graph = new InMemoryLinkGraph();
    await graph.keepAttachment(NOTEBOOK, 'capa.jpg');
    await graph.keepAttachment(NOTEBOOK, 'figura-1-original.jpg');
    await graph.keepAttachment(NOTEBOOK, 'Sumário executivo.pdf');
    await graph.replaceOutgoing(NOTEBOOK, note('01JBQ2X00000000000000000N1', 'Resumo'), [
      { name: 'capa.jpg', anchor: null },
      { name: 'Sumário executivo.pdf'.normalize('NFD'), anchor: null },
      { name: 'Nota ainda por escrever', anchor: null },
    ]);
    expect(await graph.unshownAttachments(NOTEBOOK)).toEqual(['figura-1-original.jpg']);
  });

  it('forget a note that is gone, and the file it named is shown nowhere again', async () => {
    const graph = new InMemoryLinkGraph();
    await graph.keepAttachment(NOTEBOOK, 'capa.jpg');
    await graph.replaceOutgoing(NOTEBOOK, note('01JBQ2X00000000000000000N1', 'Resumo'), [
      { name: 'capa.jpg', anchor: null },
    ]);
    expect(await graph.unshownAttachments(NOTEBOOK)).toEqual([]);
    await graph.removeNote(NOTEBOOK, '01JBQ2X00000000000000000N1');
    expect(await graph.unshownAttachments(NOTEBOOK)).toEqual(['capa.jpg']);
  });
});
