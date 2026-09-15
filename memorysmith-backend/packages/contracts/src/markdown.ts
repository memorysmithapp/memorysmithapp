/**
 * The notation the product reads inside the body of a note, DERIVED from the
 * specification rather than transcribed from it.
 *
 * The notation is declared once, as data, in `docs/markdown-spec/`: the
 * MemorySmith Markdown Specification, carrying the same list as prose
 * (`SPEC.md`), as data (`spec.json`) and as an executable suite
 * (`tests/conformance.json`). It has no version of its own — it follows the
 * version of the product — and a notation changes in the same commit as the
 * readers that implement it.
 *
 * That is the whole reason this file holds no list. A specification and an
 * implementation that keep separate copies of the same list drift apart on the
 * first cycle, and the drift is silent — which is exactly the failure the
 * specification exists to prevent one layer up, for the notebooks. Keeping a
 * private transcription here would be that same mistake, made by us.
 *
 * It is re-exported from this package, and not read directly by whoever needs
 * it, because two contexts need the same list and may never import each other:
 * Discovery READS this notation, in its two sanctioned extractors, and Agent
 * Access TEACHES it, in the skill that tells an agent how to write a note this
 * product understands (RN-AGT-017, RN-AGT-022). The frontend reads it from here
 * too, since this is the one backend package it may import.
 *
 * **Two lists below are ours and not the profile's**, and they are here because
 * specification v0.4.0 stopped carrying the fields they used to be read from. Each
 * one says what it is for at its own declaration. They are not a transcription
 * of the specification: the first is a decision about what this repository's
 * own guards are asked for, and the second is what this product does with
 * forms the profile deliberately no longer describes.
 */

import spec from '@memorysmith/markdown-spec/spec.json' with { type: 'json' };
import conformance from '@memorysmith/markdown-spec/conformance.json' with { type: 'json' };

/**
 * Who decides this notation. The first two are the sanctioned extractors of
 * `architecture-guide.md` §11.3; the third is the reading surface, which is
 * behaviour of the interface and is proved by a test of its own kind — a
 * rendering assertion cannot live in a JSON file (RN-AGT-023).
 */
export type NotationReader = 'links' | 'frontmatter' | 'reading-surface';

export interface RecognisedNotation {
  readonly id: string;
  readonly reader: NotationReader;
  /** The form, as an agent would type it. */
  readonly syntax: string;
  /** A body that exercises the form, used verbatim by the conformance test. */
  readonly example: string;
  /** What observably happens. Written for the agent, not for the code. */
  readonly effect: string;
  /** The section of `SPEC.md` that specifies it. */
  readonly spec?: string;
}

/**
 * One case of the published suite. Absent expectations assert nothing.
 *
 * A case may state four different things, and 0.6.0 added the last two: what
 * a note is CALLED (`name`), and what a target BECOMES once a notebook exists to
 * resolve it against (`notebook` plus `resolution`). The last pair cannot be run
 * against an extractor alone — it needs the resolver and a notebook to give it.
 */
export interface ConformanceCase {
  readonly id: string;
  readonly notation: string;
  readonly markdown: string;
  readonly links?: ReadonlyArray<{ readonly name: string; readonly anchor: string | null }>;
  readonly facets?: Readonly<Record<string, { readonly kind: string; readonly values: string[] }>>;
  /** The `name:` of `markdown` as §5.3 reads it, or `null` for no name. */
  readonly name?: string | null;
  /** The notebook the targets are resolved against: note bodies and attachment names. */
  readonly notebook?: {
    readonly notes?: readonly string[];
    readonly attachments?: readonly string[];
  };
  /** What each target becomes, and how many edges it produces. */
  readonly resolution?: ReadonlyArray<{
    readonly target: string;
    readonly kind: 'note' | 'attachment' | 'pending';
    readonly edges: number;
  }>;
}

/**
 * The name and the address of the specification, for what the product serves.
 * There is no version beside them: the specification follows the version of
 * the product.
 */
export const MARKDOWN_SPEC_URL: string = spec.url;
export const MARKDOWN_SPEC_NAME: string = spec.spec;

