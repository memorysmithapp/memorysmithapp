/**
 * The task box, which is the first write the web interface makes.
 *
 * It did not work on any note, in any notebook, and the cause was one line:
 * `TaskItem` decided with `node.checked`, and react-markdown 9 hands a
 * component the **hast** element, which has no such property. Every item fell
 * through to the plain branch and reached the screen as GFM's own checkbox,
 * rendered `disabled`, with no handler on it — so a click did nothing at all,
 * which is exactly how it was reported (#54).
 *
 * These render to static markup rather than through a DOM, which is enough for
 * what broke: whether the box is ours, whether it is enabled, and whether the
 * state written in the source is the state on screen. The write behind a click
 * has its own tests in `tasklist.test.ts`, over the same bytes.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';

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

let render: (markdown: string, writable?: boolean) => string;

/**
 * The hook loads the whole i18n bundle and the markdown pipeline before the
 * first case, which on a cold or busy machine takes longer than the ten
 * seconds vitest allows a hook by default. The work is the same; what changes
 * is how long the suite is willing to wait for it.
 */
const LOADING_THE_PIPELINE_MS = 30_000;

beforeAll(async () => {
  await import('../../i18n');
  const { WritableContent } = await import('./WritableContent');

  render = (markdown: string, writable = true): string =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <WritableContent
            raw={markdown}
            notebookId="01J8X2K9QZ3M4N5P6R7S8T9V0A"
            baseRevision="rev-1"
            writable={writable}
            write={() => Promise.resolve('rev-2')}
            invalidates={queryKeys.note('01J8X2K9QZ3M4N5P6R7S8T9V0A', 'unused-by-this-case')}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, LOADING_THE_PIPELINE_MS);

const CHECKLIST = '- [ ] Read the act\n- [x] Summarise article 75\n';

describe('a task box is ours, and it answers', () => {
  it('renders our item and not the one GFM leaves behind', () => {
    const html = render(CHECKLIST);

    expect((html.match(/class="[^"]*task-item[^"]*"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('disabled=""');
  });

  it('renders exactly one box per item', () => {
    // Ours plus the one GFM already put in the children would be two boxes in
    // one line, which is worse than the defect it replaced.
    expect((render(CHECKLIST).match(/type="checkbox"/g) ?? []).length).toBe(2);
  });

  it('shows the state the source was written in, both ways round', () => {
    const html = render(CHECKLIST);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  });

  it('reads a box written with a capital X, which GFM admits', () => {
    expect((render('- [X] Done\n').match(/checked=""/g) ?? []).length).toBe(1);
  });

  it('leaves a plain list item alone, with no box and no class of ours', () => {
    const html = render('- Just an item\n- Another one\n');

    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('task-item');
  });
});

describe('a box that cannot be written is disabled, and only then', () => {
  it('disables every box where the effective role does not allow writing', () => {
    const html = render(CHECKLIST, false);

    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
    // Still ours, and still showing the state: read-only is not "not rendered".
    expect((html.match(/task-item/g) ?? []).length).toBe(2);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  });

  it('disables the boxes when a click could not be mapped back to the bytes', () => {
    // A list item holding only `[[x]]` resolves to `- [x](…)`, which any GFM
    // reader counts as a ticked task box while the ORIGINAL text has none
    // there. Counting on one side and writing on the other would toggle a
    // different item, in silence. Not writing is better.
    const html = render(`- [[x]]\n${CHECKLIST}`);

    expect(html).toContain('disabled=""');
    // Refusing the write is not refusing the page: the note still reads.
    expect(html).toContain('Read the act');
  });
});

describe('the boxes keep their place around the rest of the surface', () => {
  it('counts past the frontmatter, which is shown as properties and not as prose', () => {
    const html = render(`---\nmaturity: evergreen\n---\n\n${CHECKLIST}`);

    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('maturity');
  });

  it('does not read a box written inside a code fence', () => {
    const html = render('```\n- [ ] not a box\n```\n\n- [ ] a box\n');

    expect((html.match(/type="checkbox"/g) ?? []).length).toBe(1);
  });
});
