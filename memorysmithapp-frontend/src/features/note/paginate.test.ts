/**
 * The copy of a note laid into the pages of its print takes ids of its own,
 * and its links follow them (#520), so a footnote of the PDF lands on the
 * page that shows its note and not on the hidden drawing of the same note.
 */

import { describe, expect, it } from 'vitest';
import { type ContentsMeasure, hangContents, pageRules, PRINTED_ID, separateIds } from './paginate';

/** An element as `separateIds` reads it: its attributes, nothing else. */
class Element {
  constructor(private readonly attributes: Record<string, string>) {}
  get id(): string {
    return this.attributes['id'] ?? '';
  }
  set id(value: string) {
    this.attributes['id'] = value;
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }
  matches(selector: string): boolean {
    if (selector === 'a[href^="#"]')
      return this.attributes['tag'] === 'a' && (this.attributes['href'] ?? '').startsWith('#');
    const named = /^\[([\w-]+)\]$/.exec(selector)?.[1];
    if (!named) throw new Error(`no fake for ${selector}`);
    return named in this.attributes;
  }
}

function contentOf(...elements: Element[]): ParentNode {
  return {
    querySelectorAll: (selector: string) => elements.filter((each) => each.matches(selector)),
  } as unknown as ParentNode;
}

describe('separateIds (#520)', () => {
  it('renames every id and points the links of the note at the renamed ones', () => {
    const reference = new Element({
      tag: 'a',
      id: 'user-content-fnref-1',
      href: '#user-content-fn-1',
      'aria-describedby': 'user-content-footnote-label',
    });
    const label = new Element({ tag: 'h2', id: 'user-content-footnote-label' });
    const note = new Element({ tag: 'li', id: 'user-content-fn-1' });
    const back = new Element({ tag: 'a', href: '#user-content-fnref-1' });
    separateIds(contentOf(reference, label, note, back));

    expect(note.id).toBe(`${PRINTED_ID}user-content-fn-1`);
    expect(reference.id).toBe(`${PRINTED_ID}user-content-fnref-1`);
    expect(reference.getAttribute('href')).toBe(`#${PRINTED_ID}user-content-fn-1`);
    expect(back.getAttribute('href')).toBe(`#${PRINTED_ID}user-content-fnref-1`);
    expect(reference.getAttribute('aria-describedby')).toBe(
      `${PRINTED_ID}user-content-footnote-label`,
    );
  });

  it('follows a fragment written percent-encoded, as the browser reads it', () => {
    const heading = new Element({ tag: 'h2', id: 'user-content-ação' });
    const link = new Element({ tag: 'a', href: '#user-content-a%C3%A7%C3%A3o' });
    separateIds(contentOf(heading, link));

    expect(heading.id).toBe(`${PRINTED_ID}user-content-ação`);
    expect(link.getAttribute('href')).toBe(`#${PRINTED_ID}user-content-a%C3%A7%C3%A3o`);
  });

  it('leaves a link to what the note does not hold as it was', () => {
    const heading = new Element({ tag: 'h2', id: 'intro' });
    const elsewhere = new Element({ tag: 'a', href: '#somewhere-else' });
    const named = new Element({ tag: 'p', 'aria-labelledby': 'intro outside' });
    separateIds(contentOf(heading, elsewhere, named));

    expect(elsewhere.getAttribute('href')).toBe('#somewhere-else');
    expect(named.getAttribute('aria-labelledby')).toBe(`${PRINTED_ID}intro outside`);
  });
});

describe('the page rules of a contents (#545)', () => {
  const rules = pageRules('portrait', null, false);
  /** The declarations of the rule whose selector is exactly this one. */
  const ruleOf = (selector: string) =>
    rules
      .split('\n')
      .find((line) => line.startsWith(`${selector} {`))
      ?.slice(selector.length) ?? '';

  it('keeps the number on the first line, in a column, and every line of the text under its first word', () => {
    const number = ruleOf('.contents-entry > .contents-number');
    expect(number).toContain('display: inline-block');
    expect(number).toContain('min-width: var(--contents-number');
    expect(number).toContain('white-space: nowrap');
    const item = ruleOf('.contents-item');
    expect(item).toContain('padding-inline-start: var(--contents-indent');
    expect(item).toContain('text-indent: calc(-1 * var(--contents-indent');
    // A justified note never stretches the words of an entry.
    expect(item).toContain('text-align: left');
    // The entry flows as text, so its last word is where its last line ends.
    expect(ruleOf('.contents-entry')).not.toContain('display: flex');
  });

  it('leads the dotted line from the last word to the page, at the right of the last line', () => {
    const leader = ruleOf('.contents-entry::before');
    expect(leader).toContain('left: 100%');
    expect(leader).toContain('dotted');
    const page = ruleOf('.contents-entry::after');
    expect(page).toContain('target-counter(attr(href url), page)');
    expect(page).toContain('float: right');
  });
});

describe('hangContents (#545)', () => {
  /** A list of entries as the measure reads it, and its copy as the rules read it. */
  function lists(numbers: number[][]) {
    const drawn = numbers.map((widths) => ({
      querySelectorAll: () => widths.map((width) => ({ width })),
    }));
    const copies = numbers.map(() => {
      const set = new Map<string, string>();
      return { set, style: { setProperty: (name: string, value: string) => set.set(name, value) } };
    });
    return {
      drawn: { querySelectorAll: () => drawn } as unknown as ParentNode,
      copy: { querySelectorAll: () => copies } as unknown as ParentNode,
      copies,
    };
  }
  const measure: ContentsMeasure = {
    number: (element) => (element as unknown as { width: number }).width,
    gap: () => 4.2,
  };

  it('gives each level the width of its widest number, and the text the column and the space', () => {
    const { drawn, copy, copies } = lists([[52.3, 60.1], [18]]);
    hangContents(drawn, copy, measure);
    expect(copies[0]?.set.get('--contents-number')).toBe('67px');
    expect(copies[0]?.set.get('--contents-indent')).toBe('72px');
    expect(copies[1]?.set.get('--contents-number')).toBe('24px');
  });

  it('leaves a list with no numbers with no column', () => {
    const { drawn, copy, copies } = lists([[]]);
    hangContents(drawn, copy, measure);
    expect(copies[0]?.set.size).toBe(0);
  });
});
