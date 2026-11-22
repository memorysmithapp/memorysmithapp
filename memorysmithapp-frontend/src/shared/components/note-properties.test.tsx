/**
 * A note's properties where the renderer places them (#530, RN-KNW-096): the
 * page hands the parts, the note's `properties` block or else the notebook's
 * style chooses which keys go where, under what title.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_NOTEBOOK_STYLE, type NotebookStyle } from '@memorysmithapp/contracts';
import { queryKeys } from '../api/query-keys';
import { chosenProperties } from './PropertiesBox';

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
});
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const PROPERTIES = [
  ['tags', 'obra'],
  ['status', 'aprovada'],
  ['data', '2026-11-20'],
  ['responsavel', 'Síndico'],
] as const;

let render: (markdown: string, style?: Partial<NotebookStyle>) => string;

beforeAll(async () => {
  await import('../../i18n');
  const { NoteContent } = await import('./NoteContent');
  render = (markdown, style) => {
    const client = new QueryClient();
    // The notebook's style, as the structure every page of a notebook reads.
    client.setQueryData(queryKeys.notebookStructure(NOTEBOOK), {
      style: { ...DEFAULT_NOTEBOOK_STYLE, ...style },
    });
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <NoteContent
            raw={markdown}
            notebookId={NOTEBOOK}
            baseRevision={null}
            writable={false}
            write={() => Promise.resolve('rev-2')}
            invalidates={queryKeys.note(NOTEBOOK, 'unused')}
            header={{
              title: <h1 className="note-title">Ata de novembro</h1>,
              properties: PROPERTIES,
              lists: new Set(['tags']),
              notebookId: NOTEBOOK,
            }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };
}, 30_000);

const NOTE =
  '---\nname: Ata de novembro\ntags: [obra]\nstatus: aprovada\ndata: 2026-11-20\nresponsavel: Síndico\n---\nResumo da reunião.\n';
const keysOf = (html: string) =>
  [...html.matchAll(/class="metadata-property-key">([^<]+)</g)].map((match) => match[1]);
/** What the screen shows: a drawing the renderer marks for print alone is hidden there. */
const onScreen = (html: string) =>
  html.replace(/<div data-media="print">.*?<\/details><\/div><\/div>/gs, '');

describe("a note's properties, placed by the renderer (#530)", () => {
  it('are drawn whole under the name when nothing says otherwise', () => {
    const html = render(NOTE);
    expect(html).toContain('<h1 class="note-title">Ata de novembro</h1>');
    expect(keysOf(html)).toHaveLength(4);
  });

  it("are the keys a note's block names, in its order, under its title, where it stands", () => {
    const html = render(
      `${NOTE}\n\`\`\`properties\nkeys: responsavel, status, local\ntitle: Registro\n\`\`\`\n`,
    );
    expect(html).toContain('<h1 class="note-title">Ata de novembro</h1>');
    expect(html).toContain('<summary>Registro</summary>');
    expect(keysOf(html)).toEqual([
      expect.stringMatching(/respons/i),
      expect.stringMatching(/status|situa/i),
    ]);
    // Drawn where the block is written: after the summary of the meeting.
    expect(html.indexOf('Resumo da reunião.')).toBeLessThan(html.indexOf('Registro'));
  });

  it("are the notebook's choice for a note with no block, and nothing when it draws none", () => {
    const chosen = render(NOTE, { properties: { keys: ['data'], title: 'Datas', fold: 'closed' } });
    expect(keysOf(chosen)).toHaveLength(1);
    expect(chosen).toContain('<summary>Datas</summary>');
    expect(chosen).not.toContain('<details class="properties-box" open');
    const none = render(NOTE, { properties: { screen: 'none' } });
    expect(none).toContain('<h1 class="note-title">Ata de novembro</h1>');
    expect(keysOf(onScreen(none))).toEqual([]);
    expect(none).toContain('<div data-media="print"><div class="note-properties">');
  });

  it('follows the block over the notebook, the block saying none', () => {
    const html = render(`${NOTE}\n\`\`\`properties\nscreen: none\n\`\`\`\n`, {
      properties: { keys: ['data'] },
    });
    expect(keysOf(onScreen(html))).toEqual([]);
  });
});

describe('the properties the renderer chose (#530)', () => {
  it("keep the page's order when it chose them all, else its own, a key the note lacks absent", () => {
    expect(chosenProperties(PROPERTIES, ['responsavel', 'data', 'status', 'tags'])).toEqual(
      PROPERTIES,
    );
    expect(chosenProperties(PROPERTIES, ['Responsavel', 'prazo', 'status'])).toEqual([
      ['responsavel', 'Síndico'],
      ['status', 'aprovada'],
    ]);
  });
});
