/**
 * The grammar of the search query language (RN-DSC-026, RN-DSC-034).
 *
 * Pure: it parses text into a tree, and nothing here evaluates the tree. It
 * lives in the kernel because two contexts read the same language: Discovery
 * evaluates it against the portrait of a note, and Knowledge against the rows
 * of a Table (#366), so one grammar is what keeps the two from drifting apart. It knows nothing about DynamoDB, about how a note is stored or
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

/** The four fields the backend answers from its own projections. */
export const STRUCTURAL_FIELDS = ['name', 'folder', 'content', 'section'] as const;
export type StructuralField = (typeof STRUCTURAL_FIELDS)[number];

/** The comparison operators, and the whole list of them (RN-DSC-034). */
export const COMPARISONS = ['>=', '<=', '>', '<'] as const;
export type Comparison = (typeof COMPARISONS)[number];

export type QueryNode =
  | { readonly kind: 'term'; readonly field: StructuralField | null; readonly value: string }
  | { readonly kind: 'facet'; readonly facet: string; readonly value: string }
  | {
      readonly kind: 'compare';
      readonly facet: string;
      readonly op: Comparison;
      readonly value: string;
    }
  | { readonly kind: 'not'; readonly node: QueryNode }
  | { readonly kind: 'and'; readonly nodes: QueryNode[] }
  | { readonly kind: 'or'; readonly nodes: QueryNode[] };

export class QuerySyntaxError extends Error {}

/**
 * Normalization is the whole difference between a search that finds and one
 * that almost finds: case folded, diacritics stripped. `Vigência` and
 * `vigencia` are the same word to someone typing in a hurry, and a notebook in
 * Portuguese makes that the common case rather than the exception.
 *
 * It is done character by character, and every character contributes exactly
 * as many units as it occupied, so a position in the normalized text is the
 * same position in the original. That is what lets the excerpt be cut from the
 * text the author actually wrote: a naive `NFD` over the whole string shifts
 * every offset after the first accent, and the reader would get a passage
 * sliced a few characters off, or lowercased and unaccented prose nobody typed.
 */
