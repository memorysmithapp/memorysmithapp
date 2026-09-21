/**
 * The address of an attachment, across the parser (#173).
 *
 * `resolveWikilinks` writes `attachment:<name>|<dimension>` and `MarkdownAnchor`
 * reads it back, and between the two stands **react-markdown**, which
 * percent-encodes a destination. That seam is what the unit case of the
 * resolver cannot see: it asserted the string that goes in, the anchor asserts
 * the props that come out, and the encoding in the middle belonged to neither.
 *
 * It shipped a regression exactly there — the separator arrived as `%7C`, the
 * split found no pipe, and the whole string went looking for a file called
 * `picture.svg|120`, which no notebook keeps. Every embed that asked for a
 * size disappeared from the page and was reported as a file that is not there.
 *
 * A file the notebook does NOT keep is what these cases use on purpose: it is
 * the one branch that renders without waiting for a link to be minted, and the
 * name it prints is exactly what the address decoded to.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

vi.stubGlobal('localStorage', memoryStorage());
vi.stubGlobal('matchMedia', () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

let render: (markdown: string) => string;

beforeAll(async () => {
  await import('../../i18n');
  const { Markdown } = await import('./Markdown');
  const { NotebookIdProvider } = await import('./notebook-id');

  render = (markdown: string): string =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          {/* The surface is drawn inside a notebook, which is what makes an
              address of a file resolvable at all. */}
          <NotebookIdProvider notebookId="01J8X2K9QZ3M4N5P6R7S8T9V0A">
            <Markdown>{markdown}</Markdown>
          </NotebookIdProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, 30_000);

/** What the missing-file span printed, which is the name the address decoded to. */
function nameShown(html: string): string {
  const found = /class="attachment-missing"[^>]*>([^<]*)</.exec(html);
  return found?.[1] ?? '';
}

describe('the dimension survives the parser, and the name arrives whole', () => {
  it('takes the dimension off the address and leaves the name', () => {
    expect(nameShown(render('[x](attachment:engelbart.jpg|120)'))).toBe('engelbart.jpg');
    expect(nameShown(render('[x](attachment:engelbart.jpg|100x145)'))).toBe('engelbart.jpg');
  });

  it('keeps a name that has no dimension after it exactly as it is', () => {
    expect(nameShown(render('[x](attachment:engelbart.jpg)'))).toBe('engelbart.jpg');
  });

  it('decodes a name the parser had to encode, spaces and accents included', () => {
    const encoded = encodeURIComponent('esquema de blocos');
    expect(nameShown(render(`[x](attachment:${encoded}|80)`))).toBe('esquema de blocos');
    expect(nameShown(render(`[x](attachment:${encodeURIComponent('diagrama é isso')})`))).toBe(
      'diagrama é isso',
    );
  });

  it('leaves a value that is not a dimension inside the name, applying nothing', () => {
    // `100x` is not a dimension, so there is nothing to take off: what remains
    // is a name, and the notebook keeps nothing under it.
    expect(nameShown(render('[x](attachment:engelbart.jpg|grande)'))).toBe('engelbart.jpg|grande');
  });
});
