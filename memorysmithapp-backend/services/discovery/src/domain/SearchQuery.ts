/**
 * The search query language (RN-DSC-026).
 *
 * Pure domain: it parses text into a tree and evaluates that tree against a
 * candidate. It knows nothing about DynamoDB, about how a note is stored or
 * about where the content came from, which is what lets the whole language be
 * tested without infrastructure.
 *
 * The shape follows what people already know from a Markdown notebook:
 *
 *   lei 14133            every bare term must match (implicit AND)
 *   "lei 14.133"         a quoted phrase matches as one literal string
 *   -rascunho            a leading dash negates
 *   a OR b               either side
 *   (a OR b) c           parentheses group
 *   name:auditoria      match the note name only
 *   folder:normas        match the folder name only
 *   content:prazo        match the body only
 *   section:vigencia     match a heading of the note
 *   maturity:evergreen   match a FACET, whatever the notebook happens to call it
 *
 * The field list is deliberately NOT closed. `name`, `folder`, `content` and
 * `section` are the four the backend knows how to answer by itself; anything
 * else is looked up as a facet, so a notebook that writes `norma: federal` in its
 * frontmatter gets `norma:federal` as a filter without a line of code being
 * written for it (PP4, RN-DSC-020). The ubiquitous language of the notebook is
 * the query language.
 *
 * Matching is by SUBSTRING over a normalized form, not by token. That is what
 * makes a word invented inside one note findable by typing part of it, and it
 * is the behaviour a notebook user expects from every other tool they use.
 */

import type { QueryNode } from '@memorysmithapp/kernel';

// The grammar is the kernel's, shared with the rows of a Table (#366); what
// Discovery adds is how a tree is evaluated against the portrait of a note.
export {
  COMPARISONS,
  comparedFacets,
  normalize,
  parseQuery,
  QuerySyntaxError,
  STRUCTURAL_FIELDS,
  type Comparison,
  type QueryNode,
  type StructuralField,
} from '@memorysmithapp/kernel';

