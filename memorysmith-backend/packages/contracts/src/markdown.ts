/**
 * The notation the product reads inside the body of a note.
 *
 * It is declared here, and not inside a service, because two contexts need the
 * same list and they may never import each other: Discovery READS this
 * notation, in its two sanctioned extractors, and Agent Access TEACHES it, in
 * the skill that tells an agent how to write a note that this product
 * understands (RN-AGT-017).
 *
 * That is the whole point of the list existing as data. A skill describing a
 * notation the extractor stopped recognising is worse than no skill: it sends
 * the agent to write something that quietly does nothing. With the list here,
 * Discovery tests that every example is read as declared, and Agent Access
 * builds the skill from the same entries, so the two cannot drift.
 *
 * `recognised: false` entries are as important as the others. Most of what an
 * agent gets wrong is not a notation it typed badly, it is a notation it
 * believed in: an absolute link it expected to become an edge, a sentence in
 * the frontmatter it expected to become a facet.
 */

export interface RecognisedNotation {
  readonly id: string;
  /** Which sanctioned extractor decides this one. */
  readonly reader: 'links' | 'frontmatter';
  /** The form, as an agent would type it. */
  readonly syntax: string;
  /** A body that exercises the form, used verbatim by the conformance test. */
  readonly example: string;
  /** What observably happens. Written for the agent, not for the code. */
  readonly effect: string;
  /** False when the point of the entry is that NOTHING happens. */
  readonly recognised: boolean;
}

export const RECOGNISED_NOTATION: readonly RecognisedNotation[] = [
  {
    id: 'wikilink',
    reader: 'links',
    syntax: '[[Target note]]',
    example: 'See [[Lei 14.133]] for the general rule.',
    effect:
      'Becomes an edge in the graph and a backlink on the target. The target is resolved by ' +
      'slug within this vault, never across vaults. If it does not exist yet, it becomes a ' +
      'pending link and shows up in the health report, which is expected while a vault is ' +
      'being written.',
    recognised: true,
  },
  {
    id: 'wikilink-alias',
    reader: 'links',
    syntax: '[[Target note|what the reader sees]]',
    example: 'See [[Lei 14.133|the procurement act]] for the general rule.',
    effect: 'Same edge as the plain form. The alias changes the text, never the target.',
    recognised: true,
  },
  {
    id: 'wikilink-anchor',
    reader: 'links',
    syntax: '[[Target note#Section]]',
    example: 'See [[Lei 14.133#Article 75]] for the exception.',
    effect:
      'Same edge as the plain form: the anchor is kept for display and dropped when the ' +
      'target is resolved. Two links to different sections of one note are two links to the ' +
      'same note.',
    recognised: true,
  },
  {
    id: 'markdown-relative-link',
    reader: 'links',
    syntax: '[what the reader sees](target-note.md)',
    example: 'See [the procurement act](lei-14133.md) for the general rule.',
    effect:
      'Becomes the same edge as a wikilink. The target is reduced to its basename without ' +
      'extension and resolved by slug, so a path with folders in it resolves to the note, ' +
      'not to the path.',
    recognised: true,
  },
  {
    id: 'external-link',
    reader: 'links',
    syntax: '[what the reader sees](https://example.org/page)',
    example: 'See [the official text](https://example.org/lei-14133) for the general rule.',
    effect:
      'NEVER becomes an edge. Anything with a scheme or a host is external, and the graph is ' +
      'about notes of this vault. Use it freely for sources; do not use it expecting a ' +
      'connection.',
    recognised: false,
  },
  {
    id: 'frontmatter-enum',
    reader: 'frontmatter',
    syntax: 'key: short-value',
    example: '---\nmaturity: evergreen\n---\n\nBody.',
    effect:
      'Becomes a facet you can filter and count by, and a search filter written as ' +
      '`maturity:evergreen`. The vocabulary is yours: no key is special to the server.',
    recognised: true,
  },
  {
    id: 'frontmatter-list',
    reader: 'frontmatter',
    syntax: 'key: [one, two]  ·  or a dash list under the key',
    example: '---\ntags: [contracts, procurement]\n---\n\nBody.',
    effect: 'Becomes a facet with several values, each one filterable on its own.',
    recognised: true,
  },
  {
    id: 'frontmatter-boolean',
    reader: 'frontmatter',
    syntax: 'key: true  ·  key: false',
    example: '---\nreviewed: false\n---\n\nBody.',
    effect: 'Becomes a boolean facet, which is what makes "what has nobody reviewed" answerable.',
    recognised: true,
  },
  {
    id: 'frontmatter-date',
    reader: 'frontmatter',
    syntax: 'key: 2026-09-03',
    example: '---\nreviewed_at: 2026-09-03\n---\n\nBody.',
    effect: 'Becomes a date facet. An ISO date is recognised as a date; other formats are not.',
    recognised: true,
  },
  {
    id: 'frontmatter-prose',
    reader: 'frontmatter',
    syntax: 'key: a whole sentence, longer than forty characters',
    example:
      '---\nsummary: This note explains the general rule of direct contracting and its ' +
      'exceptions.\n---\n\nBody.',
    effect:
      'Is read and DISCARDED. Above forty characters a value is prose, not a category, and a ' +
      'facet of unique sentences would be a list of everything. Put prose in the body.',
    recognised: false,
  },
];
