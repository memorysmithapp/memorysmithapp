/**
 * The copy of a note laid into the pages of its print takes ids of its own,
 * and its links follow them (#520), so a footnote of the PDF lands on the
 * page that shows its note and not on the hidden drawing of the same note.
 */

import { describe, expect, it } from 'vitest';
import { PRINTED_ID, separateIds } from './paginate';

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
