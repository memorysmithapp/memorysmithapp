# Changelog

All notable changes to this profile are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the profile follows
[Semantic Versioning](https://semver.org).

A notation **added** is a minor version. A notation **removed**, or an effect **changed**, is a
major version. While the profile is `0.x`, a breaking change may arrive in a minor version.

## [Unreleased]

### Changed

- **CommonMark 0.31.2 and GFM 0.29-gfm are reference sources, not rings the profile is built
  out of.** The document was organised in three tiers, and the tier a form belonged to was the
  first thing it said about that form — which is the least useful thing it can say to somebody
  deciding whether a form works and what it produces. §3 and §4 keep every form they had and
  lose the framing; §2 names the sources once, and each form cites the one it came from. An
  implementation is no longer asked to support a source *in full*: what it is asked to support
  is the notation this document lists, which is the version of that requirement that can be
  checked.
- **`profile.json` no longer carries a `ring` field, and its `base` array is now `sources`.**
  Provenance is stated in the prose of `SPEC.md`, per form, and is no longer an axis of the
  data. An implementation that selected notations by ring now reads them all; one that read
  `base` for the specifications behind the profile reads `sources`.
- Appendix B loses its Ring column, the two issue forms lose their ring dropdown, and the
  labels `ring:base`, `ring:extended` and `ring:memorysmith` are retired.

## [0.3.0] — 2026-09-06

The cycle in which the document stopped being a specification you read with two other
specifications open, and the repository gained the rules of working on it. One change to
what the profile publishes — the name of the third ring — cuts the minor version; the rest
adds no notation and removes none.

### Added

- **The base and the extended ring are restated in the document, in full** (§3 and §4).
  Every block and every inline of CommonMark 0.31.2 and of GFM 0.29-gfm, with the form as it
  is typed and what it produces. CommonMark and GFM remain the normative sources, and §2.1
  states the precedence: where the restatement and its source disagree, the source governs
  and this document is in error. The specification had been naming two other documents and
  sending the reader off to find them, which left the **join** between the three written
  down nowhere — a `[[link]]` in a code fence producing no edge, a block quote opening
  `[!warning]` being a callout, raw HTML parsing and not being rendered — because that join
  is invisible from either side alone. Each crossing is now stated where an author meets it,
  and again in the section that governs it.
- **`profile.json` carries the base and extended forms as entries**, 23 of them, so the
  machine-readable profile is as complete as the prose. An implementation that builds its
  documentation from that file now gets the whole notation and not only the third ring.
- **Appendix B, the notation at a glance**: every form in one table, with what it does
  beyond being rendered, including the rows whose answer is nothing.
- `CONTRIBUTING.md`, the process a change travels from an issue to `main`: the life cycle,
  the two issue forms, the four outcomes of triage, the branch names, the commit convention
  and the table of what cuts which version bump.
- `CLAUDE.md`, the single source of truth for agent behaviour in this repository.
- The two issue forms — a notation report and a notation proposal — and the pull request
  template, which asks for the summary, what an implementation has to do, and the three
  files a notation lives in.
- `tools/check-profile.mjs` and `npm run check`: the consistency check that refuses
  `SPEC.md`, `profile.json` and `tests/conformance.json` drifting apart. It validates the
  profile against its schema, requires a case for every notation an indexer decides,
  resolves every section reference to a real heading — from `profile.json` and from the
  prose of the document itself — and holds every file carrying the version to the one in
  `profile.json`. No dependencies.
- A CI workflow running that check on every pull request, and `.gitattributes` fixing the
  line ending at LF so the check reads the same bytes on every operating system.

### Changed

- **The third ring is named MemorySmith**, and no longer Vault. In a document that uses
  "vault" on nearly every page for the thing a person keeps — the folder resolution may not
  cross, the boundary an edge stays inside — the same word named a layer of the
  specification, and the reader had to tell the two apart from context. A ring is named
  after the specification that governs it, and the one that governs this ring is this
  document. `profile.json` carries `"ring": "memorysmith"` and the schema accepts it in
  place of `vault`, which is a break for anything reading that field: in `0.x` it arrives as
  a minor version. Released entries below keep the old name, because they are dated records
  of what the ring was called then.
- **The sections after the two new rings are renumbered.** Links, frontmatter, the reading
  surface and the rejections move from §3–§6 to §5–§8, and everything after them by the same
  two. Every reference in the document and every `spec` field of `profile.json` follows. No
  notation changed and the conformance suite is untouched.

### Fixed

- The header of `SPEC.md` said version 0.1.0 while `profile.json` said 0.2.0. It is the
  first thing the new check caught, on its first run and without anybody looking for it,
  and the reason it now holds every file carrying the version to the one in
  `profile.json`.
- The `task-list` entry of `profile.json` pointed at §5.5, which stopped being "Task lists"
  when 0.2.0 inserted "Marked text" there. It points at §4.2 and §7.11 now. A reference that
  resolves to the **wrong** heading is the one thing the check cannot see, and it took the
  renumbering to find it.

## [0.2.0] — 2026-09-06

The rest of the vault ring, and the two things the profile had been silent about on purpose
without saying so. Everything here was already written in real vaults and did nothing.

### Added

- **`==highlight==`**, marked text, carrying no meaning beyond emphasis.
- **`%%comment%%`**, text the author does not want read on the page. It disappears from the
  reading surface and **stays in the bytes**: a tool that returns the note returns it, an
  export writes it, and a search may find it. An agent therefore sees what a person on the
  page does not, and that asymmetry is declared rather than discovered — text somebody did
  not want on the page is still text they wrote, and this profile asks nobody to delete bytes
  to make a page tidier.
- **`^block-id` and `![[note#^id]]`**, the identified block and the embed that resolves to it.
  The edge is **exactly** the edge a plain wikilink produces: the graph does not tell an embed
  from a reference apart, and does not tell a block embed from either.
- **`$inline$` and `$$block$$`**, mathematics, with the rule that a `$` which is not opening
  or closing a formula stays text. A price and a shell variable are not formulas, and the
  conformance suite carries the negatives as well as the positives.
- **Date intervals in a query** (§4.8): `created:>=2026-01-01`, and the range
  `created:2026-01-01..2026-03-31` as sugar for two comparisons, both ends inclusive. One
  semantics, so there is one thing to implement, one to test and one to explain. An interval
  over an attribute that is not a date, and one whose ends are inverted, are errors and not
  empty results: an empty result reads as "there is nothing", and both of those mean "you
  asked something that has no answer".

### Rejected, and declared as such

- **Superscript and subscript.** There is nothing to inherit: GitHub writes them with raw
  HTML, which §5.10 declares off, and the Pandoc forms `~x~` and `^x^` render in no vault
  editor — a note written with them would read correctly here and look broken in every other
  tool its author uses, and `^x^` would collide with a block identifier.
- **Raw HTML.** Not rendered, stored and returned as written, shown as text. It is stated as a
  **security boundary** rather than left to each implementation: a vault is written by several
  people and by agents, and a page that renders arbitrary HTML out of it is a script injection
  whose trigger is written by whoever wrote the note.

### Changed

- **`aliases` gained the reason it does not resolve wikilinks** (§4.4). Resolution is
  behaviour; and while a title collision cannot happen, an alias collision can, created from
  outside by editing a third note that is neither end of the link. A link that does not
  resolve is at least visible, as a pending link.
- **§6.4 shrank.** Most of what it listed as unspecified is now specified. What stays absent
  on purpose says so where it belongs, and everything else is absent because nobody has
  written it down yet — a different statement, and a smaller one.


## [0.1.0] — 2026-09-06

The first published version. It declares the notation that is already in production in the first
implementation, plus the decisions taken while writing it down.

### Added

- The three rings: CommonMark 0.31.2 and GFM 0.29-gfm as the base, and the vault ring specified here.
- Links: the wikilink and its alias and anchor forms, the embed, the relative Markdown link, and the
  single resolution rule for all of them — basename, extension dropped, slug, resolved within the
  vault, anchor kept for display only.
- The slug rule, deterministic and specified digit by digit, including the case of `Lei 14.133`.
- Pending links: a link whose target does not exist is kept, reported, and resolves on its own later.
- Frontmatter: the YAML subset an indexer reads, and the rule that **the shape of the value decides
  indexing** — date, boolean, short value, list of short values; prose above forty characters
  discarded.
- The reserved vocabulary: `aliases`, `tags`, `created` and `updated`, in en-US, with translation
  allowed on the label and never on the bytes.
- Date granularity by ISO 8601 prefix in a query: the year, the month, the day. Matching is by
  prefix, never by substring.
- The reading surface: callouts with the five GitHub alert types recognised and an open vocabulary,
  mermaid diagrams, one-level transclusion, the visible pending link, and the writing-back rule for
  an interactive task list.
- `profile.json`, the machine-readable profile, with its JSON Schema.
- The conformance suite, including the cases whose expected result is nothing.
- A `package.json`, so an implementation depends on this profile **by version** instead of
  keeping a copy of it. It declares no build and no dependency: the three artefacts are exposed
  as `@memorysmith/markdown-profile/profile.json`, `/conformance.json` and `/schema.json`. An
  implementation that vendors a copy drifts from the specification silently, which is the
  failure this profile exists to prevent one layer up.

### Rejected, and declared as such

- **The inline tag `#subject`.** It carries no meaning in this profile: not an edge, not an
  attribute, rendered as plain text. Two established lineages read `#` in incompatible ways — as a
  link (Roam, Logseq) and as file metadata (Obsidian) — so there is nothing to inherit. The
  curation vocabulary belongs in the frontmatter, where the vault declares it.
- **`title` as a reserved key.** The title of a note is structural; `title:` in the frontmatter
  never renames it and never resolves a link.
- **The external link as an edge**, and **prose in the frontmatter**.
- **Anything not specified here** — `==highlight==`, `%%comment%%`, `^block-id`, `$math$`, raw HTML.
  Absence from this document is a statement, not an oversight.

[Unreleased]: https://github.com/memorysmithapp/markdown-profile/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/memorysmithapp/markdown-profile/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysmithapp/markdown-profile/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/memorysmithapp/markdown-profile/releases/tag/v0.1.0
