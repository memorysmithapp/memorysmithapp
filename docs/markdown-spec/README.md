# MemorySmith Markdown Profile

**The Markdown notation a knowledge vault is written in — with the suite that proves an implementation reads it.**

📄 **[Read the specification](SPEC.md)** · 🔧 [`profile.json`](profile.json) · ✅ [Conformance suite](tests/)

---

## Why this exists

There are exactly two formal specifications in the Markdown family. [CommonMark](https://spec.commonmark.org/) is strict and has a test suite. [GFM](https://github.github.com/gfm/) documents a superset of it: tables, task lists, strikethrough, autolinks. Everything above that line — wikilinks, embeds, callouts, frontmatter, the notation every knowledge vault is actually written in — is convention, and each tool means something slightly different by it. Not even GitHub stays inside its own spec: alerts, footnotes and diagrams are rendered outside it.

That is tolerable for prose that a person reads. It stops being tolerable the moment software has to derive a graph and an index out of the same files, and it stops being tolerable much faster when an **agent** is doing the writing: an agent cannot see that the tag it typed did nothing.

This profile closes the gap in the only way that survives contact with a second implementation: **a notation declared with its observable effect, and a conformance suite that proves it.**

## What it specifies

Three rings, and the third is the one nobody else writes down:

| Ring | What |
|---|---|
| **Base** | CommonMark 0.31.2, in full |
| **Extended** | GFM 0.29-gfm, in full |
| **MemorySmith** | Wikilinks, aliases, anchors, embeds, the resolution rule, frontmatter, the reserved vocabulary, callouts, diagrams, transclusion, pending links |

And, with equal weight, **what it rejects**: an inline `#tag`, an external link as an edge, prose in the frontmatter. A profile that only lists what works is half a profile — most of what goes wrong is a notation somebody believed in, not one they typed wrongly.

## What it does not specify

Storage, transport, authentication, an API, a file layout, or how a vault should be organised. Those belong to the tool and to whoever keeps the vault. This document ends where the notation ends.

## Using it

The profile is published as data as much as prose, so an implementation never has to keep a copy of the specification in its own words:

- [`profile.json`](profile.json) — every notation, with its syntax, an example, its effect and whether it is recognised. Validated by [`schema/profile.schema.json`](schema/profile.schema.json).
- [`tests/conformance.json`](tests/conformance.json) — the cases, including the ones whose expected result is nothing.

Build your documentation from the first, run the second in your CI, and the two cannot drift apart.

## Conformance

An implementation claims one or more roles — **Reader**, **Indexer**, **Writer** — and conformance is stated per role. See [SPEC.md §1.4](SPEC.md#14-roles).

Conformance is the suite passing in public. It is never a claim in a README, including this one.

| Implementation | Roles | Profile version | Known deviations |
|---|---|---|---|
| [MemorySmith.app](https://memorysmith.app) | Reader, Indexer, Writer | Tracking 0.1.0 | [1 open](https://github.com/memorysmithapp/memorysmithapp/issues/70) |

## Versioning

The profile carries its own version, independent of any implementation, and follows [Semantic Versioning](https://semver.org): a notation added is a minor version, a notation removed or an effect changed is a major one. While the version is `0.x`, a breaking change may arrive in a minor version.

Each release is published at a stable URL under <https://md.memorysmith.app>; the unversioned root always serves the latest.

## Contributing

Questions, gaps and disagreements are issues. A change to the notation is a change to `SPEC.md`, `profile.json` and `tests/conformance.json` **in the same pull request** — a notation without a case is not part of the profile.

`main` is protected and every change reaches it through a reviewed pull request. Before committing, run the consistency check, which needs no dependencies and takes under a second:

```sh
npm run check
```

The whole process — the two issue forms, the four outcomes of triage, the branch names, the commit convention and what cuts a version — is in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Licence

The text of the specification is licensed under [CC BY 4.0](LICENSE-TEXT). `profile.json`, the schema and the conformance suite are licensed under [MIT](LICENSE).

*MemorySmith* is a trademark. Anyone may implement this profile; only an implementation that passes the conformance suite may describe itself as conforming to it.
