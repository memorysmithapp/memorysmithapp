/**
 * The order control of a folder (#273): what it does is said behind an (i),
 * whose text is in the page while closed so the control can name it as its
 * description, and the rule for the count beside the heading no longer
 * reaches the labels of the control.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Hint } from './Hint';
import { Segmented } from './Segmented';

describe('a hint behind an (i)', () => {
  const html = renderToStaticMarkup(
    <Hint id="the-hint" label="What the order does" text="The notes follow their names." />,
  );

  it('is a closed button that names what it opens', () => {
    // Not `.hint`, which is the quiet line of text other screens already use.
    expect(html).toMatch(/^<span class="hint-anchor">/);
    expect(html).toContain('class="hint-trigger"');
    expect(html).toContain('aria-label="What the order does"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="the-hint"');
  });

  it('keeps its text in the page while closed, hidden', () => {
    expect(html).toMatch(
      /<span id="the-hint" class="hint-bubble" role="note" hidden="">The notes follow their names\.<\/span>/,
    );
  });

  it('is the description of the group it explains', () => {
    const group = renderToStaticMarkup(
      <Segmented
        label="Order of the notes"
        value="manual"
        onChange={() => undefined}
        describedBy="the-hint"
        options={[
          { value: 'manual', label: 'Manual' },
          { value: 'alphabetical', label: 'Alphabetical' },
        ]}
      />,
    );
    expect(group).toContain('role="radiogroup"');
    expect(group).toContain('aria-describedby="the-hint"');
  });
});

describe('the heading of a group of a folder', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('styles its count by a class, never every span inside it', () => {
    // Any selector under .folder-group-head ending at a bare `span` reaches
    // the `.segmented-label` of the order control and greys the chosen option.
    const bare = /\.folder-group-head[^{,]*\bspan\s*(?:[,{])/g;
    expect(css.match(bare) ?? []).toEqual([]);
    expect(css).toMatch(/\.folder-group-count\s*\{/);
  });

  it('leaves the chosen option to the segmented control, in --on-chosen', () => {
    expect(css).toMatch(
      /\.segmented > button\[aria-checked='true'\] \{[^}]*color: var\(--on-chosen\)/,
    );
    expect(css).not.toMatch(/\.segmented-label\s*\{[^}]*color:/);
  });
});
