# Changelog

All notable changes to this profile are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the profile follows
[Semantic Versioning](https://semver.org).

A notation **added** is a minor version. A notation **removed**, or an effect **changed**, is a
major version. While the profile is `0.x`, a breaking change may arrive in a minor version.

## [Unreleased]

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

[Unreleased]: https://github.com/memorysmithapp/markdown-profile/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/memorysmithapp/markdown-profile/releases/tag/v0.1.0
