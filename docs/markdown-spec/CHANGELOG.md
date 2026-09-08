# Changelog

All notable changes to this specification are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the specification follows
[Semantic Versioning](https://semver.org).

A notation **added** is a minor version. A notation **removed**, or an effect **changed**, is a
major version. While the specification is `0.x`, a breaking change may arrive in a minor version.

## [Unreleased]

### Changed

- **The name is the MemorySmith Markdown Specification, and the repository is
  `markdown-spec`.** No notation changes and no vault behaves differently. What changes for
  an implementation is every path it imports: `profile.json` is now
  [`spec.json`](spec.json), `schema/profile.schema.json` is
  [`schema/spec.schema.json`](schema/spec.schema.json), the `profile` field of `spec.json`
  and of `tests/conformance.json` is `spec`, the schema `$id` follows the file, and the
  package is `@memorysmith/markdown-spec` — exporting `./spec.json`, `./conformance.json`
  and `./schema.json`. The document still declares no syntax of its own: it profiles
  CommonMark, GFM and the vault editors, and §1.1 says so in those words.

### Removed

- **The implementations table.** `SPEC.md` no longer lists who implements the specification. An
  implementation states the roles it claims and the version it adopts (§1.4), where that
  fact can be observed; this document does not keep a copy of it. It was the one claim here
  about a build in another repository — neither the suite nor `npm run check` could ever
  see it, and it was wrong in two consecutive versions. The last correction to the cell
  never reached a release: it is removed here along with the table it corrected.
  *Notation at a glance* moves from Appendix B to Appendix A.

## [0.4.0] — 2026-09-07

The cycle in which the document stopped describing itself in tiers and stopped keeping a
list of what it refuses. What it says now is one thing: the notation it accepts, and what
each form produces. Anything not on that list is answered by a single closing rule instead
of by a catalogue that could never be finished.

Two notations leave, which cuts the minor version while the profile is `0.x`. Neither was
ever read, so no vault behaves differently on account of them — what changes for an
implementation is that `profile.json` no longer carries the `ring` or `recognised` fields.

### Added

- **Bold and italic together, and nested emphasis** (§3.12). `***a***` appeared only inside
  a code sample, with no sentence saying what it produced; `___a___` appeared nowhere as
  emphasis at all, since both occurrences of `___` in the document were the thematic break;
  and nothing anywhere said that emphasis nests, which is the form an author writes without
  ever wondering whether it is allowed. `profile.json` gains a `strong-emphasis` entry, so
  the form has an id an implementation can cite, and nesting is stated in the effect of
  `emphasis`, since it is a composition rule rather than a form of its own.
- **The crossing between `___` and the thematic break is written down.** Alone on a line it
  is a thematic break, because blocks are resolved before inlines — the same order that makes
  a `[!warning]` inside a fence code and a `[[wikilink]]` inside a code span text.

- **§7.10, what a Reader may fetch**, stated beside §7.9, which says what it must not
  execute. An image whose destination names a host is a request to that host, made when the
  note is opened, carrying the reader's address and the moment they read it — with the
  trigger written by whoever wrote the note, which is the sentence §7.9 uses to refuse raw
  HTML. The two forms sat on opposite sides of a line nobody had drawn: `<img src="https://…">`
  was refused by name and `![](https://…)` was never mentioned. A Reader MUST now state
  whether opening a note causes such a request; never doing it, doing it only on the reader's
  action, and doing it and saying so all conform, and **only silence does not**. How is left
  to the implementation, as §1.2 requires, and the disclosure takes the shape §6.3 already
  uses for the cardinality ceiling.
- **A diagram is opaque to the link reader** (§7.2), which the section on diagrams did not
  say. A diagram is a fenced code block, so §5.6 applies to everything inside it: nothing in
  one produces an edge. A Reader MAY draw a node as a link to a note — the diagram languages
  have their own way of asking for that — and such a link is **navigation and never an
  edge**, appearing in no graph and generating no backlink. The answer was derivable in two
  hops from a section about code blocks, and an author who wants a linked diagram is reading
  §7.2, where none of it appeared. A conformance case now holds it, next to the two for a
  link in a code fence and a code span.
- Task lists move from §7.10 to §7.11, following the section added above. No effect changes
  with them.
- **An embed inside a table cell is drawn as a link** (§4.1, §7.3). A cell holds inlines and
  never blocks, and an embed of a note asks for blocks, so the two sections could not both
  hold and the profile said nothing about which won. It is the answer §7.3 already gives
  wherever expansion cannot happen — inside embedded content, and past the ceiling a Reader
  sets — so a cell is the third such place and the rule everywhere is one rule: where an
  embed cannot expand it becomes a link, and it is never dropped. The graph is untouched,
  since an embed is the same edge as a plain link. An embed whose target is an image is an
  inline and fits a cell as an image does.
- **The first tables in the conformance suite.** §4.1 made two claims an Indexer has to
  honour — that a wikilink in a cell is an ordinary link, and that `[[Target\|alias]]`
  resolves to `Target` with the escape consumed by the table — and the suite had no table in
  it at all; one case in the whole file contained a pipe. The claims lived only in §4.1's
  prose, and the check requires a case per *entry*, never per prose claim, so a rule stated
  in a section whose entry is display was invisible to it by construction. Three cases now
  hold it, including one on a table written without the outer pipes.

### Changed

- **Eight examples now exercise the rule stated beside them.** The schema calls an example
  'a body exercising the form, used verbatim by the conformance suite', so an example that
  misses the interesting part of a form is a case that tests nothing. Eight entries stated a
  rule in `effect` and illustrated it with the one case where the rule does not show:
  `thematic-break` explained that `---` has three readings and showed `***`; `list-ordered`
  said the numbers after the first are ignored and numbered its items by hand; `list-bullet`,
  `block-quote`, `task-list`, `code-fenced`, `code-span` and `backslash-escape` the same. All
  eight are `reading-surface`, which is why nothing caught it: they back no conformance case,
  so nothing was checking.
- **Four traps are now drawn in the prose**, next to the form they catch: `---` directly under
  a paragraph is a setext heading and not a break, and one blank line is the whole difference;
  `- - -` is a break and not a bullet item holding `- -`; changing the marker character starts
  a new list with no visible sign; and a fence nests, because it closes only on the same
  character at the same length or longer, which is what lets a code block hold a code block
  and is how this document writes its own examples.

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
- **Obsidian is named as a reference source**, alongside CommonMark and GFM, and carried in
  the `sources` array of `profile.json`. Seven notation families came from it — the wikilink
  and its alias, anchor, embed and block forms, callouts, marked text, comments and block
  identifiers — and the document credited them to *the vault editors*, an unnamed plural.
  It is named as a **source and never as a compatibility claim**: where Obsidian and this
  document differ, this document governs, which is the opposite of the precedence CommonMark
  and GFM hold. Two other lineages are named where their form is specified: the `---`
  frontmatter block is Jekyll's (§6) and the alert form of the callout is GitHub's (§7.1).
- A source in `profile.json` may now omit `version`. Obsidian publishes documentation rather
  than a versioned specification, and pinning an app release would claim a precision the
  documentation does not have.
- **The profile no longer keeps a catalogue of the forms it declines.** §8 was four
  subsections listing notation the profile refused, and it could never be complete: every
  form of every other dialect was a candidate for it, so it grew with each dialect that
  shipped and was sampled rather than maintained — footnotes were refused in prose and never
  got an entry in `profile.json` at all. It is now **one rule**: §3 to §7 are the whole of
  the notation this profile accepts, and anything not described there may be rendered however
  an implementation likes, must yield no meaning, and cannot be claimed as conformance. The
  three consequences are stated separately because they are easy to run together — in
  particular, this document not describing a form is not this document forbidding it.
- **Three rules moved out of §8 into the section that governs them**, and are stated as
  effects rather than as refusals. That an external destination renders as a link and is
  never resolved against the vault is §5.2, the first step of resolution. That a frontmatter
  value over forty characters is read and discarded is §6.3, beside the rule that sets the
  ceiling. §3.15 and §4.4, which pointed at §8.2 for the rule that an autolink is never an
  edge, point at §5.2.
- **§4.6 is gone.** It took a position on five forms GitHub renders and GFM does not
  specify; three of those positions were provenance, which §2 now states as a source, and two
  were the catalogue.
- **`profile.json` no longer carries a `recognised` field.** It marked an entry whose point
  was that nothing happens, and no entry has that point any more: the five that carried
  `recognised: false` for another reason — `external-link`, `raw-html`, `link-in-code`,
  `frontmatter-prose` and `frontmatter-title` — now state what the form **does**, positively,
  and keep their conformance cases. An implementation that filtered on the field reads every
  entry as declared.
- Raw HTML moves from §7.10 to §7.9 and task lists from §7.11 to §7.10, following the
  removal above. No effect changes with them.

### Fixed

- **Strikethrough is `~~text~~` and nothing else.** §4.3 gave the syntax as one or two
  tildes, and GFM 0.29-gfm defines it as two: the single tilde is GitHub's renderer going
  past its own specification, and §2.1 makes the source govern. `H~2~O` now reaches the page
  as those exact characters instead of striking its middle. The Appendix B row had said `~~`
  alone since it was written, so the document disagreed with itself in three places.
- **The implementations table said `Tracking 0.1.0` while the implementation tracked 0.3.0**,
  and its '1 open' deviation pointed at an issue that had been closed. Both were wrong
  because the table was duplicated verbatim in `README.md` and `SPEC.md` with nothing able to
  check either copy — a fact about another repository, held in two places here. Appendix A of
  `SPEC.md` now holds it alone and the README links to it, which is also the more honest
  place: conformance is the suite passing in public, never a claim in a README.

- **The rule that keeps a price from becoming a formula now keeps a price from becoming a
  formula.** §7.8 named three things it protected — a price, a shell variable and a lone
  currency symbol — and stated two prohibitions that covered only the third. Both looked at
  the delimiter's outside edge: what follows an opener, what precedes a closer. Every case
  that failed was decided by the inside edge, so `R$100 e o frete R$200` opened a formula at
  the first `$`, closed it at the second, and ate the middle of the sentence. A `$`
  immediately preceded by an alphanumeric character no longer opens one, and a `$`
  immediately followed by a digit no longer closes one.
- The claim that a **shell variable** is protected is withdrawn rather than left standing.
  `$HOME` and `$PATH` in one sentence present two delimiters that look legal by every local
  rule, and the honest answer is a code span, which §3.7 makes opaque. The profile is better
  off protecting one thing truthfully than three nominally.
- `math-inline`'s example exercised no part of this rule, which is why it shipped broken. It
  is now one body carrying both directions: two `$` that stay text and two that become a
  formula.

### Removed

- **The inline tag `#subject` is no longer a declared notation.** Its two conformance cases
  go with it. Nothing about the form changes for whoever writes a note — it was never read
  and it still is not — but the profile stops carrying a section, an entry and two cases to
  say so, because §8 now says it about every undescribed form at once. To group notes by
  subject write `tags:` in the frontmatter; to connect a note to a subject worth a note of
  its own, write `[[subject]]`.
- **Superscript and subscript are no longer a declared absence.** §7.9 existed to say the
  profile has no notation for them; its entry and its conformance case go. `~x~` and `^x^`
  are undescribed notation like any other, and §8 covers them.

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

[Unreleased]: https://github.com/memorysmithapp/markdown-spec/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/memorysmithapp/markdown-spec/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/memorysmithapp/markdown-spec/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/memorysmithapp/markdown-spec/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/memorysmithapp/markdown-spec/releases/tag/v0.1.0
