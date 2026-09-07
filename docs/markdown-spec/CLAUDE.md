This file is the **single source of truth** for all agent behaviour in this repository.
Claude Code reads it automatically on every session and on every sub-agent invocation.

---

## Project identity

### Organisation
memorysmithapp

### Project name
markdown-profile

### Project identifier
markdown-profile

### Product domain
md.memorysmith.app

### What it is
The MemorySmith Markdown Profile: a specification of the Markdown notation a knowledge
vault is written in, published as prose, as data and as an executable conformance suite. It
is a profile, not a syntax — every form it declares comes from CommonMark, from GFM or from
the vault editors that established it, chiefly Obsidian — and its distinguishing claim is
that it states the **observable effect** of each form, including the forms it deliberately
gives no effect to.

### What it is not
It is not an implementation, and no code that reads a note lives here. The suite is data
and carries no runner, so that an implementation in any language can consume it.

### Canonical version
The `version` field of [`profile.json`](profile.json). `SPEC.md`,
`tests/conformance.json` and `package.json` mirror it, and `npm run check` refuses a
divergence. **This file never carries a copy of the version**, because a second place to
update is a second place to forget — and that failure is not hypothetical here: 0.2.0 was
released with the header of `SPEC.md` still saying 0.1.0, and nothing caught it.

### Git remote
github.com/memorysmithapp/markdown-profile

### The relationship to the product
[memorysmithapp/memorysmithapp](https://github.com/memorysmithapp/memorysmithapp)
implements this profile and pins a version of it. It is the first implementation, never the
definition: a behaviour is part of the profile when it is in these files, not when the
product does it. When work here would force a change there, that is an issue in the other
repository, opened after the merge here, and never a commit that reaches across.

---

## Repository layout

```
markdown-profile/
├── SPEC.md                     # the specification in prose, the normative document
├── profile.json                # every notation as data, validated by the schema
├── schema/profile.schema.json  # the JSON Schema of profile.json
├── tests/conformance.json      # the executable half: input and expected result
├── tools/check-profile.mjs     # the consistency check, no dependencies
├── package.json                # the npm distribution of the data, and `npm run check`
├── CHANGELOG.md                # Keep a Changelog, updated in the same commit
├── CONTRIBUTING.md             # the process: from an issue to main
└── README.md                   # what this is and why, for whoever arrives
```

Nothing here is generated and there is no build. A file that has to be produced by a
command does not belong in this repository.

---

## The rule that governs every change

> **The unit of work is a notation, and a notation lives in three files at once:
> `SPEC.md`, `profile.json` and `tests/conformance.json`. They move in the same commit.**

A notation without a conformance case is not part of the profile. A `profile.json` entry
with no section in `SPEC.md` is data nobody can read. A section of `SPEC.md` with no entry
in `profile.json` is the drift this repository exists to prevent.

The one exception is stated where it applies: an entry whose `reader` is `reading-surface`
is rendering, and what a callout looks like is not something a JSON file can assert.
`tools/check-profile.mjs` knows the exception; it does not need to be argued again in a
pull request.

Run `npm run check` before every commit. It is the whole of CI, it needs no dependencies,
and it takes under a second.

---

## Canonical documentation

Each document answers one question, and where one of them already answers it, the others
**reference it by section and never repeat it**.

| The paragraph answers | It belongs to |
|---|---|
| "This notation means this, and produces this" | `SPEC.md` |
| "This is what the profile is for, and why it exists" | `README.md` |
| "This is how work flows, from an issue to `main`" | `CONTRIBUTING.md` |
| "This is what changed, and in which version" | `CHANGELOG.md` |
| "This is what we have yet to decide, evaluate or declare" | **A GitHub issue, never a file** |

The last row is absolute. An undecided notation, an open question about a form and a
roadmap never enter `SPEC.md`, because the document describes what conforming software does
today. A specification that describes the future is a specification nobody can implement.

**Never add version notes, revision dates or "last updated" footers to any file.** The git
history and `CHANGELOG.md` already hold that, they fall out of sync immediately, and they
are noise the reader has to filter out. If one already exists in a file being edited, remove
it in the same change.

---

## Language policy

**The whole repository is written in American English (en-US).** Everything: `SPEC.md`, the
prose of `profile.json`, `README.md`, `CHANGELOG.md`, this file, `CONTRIBUTING.md`, the
issue and pull request templates, the labels, commit messages, pull request descriptions,
branch names, identifiers and comments in `tools/`.

The reason is not preference. This document is read by whoever implements it, in any
country, and a second language in the specification layer charges a cost exactly at the
door somebody from outside comes in through.

Two exceptions, both deliberate:

- **Examples inside `SPEC.md` and the conformance suite** may be in any language, and some
  are in Portuguese on purpose: `[[Contratação Direta 2.0]]` is what proves the slug rule
  folds accents, and an English-only suite would have shipped without ever testing it.
- **Answers in issues**, in the language of whoever opened it. The language of the
  repository is not a demand on whoever reports a problem.

Neither the git history nor issues and pull requests already written are rewritten: they
are dated records.

---

## Operational policies

The complete process is in [`CONTRIBUTING.md`](CONTRIBUTING.md). What follows is the
normative form — what may never be violated — and **where this file summarises, it does not
repeat the text from there**.

### Branch protection

`main` is protected by a repository ruleset. **Every change reaches it only through a pull
request merged on GitHub**, holding equally for a notation, a fix, prose, governance and a
version bump.

- Never commit or push directly to `main`. Check `git branch --show-current` before the
  first edit of a session, not after it.
- Never work around the protection. Not "Bypass rules and merge", not `gh ... --admin`, not
  `git push --no-verify`, not an equivalent, even holding administrator rights.
- If a merge is blocked, **stop and report**. Ask how to proceed instead of overriding the
  rule.
- The only direct writes to `main` are annotated tags on already merged commits.

### Branches, commits and pull requests

The five prefixes, the commit scopes and the two mandatory sections of a pull request
description are in `CONTRIBUTING.md` §4 and §5. Commit along the branch and push on every
commit, or at least every two or three: a branch that exists only on this machine is work
nobody can see and nobody can recover.

### Versioning

The table of what cuts which bump is in `CONTRIBUTING.md` §6. Two rules stay here because
they are the ones an agent breaks:

- **A change that alters no notation does not cut a version.** Governance, CI and prose
  wait in `[Unreleased]` for the next cycle, which takes the whole accumulation.
- **The version bump reaches `main` only through a pull request**, and the tag is created
  after the merge, pointing at the merged commit.

### CHANGELOG

Update `CHANGELOG.md` **in the same commit** as the change it documents, using the
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories. Write from the
perspective of whoever writes a note or implements the profile, never of the file that was
edited.

A notation **removed** is recorded as explicitly as one added, and under `Removed`. What is
not recorded is a form the profile declines: `SPEC.md` §8 covers every one of them with a
single rule, and a refusal that changes no file belongs in the issue that argued it.

**Good:** `Added the anchor form of the wikilink, which links to a section and resolves to the note`
**Bad:** `Updated section 3.1 of SPEC.md and added two entries to profile.json`

### Issues

An issue is opened for anything undecided, and closed with a reason when refused. The four
outcomes of triage are in `CONTRIBUTING.md` §3. Never open an issue containing real vault
content, customer names or business data: this repository is public.