export function normalize(raw: string): string {
  let out = '';
  for (const character of raw) {
    const folded = character.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    out += folded.length === character.length ? folded : character.toLowerCase();
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'word'; value: string; quoted: boolean }
  | { kind: 'or' }
  | { kind: 'not' }
  | { kind: 'open' }
  | { kind: 'close' };

const MAX_QUERY_LENGTH = 500;

function tokenize(raw: string): Token[] {
  if (raw.length > MAX_QUERY_LENGTH) {
    throw new QuerySyntaxError(`A query is limited to ${MAX_QUERY_LENGTH} characters`);
  }

  const tokens: Token[] = [];
  let index = 0;

  while (index < raw.length) {
    const char = raw[index] as string;

    if (/\s/.test(char)) {
      index++;
      continue;
    }

    if (char === '(') {
      tokens.push({ kind: 'open' });
      index++;
      continue;
    }

    if (char === ')') {
      tokens.push({ kind: 'close' });
      index++;
      continue;
    }

    /**
     * A dash negates only where a term can start, which is decided by the
     * character before it and not by the previous token: `lei -rascunho` has a
     * space in front of the dash and negates, while `lei-14133` does not, or
     * every slug someone types would parse as a negation of half a word.
     */
    if (char === '-' && startsTermAt(raw, index)) {
      tokens.push({ kind: 'not' });
      index++;
      continue;
    }

    if (char === '"') {
      const end = raw.indexOf('"', index + 1);
      if (end === -1) throw new QuerySyntaxError('A quoted phrase was never closed');
      tokens.push({ kind: 'word', value: raw.slice(index + 1, end), quoted: true });
      index = end + 1;
      continue;
    }

    /**
     * A bare word runs to whitespace or to a parenthesis. A quote inside it
     * ends it too, so `name:"lei 14.133"` keeps the prefix and reads the
     * phrase as one value.
     */
    let end = index;
    while (end < raw.length && !/[\s()"]/.test(raw[end] as string)) end++;

    let value = raw.slice(index, end);
    index = end;

    if (raw[index] === '"' && value.endsWith(':')) {
      const close = raw.indexOf('"', index + 1);
      if (close === -1) throw new QuerySyntaxError('A quoted phrase was never closed');
      value += raw.slice(index + 1, close);
      index = close + 1;
      tokens.push({ kind: 'word', value, quoted: true });
      continue;
    }

    if (value === 'OR') {
      tokens.push({ kind: 'or' });
      continue;
    }

    tokens.push({ kind: 'word', value, quoted: false });
  }

  return tokens;
}

function startsTermAt(raw: string, index: number): boolean {
  if (index === 0) return true;
  const previous = raw[index - 1] as string;
  return /[\s(]/.test(previous);
}

// ---------------------------------------------------------------------------
// Parser: OR binds loosest, then implicit AND, then NOT, then a term.
// ---------------------------------------------------------------------------

export function parseQuery(raw: string): QueryNode {
  const tokens = tokenize(raw);
  if (tokens.length === 0) throw new QuerySyntaxError('A search needs a query');

  let position = 0;

  const peek = (): Token | undefined => tokens[position];

  function parseOr(): QueryNode {
    const nodes = [parseAnd()];
    while (peek()?.kind === 'or') {
      position++;
      nodes.push(parseAnd());
    }
    return nodes.length === 1 ? (nodes[0] as QueryNode) : { kind: 'or', nodes };
  }

  function parseAnd(): QueryNode {
    const nodes: QueryNode[] = [];
    while (position < tokens.length) {
      const token = peek();
      if (!token || token.kind === 'or' || token.kind === 'close') break;
      nodes.push(parseNot());
    }
    if (nodes.length === 0) throw new QuerySyntaxError('An operator is missing its term');
    return nodes.length === 1 ? (nodes[0] as QueryNode) : { kind: 'and', nodes };
  }

  function parseNot(): QueryNode {
    if (peek()?.kind === 'not') {
      position++;
      return { kind: 'not', node: parseNot() };
    }
    return parseAtom();
  }

  function parseAtom(): QueryNode {
    const token = peek();
    if (!token) throw new QuerySyntaxError('An operator is missing its term');

    if (token.kind === 'open') {
      position++;
      const inner = parseOr();
      if (peek()?.kind !== 'close') throw new QuerySyntaxError('A group was never closed');
      position++;
      return inner;
    }

    if (token.kind !== 'word') throw new QuerySyntaxError('An operator is missing its term');
    position++;
    return termOf(token);
  }

  const tree = parseOr();
  if (position < tokens.length) throw new QuerySyntaxError('A group was closed but never opened');
  return tree;
}

function termOf(token: Extract<Token, { kind: 'word' }>): QueryNode {
  /**
   * A colon only introduces a field when it is not the first character and
   * something follows it. `:` alone, or a value that starts with one, is just
   * text someone typed.
   */
  const colon = token.value.indexOf(':');
  if (colon > 0 && colon < token.value.length - 1) {
    const field = normalize(token.value.slice(0, colon));
    const raw = token.value.slice(colon + 1);
    if ((STRUCTURAL_FIELDS as readonly string[]).includes(field)) {
      return { kind: 'term', field: field as StructuralField, value: normalize(raw) };
    }
    return intervalOf(field, raw) ?? { kind: 'facet', facet: field, value: normalize(raw) };
  }

  const value = normalize(token.value);
  if (value.length === 0) throw new QuerySyntaxError('A search needs a query');
  return { kind: 'term', field: null, value };
}

// `(.*)` and not `(.+)`: an operator with nothing after it has to reach the
// error below, and not fall through to `>` with a value of `=`.
const COMPARISON = /^(>=|<=|>|<)(.*)$/;

/**
 * An interval over a date attribute, in either of the two forms the profile
 * declares (RN-DSC-034), or null when the value is an ordinary facet value.
 *
 * The comparison is the primitive and the range is **sugar**: `a..b` becomes
 * `>=a` and `<=b` right here, so everything below this line sees one shape.
 * Two forms with two code paths is where the discrepancy nobody notices
 * lives, and this is the first operator in the language, so the shape it takes
 * is the shape every later one copies.
 */
function intervalOf(facet: string, raw: string): QueryNode | null {
  const comparison = COMPARISON.exec(raw);
  if (comparison) {
    const value = normalize(comparison[2] ?? '');
    if (value.length === 0) {
      throw new QuerySyntaxError('A comparison is missing its date, as in created:>=2026-01-01');
    }
    return { kind: 'compare', facet, op: comparison[1] as Comparison, value };
  }

  // Found by the separator rather than by a pattern over the ends, so a range
  // with an end missing is an ERROR and not an ordinary value that happens to
  // start with two dots.
  const separator = raw.indexOf('..');
  if (separator === -1) return null;

  const from = normalize(raw.slice(0, separator));
  const to = normalize(raw.slice(separator + 2));
  if (from.length === 0 || to.length === 0) {
    throw new QuerySyntaxError('A range needs both ends, as in created:2026-01-01..2026-03-31');
  }
  // Inverted ends are a SYNTAX ERROR and never an empty result. An empty
  // result reads as "there is nothing there", and this means "you asked
  // something that has no answer", which are different things to be told.
  if (inverted(from, to)) {
    throw new QuerySyntaxError(`The range is inverted: ${from} comes after ${to}`);
  }
  return {
    kind: 'and',
    nodes: [
      { kind: 'compare', facet, op: '>=', value: from },
      { kind: 'compare', facet, op: '<=', value: to },
    ],
  };
}

/**
 * Whether the ends of a range are the wrong way round: by value when both are
 * numbers, which the columns of a Table compare by (#366), so `30..200` is a
 * range and not an inverted one; by text otherwise, which is how a date is.
 */
function inverted(from: string, to: string): boolean {
  const NUMBER = /^-?\d+(\.\d+)?$/;
  if (NUMBER.test(from) && NUMBER.test(to)) return Number(from) > Number(to);
  return from > to;
}

/**
 * Every facet an interval is asked over. The caller checks them against what
 * the notebook actually holds, because "is this attribute a date" is a question
 * about the notebook and not about the query string (RN-DSC-034).
 */
export function comparedFacets(node: QueryNode): string[] {
  switch (node.kind) {
    case 'compare':
      return [node.facet];
    case 'not':
      return comparedFacets(node.node);
    case 'and':
    case 'or':
      return node.nodes.flatMap(comparedFacets);
    default:
      return [];
  }
}
