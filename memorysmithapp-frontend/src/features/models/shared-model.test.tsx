/**
 * A model shared as a model reader opens on pages of its own (#355), with no
 * notebook around it: nothing on them may read the notebook's context, which
 * is what crashed the page on staging. Rendered to static markup from data the
 * cache already holds.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NotebookModelDto } from '@memorysmithapp/contracts';
import { queryKeys } from '../../shared/api/query-keys';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  removeItem: (key: string) => void stored.delete(key),
  setItem: (key: string, value: string) => void stored.set(key, value),
} as Storage);

const MODEL = {
  notebookId: NOTEBOOK,
  objective: 'Run the assemblies of one condominium',
  description: '',
  audience: 'Property managers',
  parameters: [],
  basedOn: null,
  declaredAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  licence: 'CC0-1.0',
  sharedBy: 'owner@example.com',
  versions: [
    {
      number: 1,
      changelog: 'The first version',
      createdAt: '2026-10-25T10:00:00.000Z',
      status: 'ready',
      bytes: 10,
    },
  ],
} satisfies NotebookModelDto;

let SharedModelPage: () => React.JSX.Element;

beforeAll(async () => {
  await import('../../i18n');
  ({ SharedModelPage } = await import('./ModelPage'));
}, 30_000);

describe('a model shared as a model reader', () => {
  it('renders outside any notebook, with whose it is and its versions', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.model(NOTEBOOK), MODEL);
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/models/${NOTEBOOK.toLowerCase()}`]}>
          <Routes>
            <Route path="/models/:notebookId" element={<SharedModelPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(html).toContain('owner@example.com');
    expect(html).toContain('Run the assemblies of one condominium');
    expect(html).toContain(`href="/models/${NOTEBOOK.toLowerCase()}/versions/1"`);
  });
});
