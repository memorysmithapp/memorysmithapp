/**
 * Which entry of the menu of the product is lit (#422): a model of one's own is
 * read at the address of its notebook, and it is Models that is lit there.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { TopMenu } from './TopMenu';

const NOTEBOOK = '01j8x2k9qz3m4n5p6r7s8t9v0a';

function lit(pathname: string): string[] {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <TopMenu />
    </MemoryRouter>,
  );
  return [
    ...html.matchAll(
      /<a [^>]*aria-current="page"[^>]*href="([^"]+)"|<a [^>]*href="([^"]+)"[^>]*aria-current="page"/g,
    ),
  ].map((match) => match[1] ?? match[2] ?? '');
}

describe('the lit entry of the menu', () => {
  it('is Notebooks inside a notebook', () => {
    expect(lit(`/notebooks/${NOTEBOOK}`)).toEqual(['/notebooks']);
    expect(lit(`/notebooks/${NOTEBOOK}/notes/n1`)).toEqual(['/notebooks']);
  });

  it("is Models on a model of one's own, and on its versions", () => {
    expect(lit(`/notebooks/${NOTEBOOK}/model`)).toEqual(['/models']);
    expect(lit(`/notebooks/${NOTEBOOK}/model/versions/2`)).toEqual(['/models']);
  });

  it('is Models on the list of models and on a model shared with the person', () => {
    expect(lit('/models')).toEqual(['/models']);
    expect(lit(`/models/${NOTEBOOK}`)).toEqual(['/models']);
  });

  it('is Notebooks on the list of notebooks', () => {
    expect(lit('/notebooks')).toEqual(['/notebooks']);
  });
});
