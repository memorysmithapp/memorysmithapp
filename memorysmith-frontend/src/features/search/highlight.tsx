// Marking the terms inside an excerpt the backend sent back.
//
// The excerpt is cut from the text as the author wrote it, with accents and
// capitals, while the query is matched folded. Marking it therefore has to
// fold too, and has to fold WITHOUT moving a single position, or the mark
// lands a few characters off the word it belongs to.
//
// This is presentation only: what matched is decided by the backend, and what
// is marked here is the reader's confirmation of it.

import type { ReactNode } from 'react';

/**
 * Case folded, diacritics dropped, one unit in for one unit out. A naive NFD
 * over the whole string shifts every offset after the first accent, which is
 * exactly what this must not do.
 */
export function fold(raw: string): string {
  let out = '';
  for (const character of raw) {
    const folded = character.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += folded.length === character.length ? folded : character.toLowerCase();
  }
  return out;
}

/**
 * The terms a query looks for, in the order they were typed. Operators are
 * dropped, a negated term is dropped with them (nothing it excludes can be in
 * the text), and a field or facet prefix keeps only its value: `title:lei`
 * marks `lei`, and `maturity:evergreen` marks `evergreen` where it shows.
 */
export function termsOf(query: string): string[] {
  const pattern = /(-)?(?:([^\s():"]+):)?(?:"([^"]*)"|([^\s()"]+))/gu;
  const terms: string[] = [];

  for (const match of query.matchAll(pattern)) {
    const [, negated, , quoted, bare] = match;
    if (negated) continue;
    const value = quoted ?? bare ?? '';
    if (value === '' || value === 'OR') continue;
    terms.push(value);
  }

  return terms;
}

/** Ranges of the text covered by any term, merged and in order. */
function coverage(text: string, terms: string[]): Array<[number, number]> {
  const folded = fold(text);
  const found: Array<[number, number]> = [];

  for (const term of terms) {
    const needle = fold(term);
    if (needle === '') continue;
    let at = folded.indexOf(needle);
    while (at !== -1) {
      found.push([at, at + needle.length]);
      at = folded.indexOf(needle, at + needle.length);
    }
  }

  found.sort((left, right) => left[0] - right[0]);

  const merged: Array<[number, number]> = [];
  for (const range of found) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/** The excerpt with every term marked. Plain text when nothing matches. */
export function highlight(text: string, query: string): ReactNode {
  const ranges = coverage(text, termsOf(query));
  if (ranges.length === 0) return text;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<mark key={`${start}-${index}`}>{text.slice(start, end)}</mark>);
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts;
}
