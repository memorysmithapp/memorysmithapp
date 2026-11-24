/**
 * The one button (#544, ADR-032): one look whether a <button> or a link is
 * underneath, its classes written in one place, and every value its variants
 * draw with a token of both themes.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Button, ButtonLink, buttonClass, type ButtonVariant } from './Button';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');
const layer = (name: string) => {
  const start = css.indexOf(`@layer ${name} {`);
  const next = css.indexOf('\n@layer ', start + 1);
  return css.slice(start, next < 0 ? undefined : next);
};
const block = (source: string, selector: string) => {
  const start = source.indexOf(`  ${selector} {\n`);
  return start < 0 ? '' : source.slice(start, source.indexOf('\n  }', start));
};
const tokens = layer('tokens');
const light = block(tokens, ':root');
const dark = tokens.slice(tokens.lastIndexOf(":root[data-theme='dark'] {"));

const VARIANTS: ButtonVariant[] = ['primary', 'quiet', 'danger', 'bar'];

describe('the one button (#544)', () => {
  it.each(VARIANTS)('draws %s as a <button> and as a link with the same classes', (variant) => {
    const button = renderToStaticMarkup(<Button variant={variant}>Go</Button>);
    const link = renderToStaticMarkup(
      <MemoryRouter>
        <ButtonLink variant={variant} to="/x">
          Go
        </ButtonLink>
      </MemoryRouter>,
    );
    const classes = `class="${buttonClass({ variant })}"`;
    expect(button).toContain(classes);
    expect(link).toContain(classes);
    expect(link).toContain('href="/x"');
  });

  it('is quiet unless it says otherwise, and submits only when it says so', () => {
    expect(renderToStaticMarkup(<Button>Go</Button>)).toBe(
      '<button type="button" class="button is-quiet">Go</button>',
    );
    expect(renderToStaticMarkup(<Button type="submit">Go</Button>)).toContain('type="submit"');
  });

  it('confirms in red only when it destroys', () => {
    expect(buttonClass({ variant: 'danger', confirming: true, small: true })).toBe(
      'button is-danger is-small is-filled',
    );
    expect(buttonClass({ variant: 'primary', confirming: true })).toBe('button is-primary');
  });

  it.each(['is-primary', 'is-quiet', 'is-danger'])(
    'draws .button.%s with tokens that both themes define',
    (modifier) => {
      const primitives = layer('primitives');
      const rules = [
        ...primitives.matchAll(new RegExp(`\\.button\\.${modifier}[^{]*\\{([^}]*)\\}`, 'g')),
      ]
        .map((match) => match[1])
        .join('\n');
      const used = [...rules.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((match) => match[1]);
      expect(used.length).toBeGreaterThan(0);
      for (const token of used) {
        expect(light, `${token} in the light theme`).toContain(`${token}:`);
        expect(dark, `${token} in the dark theme`).toContain(`${token}:`);
      }
    },
  );

  it('never changes its fill under the pointer (#550)', () => {
    const hovers = [...layer('primitives').matchAll(/\.button[^{]*:hover[^{]*\{([^}]*)\}/g)];
    expect(hovers.length).toBeGreaterThan(0);
    for (const [, body] of hovers) expect(body).not.toMatch(/background/);
  });
});