/** What a candidate note offers the evaluator. All of it already normalized. */
export interface Candidate {
  readonly name: string;
  readonly folder: string;
  readonly content: string;
  readonly sections: string[];
  /**
   * The other spellings of the name, from the reserved `aliases`
   * (RN-DSC-032). They are searched wherever the name is, because that is
   * what an alias is: a notebook of technical terms lives on acronyms, and
   * requiring the full name in every search is what makes people stop
   * finding things. Resolving a wikilink by alias is the resolver's question,
   * not this one's (RN-DSC-052).
   */
  readonly aliases: string[];
  /** facet name to its values, as the FACET projection holds them. */
  readonly facets: Record<string, string[]>;
  /**
   * The kind of each facet, as the extractor classified it. Only `date` is
   * consulted, and only to match by prefix instead of by substring
   * (RN-DSC-031). A missing entry means an unknown kind, which matches the
   * old way: a projection written before the kind was carried keeps working.
   */
  readonly facetKinds: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * A bare term looks in the name, the folder, the headings and the body, which
 * is what someone means when they type a word and nothing else. A term with a
 * field looks only there.
 */
export function matches(node: QueryNode, candidate: Candidate): boolean {
  switch (node.kind) {
    case 'and':
      return node.nodes.every((each) => matches(each, candidate));
    case 'or':
      return node.nodes.some((each) => matches(each, candidate));
    case 'not':
      return !matches(node.node, candidate);
    case 'facet': {
      const values = candidate.facets[node.facet] ?? [];
      // A date is matched by PREFIX and never by substring (RN-DSC-031).
      // Values are canonicalised to `YYYY-MM-DD`, so a prefix is exactly the
      // granularity somebody asked for: `2026`, `2026-09`, `2026-09-03`.
      // Substring made `created:09` mean September and also the year 2009,
      // which is not a question anybody asked.
      if (candidate.facetKinds[node.facet] === 'date') {
        return values.some((value) => value.startsWith(node.value));
      }
      return values.some((value) => value.includes(node.value));
    }
    case 'compare': {
      // Only a date is comparable. A note whose attribute is of another kind
      // simply does not match; whether the QUERY made sense at all is decided
      // once per notebook by the caller, against what the notebook holds.
      if (candidate.facetKinds[node.facet] !== 'date') return false;
      return (candidate.facets[node.facet] ?? []).some((value) => compare(value, node));
    }
    case 'term': {
      // An alias is another name for the note, so it answers wherever the
      // name does: under `name:` and under a bare term.
      const named = (needle: string): boolean =>
        candidate.name.includes(needle) ||
        candidate.aliases.some((alias) => alias.includes(needle));

      if (node.field === 'name') return named(node.value);
      if (node.field === 'folder') return candidate.folder.includes(node.value);
      if (node.field === 'content') return candidate.content.includes(node.value);
      if (node.field === 'section') {
        return candidate.sections.some((section) => section.includes(node.value));
      }
      return (
        named(node.value) ||
        candidate.folder.includes(node.value) ||
        candidate.content.includes(node.value) ||
        candidate.sections.some((section) => section.includes(node.value))
      );
    }
  }
}

/**
 * One date against one bound, at the granularity the bound was written in.
 *
 * The value is cut to the length of the operand before comparing, which is
 * what makes a month a legal END of an interval and not only a point:
 * `2026-02-15` cut to `2026-02` is `<= 2026-02`, because the fifteenth is
 * inside February. Comparing the whole string would put the last day of the
 * month outside the month somebody asked for, which is the kind of off-by-one
 * nobody reports because it looks like an empty result.
 *
 * Comparison is lexicographic, which is the whole reason ISO 8601 was chosen:
 * two canonicalised dates compare as two strings.
 */
function compare(value: string, node: Extract<QueryNode, { kind: 'compare' }>): boolean {
  const cut = value.slice(0, node.value.length);
  switch (node.op) {
    case '>=':
      return cut >= node.value;
    case '>':
      return cut > node.value;
    case '<=':
      return cut <= node.value;
    case '<':
      return cut < node.value;
  }
}

/**
 * Ranking, deliberately simple and explainable: a hit in the name outweighs a
 * hit in a heading, which outweighs a hit in the body. Nobody has to guess why
 * a note came first, and there is no tuned weight to maintain.
 */
export function score(node: QueryNode, candidate: Candidate): number {
  const terms = positiveTerms(node);
  if (terms.length === 0) return 1;

  let total = 0;
  for (const term of terms) {
    // A filter says WHICH notes, not which one is most relevant, so every
    // facet and every interval contributes the same fixed weight.
    if (term.kind === 'facet' || term.kind === 'compare') {
      total += 2;
      continue;
    }
    // An alias ranks as the name does, because it is one: a note found by
    // `RTO` should not sort below one that merely mentions it in a paragraph.
    if (candidate.name === term.value || candidate.aliases.includes(term.value)) total += 10;
    else if (
      candidate.name.includes(term.value) ||
      candidate.aliases.some((alias) => alias.includes(term.value))
    )
      total += 5;
    else if (candidate.sections.some((section) => section.includes(term.value))) total += 3;
    else if (candidate.folder.includes(term.value)) total += 2;
    else if (candidate.content.includes(term.value)) total += 1;
  }
  return total / terms.length;
}

/** Negations and the branches under them do not contribute to the score. */
function positiveTerms(
  node: QueryNode,
): Array<Extract<QueryNode, { kind: 'term' | 'facet' | 'compare' }>> {
  switch (node.kind) {
    case 'not':
      return [];
    case 'and':
    case 'or':
      return node.nodes.flatMap(positiveTerms);
    default:
      return [node];
  }
}

/**
 * The passage around the first match, so the caller can decide with the source
 * in sight (RN-DSC-010).
 *
 * The term is located in the normalized text and the passage is cut from the
 * original, which `normalize` makes safe by preserving positions. It cuts on a
 * word boundary, because a snippet that starts mid-word reads as corruption.
 */
export function excerptAround(
  original: string,
  normalized: string,
  needle: string,
  width = 160,
): string {
  const at = normalized.indexOf(needle);
  if (at === -1) return original.slice(0, width).trim();

  const half = Math.floor((width - needle.length) / 2);
  let start = Math.max(0, at - half);
  let end = Math.min(original.length, at + needle.length + half);

  if (start > 0) {
    const space = original.indexOf(' ', start);
    if (space !== -1 && space < at) start = space + 1;
  }
  if (end < original.length) {
    const space = original.lastIndexOf(' ', end);
    if (space > at + needle.length) end = space;
  }

  return `${start > 0 ? '…' : ''}${original.slice(start, end).trim()}${end < original.length ? '…' : ''}`;
}

/** The first positive term, which is the one an excerpt should be cut around. */
export function firstTerm(node: QueryNode): string | null {
  const terms = positiveTerms(node);
  const term = terms.find((each) => each.kind === 'term');
  return term ? term.value : null;
}