/**
 * Where the forms of the profile were established.
 *
 * It was `base` until specification v0.4.0 and it was a list of tiers the profile
 * was built out of; it is now a list of **sources a form is credited to**, and
 * the difference is not cosmetic. An implementation is no longer asked to
 * support a specification in full — a requirement nobody can check — it is
 * asked to support the notation the document lists, which is a requirement the
 * suite settles.
 *
 * `version` is OPTIONAL, and the third source is why: Obsidian publishes
 * documentation rather than a versioned specification. It is credited because
 * seven notation families came from it — the wikilink and its alias, anchor,
 * embed and block forms, callouts, marked text, comments, block identifiers —
 * and crediting them to "the vault editors that established it" named nobody.
 *
 * **The precedence is not uniform, and that is the part worth carrying.** Where
 * the profile and CommonMark or GFM disagree, the source governs. Where the
 * profile and Obsidian disagree, the profile governs. A source is a lineage
 * here, never a compatibility claim.
 */
export const MARKDOWN_SPEC_SOURCES: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly url: string;
}> = spec.sources;

export const RECOGNISED_NOTATION: readonly RecognisedNotation[] =
  spec.notations as readonly RecognisedNotation[];

/**
 * The published cases, run by the conformance tests of both implementations.
 * They are the suite of the specification and not a copy of it: a case the
 * extractors or the reading surface fail breaks the build.
 */
export const CONFORMANCE_CASES: readonly ConformanceCase[] =
  conformance.cases as readonly ConformanceCase[];

/**
 * The entries whose rendering this repository does NOT assert, because the
 * base parser is what produces them.
 *
 * **This list is a decision of ours, and it used to be a field.** Until profile
 * v0.4.0 every entry carried a `ring`, and the reading-surface expectations
 * were scoped to everything outside the `base` one. The profile dropped the
 * tier for a good reason: an implementation is asked for the notation the
 * document lists and not for a specification in full. But the reason that
 * guard was scoped did not go away with the field, so the scope is written here
 * instead of being inferred from data that no longer says it.
 *
 * The reason, unchanged: asserting that emphasis renders as `<em>` is a claim
 * about react-markdown and not about this surface. CommonMark is the floor
 * every renderer already stands on; what that guard proves is what this profile
 * adds on top of it.
 *
 * **Three things this list is not.**
 *
 * It is not a claim that these forms are untested: the published conformance
 * suite runs every case the profile ships, scoped by nothing, and the crossings
 * — where the profile changes what a base form MEANS — are asserted by hand in
 * `a base notation that means something different here`. A link inside a code
 * span, an embed that looks like an image, `---` under a paragraph: those are
 * here in this list and proved there.
 *
 * It is not what the skill is asked for. The skill teaches the whole table,
 * these entries included, and that is the same decision reaching the opposite
 * answer: the crossings are exactly what an agent gets wrong, so the reader who
 * most needs them is the one reading that table.
 *
 * And it is not allowed to silently absorb a new entry. Both guards assert that
 * every declared notation is either expected or listed here, so a form the
 * profile adds in a later version fails the build until somebody classifies it,
 * which is the property the old `ring` field gave for free.
 */
export const DELEGATED_TO_THE_BASE_PARSER: ReadonlySet<string> = new Set([
  'paragraph',
  'backslash-escape',
  'character-reference',
  'heading-atx',
  'heading-setext',
  'thematic-break',
  'block-quote',
  'list-bullet',
  'list-ordered',
  'code-fenced',
  'code-indented',
  'link-reference-definition',
  'code-span',
  'emphasis',
  'strong',
  'strong-emphasis',
  'link-inline',
  'link-reference',
  'image',
  'autolink',
  'hard-line-break',
]);

/**
 * A form this product deliberately does not read, declared here because the
 * profile no longer declares anything about it.
 *
 * Until v0.4.0 the profile carried these as entries with `recognised: false`,
 * and §8 kept a catalogue of notation it declined. Both are gone, and the
 * profile is right that they had to go: a list of the forms a specification
 * refuses needs an entry for every form of every other dialect and can never be
 * finished. §8 is now one rule covering all of them at once — an implementation
 * MAY render an undescribed form, MUST NOT derive meaning from it, and MUST NOT
 * claim conformance on account of it.
 *
 * **What the profile stopped saying, this product still says.** Nothing changed
 * about the behaviour: `#subject` in the body of a note becomes no edge and no
 * facet, and the reading surface draws it as plain text with no chip and
 * nothing to click (RN-DSC-033, and RN-PRT-007 depends on it). The rule is
 * ours, argued from PP4 and from a survey of the example notebooks, and it needs
 * somewhere to live now that it is not a row in `spec.json`.
 *
 * The guard that watches it is the reason this list is not simply deleted. Of
 * everything the reading surface does, a rejection is the easiest to undo by
 * accident: drawing a chip around `#subject` promises a grouping that does not
 * exist, and an affordance without the function it promises is worse than the
 * raw text. That guard read `recognised: false` and would now watch nothing.
 *
 * Every entry here MUST be absent from `RECOGNISED_NOTATION`, and a test says
 * so: if a later version of the profile declares one of these forms, this list
 * is the thing that has to change, not the thing that quietly disagrees.
 */
