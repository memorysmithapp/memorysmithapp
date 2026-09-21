/**
 * The history of a note renders in both locales (#169).
 *
 * It is here because of one line: the history built its `Intl.DateTimeFormat`
 * from `i18n.language`, which is `pt_BR`, and `Intl` takes a BCP 47 tag and
 * throws `RangeError: Invalid language tag` on anything else. The throw
 * happened during render, so it did not degrade a date — it took the whole
 * note screen down, in pt-BR, for every note.
 *
 * The conversion has a helper, `intlLocale`, whose own docblock says it exists
 * because two screens had written it out by hand. This is the case that makes
 * the next surface fail here rather than in front of somebody reading a note.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as Backend from '../../shared/api/backend';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const NOTE = '01J8X2K9QZ3M4N5P6R7S8T9VN1';

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

const ENTRIES = [
  {
    occurredAt: '2026-09-20T17:33:42.000Z',
    type: 'NoteUpdated',
    authorship: { userId: 'u1', agent: null },
    contentRef: { versionId: 'v1' },
    message: 'Corrigi a data da reunião',
  },
  {
    occurredAt: '2026-09-19T09:00:00.000Z',
    type: 'NoteCreated',
    authorship: { userId: 'u1', agent: { clientName: 'Claude' } },
    contentRef: { versionId: 'v0' },
    message: null,
  },
];

vi.mock('../../shared/api/backend', async (original) => ({
  ...(await original<typeof Backend>()),
  noteHistory: async () => ENTRIES,
}));

const LOADING_THE_BUNDLE_MS = 30_000;

let draw: (locale: 'en_US' | 'pt_BR') => Promise<string>;

beforeAll(async () => {
  const i18n = (await import('../../i18n')).default;
  const { NoteHistory } = await import('./NoteHistory');

  draw = async (locale) => {
    await i18n.changeLanguage(locale);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // The component reads through react-query, so the answer is put in the
    // cache first: what is under test is the render, not the fetch.
    await client.prefetchQuery({
      queryKey: ['note-history', NOTEBOOK, NOTE],
      queryFn: async () => ENTRIES,
    });
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <NoteHistory notebookId={NOTEBOOK} noteId={NOTE} />
      </QueryClientProvider>,
    );
  };
}, LOADING_THE_BUNDLE_MS);

describe('the history of a note', () => {
  it('renders in pt_BR, whose locale tag is not the one Intl takes', async () => {
    const html = await draw('pt_BR');

    // It rendered at all, which is the whole point: this used to throw.
    expect(html).toContain('history-list');
    // And the date is formatted in pt-BR, so the conversion happened rather
    // than the locale having been dropped for a default that cannot throw.
    expect(html).toContain('set.');
  });

  it('renders in en_US', async () => {
    const html = await draw('en_US');

    expect(html).toContain('history-list');
    expect(html).toContain('Sep');
  });

  it('shows the line an author left, and says so when there is none', async () => {
    const html = await draw('en_US');

    expect(html).toContain('Corrigi a data da reunião');
    // The entry with no line says it, rather than leaving a blank where a
    // sentence would be (RN-AUD-012).
    expect(html).toContain('history-message is-empty');
    // And who wrote: the connector when an agent did.
    expect(html).toContain('Claude');
  });
});
