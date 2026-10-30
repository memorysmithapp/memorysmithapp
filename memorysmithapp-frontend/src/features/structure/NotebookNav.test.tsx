/**
 * The item of a notebook model (#373): first of the menu in a notebook that is
 * one, and absent from any other. Rendered to static markup from data the cache
 * already holds.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys';
import { NotebookNav } from './NotebookNav';

vi.mock('../../shared/api/source', () => ({ getModel: vi.fn() }));

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

function menu(model: unknown): string {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(queryKeys.model(NOTEBOOK), model);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotebookNav notebookId={NOTEBOOK} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

describe('the item of a notebook model', () => {
  it('opens the menu in a notebook that is a model', () => {
    expect(hrefs(menu({ objective: 'x', versions: [] }))[0]).toMatch(/\/model$/);
  });

  it('is absent from a notebook that is not one', () => {
    expect(hrefs(menu(null)).some((href) => /\/model$/.test(href ?? ''))).toBe(false);
  });
});
