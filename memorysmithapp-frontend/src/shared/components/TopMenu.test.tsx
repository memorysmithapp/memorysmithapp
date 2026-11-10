/**
 * Which entry of the menu of the product is lit (#422): a notebook declared as
 * a model is a model on its every page, so it is Models that is lit there, and
 * neither while it is not yet known which it is. Rendered to static markup from
 * what the cache already holds.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '../api/query-keys';
import { TopMenu } from './TopMenu';

vi.mock('../api/source', () => ({ getModel: vi.fn(() => new Promise(() => undefined)) }));

const NOTEBOOK = '01j8x2k9qz3m4n5p6r7s8t9v0a';

/** `model` is what the notebook answers as a model: a model, `null`, or not read yet. */
function lit(pathname: string, model?: unknown): string[] {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  if (model !== undefined) client.setQueryData(queryKeys.model(NOTEBOOK.toUpperCase()), model);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <TopMenu />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return [
    ...html.matchAll(
      /<a [^>]*aria-current="page"[^>]*href="([^"]+)"|<a [^>]*href="([^"]+)"[^>]*aria-current="page"/g,
    ),
  ].map((match) => match[1] ?? match[2] ?? '');
}

const A_MODEL = { objective: 'x', versions: [] };

describe('the lit entry of the menu', () => {
  it('is Notebooks inside a notebook that is no model', () => {
    expect(lit(`/notebooks/${NOTEBOOK}`, null)).toEqual(['/notebooks']);
    expect(lit(`/notebooks/${NOTEBOOK}/notes/n1`, null)).toEqual(['/notebooks']);
  });

  it('is Models on every page of a notebook that is a model', () => {
    expect(lit(`/notebooks/${NOTEBOOK}`, A_MODEL)).toEqual(['/models']);
    expect(lit(`/notebooks/${NOTEBOOK}/notes/n1`, A_MODEL)).toEqual(['/models']);
    expect(lit(`/notebooks/${NOTEBOOK}/folders`, A_MODEL)).toEqual(['/models']);
  });

  it("is Models on a model of one's own, and on its versions, even before it is read", () => {
    expect(lit(`/notebooks/${NOTEBOOK}/model`)).toEqual(['/models']);
    expect(lit(`/notebooks/${NOTEBOOK}/model/versions/2`)).toEqual(['/models']);
  });

  it('is neither inside a notebook not yet known to be one or the other', () => {
    expect(lit(`/notebooks/${NOTEBOOK}/notes/n1`)).toEqual([]);
  });

  it('is Models on the list of models and on a model shared with the person', () => {
    expect(lit('/models')).toEqual(['/models']);
    expect(lit(`/models/${NOTEBOOK}`)).toEqual(['/models']);
  });

  it('is Notebooks on the list of notebooks', () => {
    expect(lit('/notebooks')).toEqual(['/notebooks']);
  });
});