export interface DeclaredSilence {
  readonly id: string;
  /** The form, as somebody arriving from another editor would type it. */
  readonly syntax: string;
  /** A body exercising the form, used verbatim by the guards. */
  readonly example: string;
  /** What happens, which in every case here is nothing. */
  readonly effect: string;
}

export const DECLARED_SILENCE: readonly DeclaredSilence[] = [
  {
    id: 'inline-tag',
    syntax: '#subject',
    example: 'The decision touches #procurement and #contracts.',
    effect:
      'NOTHING. It is stored and returned exactly as written, and shown as plain text: no chip, no colour, nothing to click. Two editors read the inline hashtag in incompatible ways, as a link and as metadata of the file, so there is nothing to inherit. Here the curation vocabulary lives in the frontmatter, where the Guidance governs it. To group, write `tags:`; to connect, write `[[wikilink]]`.',
  },
  {
    id: 'sub-sup',
    syntax: '~subscript~  ·  ^superscript^',
    example: 'The formula is H~2~O, and the area is 3 m^2^.',
    effect:
      'NOTHING, and the characters stay on the page so that is visible. There is no notation for superscript or subscript here, which is why strikethrough accepts two tildes and only two: a single-tilde extension would strike the middle of `H~2~O`, and a wrong answer is worse than none.',
  },
];

/**
 * The attribute names the specification reserves, **derived from it and never
 * typed here**.
 *
 * They are exactly the notations whose `spec` field cites §6.4, in the order
 * the specification declares them, with the key read off the identifier:
 * `frontmatter-aliases` is `aliases`. So a change that reserves a fourth name
 * reserves it here in the same commit, and nothing in this
 * repository has to be remembered — which is the property a hand-written copy
 * cannot have, and this list used to exist in three copies (RN-DSC-030).
 *
 * **Reserved is declared, not enforced.** Nothing treats these keys
 * differently when it classifies a value: `tags: continuity` written as a
 * scalar is an ordinary enum rather than an error, and `etiquetas:` stays legal
 * and stays indexed as the ordinary attribute it is. What the reservation buys
 * is the **name** — the one thing a notebook cannot invent for itself without
 * leaving every other notebook behind, because unreserved, one notebook writes
 * `etiquetas:` and another writes `tags:` and no interface can offer one column
 * over both. Who wrote a note and when is not reserved: its history answers it.
 *
 * `name` is the exception in both directions: it is reserved and it is never
 * an attribute at all (RN-DSC-050). It names the note (RN-KNW-035), and a note
 * is not a category of itself.
 */
export const RESERVED_FRONTMATTER_KEYS: readonly string[] = RECOGNISED_NOTATION.filter(
  (notation) =>
    notation.reader === 'frontmatter' &&
    (notation.spec ?? '')
      .split(',')
      .map((section) => section.trim())
      .includes('6.4'),
).map((notation) => notation.id.replace(/^frontmatter-/, ''));

/**
 * The key that names the note, derived like everything else here: it is the
 * frontmatter notation whose section is §6.5, the section that says a name
 * produces no attribute at all.
 *
 * The kernel exports a constant of the same name, because it is the reader of
 * that key and may not import this package. A test asserts the two agree, so
 * the day the specification renames it, one of them fails rather than both
 * quietly drifting.
 */
export const NAME_KEY: string =
  RECOGNISED_NOTATION.find(
    (notation) =>
      notation.reader === 'frontmatter' &&
      (notation.spec ?? '')
        .split(',')
        .map((section) => section.trim())
        .includes('6.5'),
  )?.id.replace(/^frontmatter-/, '') ?? 'name';

/**
 * The reserved keys a surface draws as properties: every one but the name.
 * A note is not a category of itself, so the key that names it is drawn as the
 * name and never in the property panel (RN-DSC-051).
 */
export const DRAWN_RESERVED_KEYS: readonly string[] = RESERVED_FRONTMATTER_KEYS.filter(
  (key) => key !== NAME_KEY,
);
