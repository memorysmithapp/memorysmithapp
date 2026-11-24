/**
 * Two drifts between screens (#544): a link dressed as a button underlined
 * under the pointer, and the screens outside the shell drew the brand as the
 * word alone.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BrandHeading } from './BrandMark';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('a link dressed as a button (#544)', () => {
  it('never underlines, though every other link does', () => {
    // Every link underlines from the layer of the elements, below the layer of
    // the button, which never does: the layers decide, not specificity.
    expect(css).toMatch(/@layer tokens, base, primitives;/);
    const base = css.slice(css.indexOf('@layer base {'), css.indexOf('@layer primitives {'));
    expect(base).toMatch(/\n {2}a:hover \{\s*text-decoration: underline;/);
    const primitives = css.slice(css.indexOf('@layer primitives {'));
    expect(primitives).toMatch(/\n {2}\.button \{[^}]*text-decoration: none;/);
    expect(css).not.toContain('bar-button');
  });
});

describe('the brand of a screen outside the shell (#544)', () => {
  it('is the symbol of each theme over the wordmark', () => {
    const markup = renderToStaticMarkup(<BrandHeading />);
    expect(markup).toContain('src="/symbol.svg"');
    expect(markup).toContain('src="/symbol-dark.svg"');
    expect(markup).toMatch(/<h1 class="brand-word">MemorySmith<span class="brand-suffix">\.app/);
  });

  it.each([
    '../../features/auth/LoginPage.tsx',
    '../../features/auth/AuthCallbackPage.tsx',
    '../../features/note/GeneratePdfPage.tsx',
  ])('is drawn by %s with the shared heading, never by hand', (path) => {
    const page = source(path);
    expect(page).toContain('<BrandHeading />');
    expect(page).not.toContain('className="brand-word"');
  });
});
