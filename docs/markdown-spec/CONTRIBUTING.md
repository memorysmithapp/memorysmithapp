# Contributing

This repository publishes a specification. What that changes about contributing is the unit
of work: **the unit is a notation, and a notation lives in three files at once.** A change
to any one of them alone is not a change to the profile.

| File | What it holds |
|---|---|
| [`SPEC.md`](SPEC.md) | The notation in prose: its syntax, an example, its observable effect |
| [`profile.json`](profile.json) | The same notation as data, so that an implementation never keeps a copy of the specification in its own words |
| [`tests/conformance.json`](tests/conformance.json) | The cases that prove an implementation reads it, including the ones whose expected result is nothing |

> **A notation without a case is not part of the profile.** The three files move in the same
> pull request, and the check in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
> refuses a pull request where they disagree.

---

## 1. The life cycle of a change

| # | Stage | Where it lives | What is true at this stage |
|---|---|---|---|
| 1 | **Capture** | An issue | Somebody wrote a notation and got an effect they did not expect. Nobody promised anything |
| 2 | **Triage** | Comments on the issue | The question behind the report is distilled. One of the four outcomes of §3 comes out |
| 3 | **Scope closed** | The issue, in a milestone | It gets a target profile version |
| 4 | **Implementation** | A branch, incremental commits | Prose, data and cases move together |
| 5 | **Published** | `main`, through the merged pull request | What the document says, the suite proves |

No stage is skipped, with one named exception: a **contradiction inside the document** —
two sections that cannot both be true — goes straight to stage 4, and the issue describing
it is written along with the fix. A specification that contradicts itself is not a backlog
item, because every hour it stands is an hour two implementations are diverging on purpose.

## 2. Capture: opening an issue

Two forms, in [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE):

- **A notation report.** You wrote something in a note and the effect was not what the
  profile led you to expect — or the profile does not say. This is the common case and it
  is welcome even when it turns out the document was right: a form that had to be reported
  is a form the document explained badly.
- **A notation proposal.** The output of triage, not its input: the need already
  understood, with the form, the ring, the effect and the cases it would add.

**A report says what was written and what happened.** Paste the Markdown verbatim, in a
fenced block, and name the implementation and its version. A profile exists so that two
implementations can be compared, and a report with no bytes in it cannot be.

**What never goes into an issue:** real vault content, customer names or business data.
Reduce the case to the smallest note that still shows it.

## 3. Triage: the four outcomes

| Outcome | Label | What it costs | Cuts a version? |
|---|---|---|---|
| **The document was unclear** | `documentation` | A pull request of minutes, prose only | No |
| **The document is wrong or contradicts itself** | `bug` | A fix, in the three files | Patch |
| **The profile has to say something new** | `enhancement` | A notation, in the three files | Minor |
| **Refusal** | closed as `not planned` | A comment | No |

**Refusal is a first-class outcome, and it is written down.** This profile is as much a
list of what it declines to mean as a list of what it means (`SPEC.md` §6), so a refused
proposal is not a rejection to be buried: it is a candidate for that section. Close the
issue with the reason, addressed to whoever opened it.

The classification labels say which ring the issue lives in — `ring:base`, `ring:extended`,
`ring:memorysmith` — plus `conformance` when the suite is what changes.

## 4. Work on the branch

`main` is protected. **Every change reaches it through a reviewed pull request**, without
exception: a notation, a fix, prose, governance and a version bump alike. The only direct
writes to `main` are annotated tags on already merged commits.

Never work around the protection — no "Bypass rules and merge", no `gh ... --admin`, no
`git push --no-verify` — even holding the rights to do it. **If a merge is blocked, stop
and report it.**

### 4.1 Branch names

| Prefix | Use | Example |
|---|---|---|
| `release/` | The cycle that closes a whole profile version | `release/v0.2.0` |
| `feat/` | A notation added, or an effect gained | `feat/callout-folding` |
| `fix/` | A defect in the text, the data or a case | `fix/slug-truncation` |
| `docs/` | Prose that changes no notation | `docs/self-contained-spec` |
| `chore/` | Governance, CI, tooling | `chore/repository-governance` |

### 4.2 Commits

Commit along the branch and push often. Every commit has to leave `npm run check` passing.

Messages in the imperative mood and the present tense, following
[Conventional Commits](https://www.conventionalcommits.org), with one of these scopes:

```
feat(spec): add the folding marker to the callout
fix(profile): correct the section reference of the embed
test(conformance): add the case of a list written with one item
chore(ci): check that the three files carry the same version
```

| Scope | Touches |
|---|---|
| `spec` | `SPEC.md` |
| `profile` | `profile.json`, `schema/` |
| `conformance` | `tests/` |
| `docs` | `README.md`, this file, `CHANGELOG.md` on its own |
| `ci` | Workflows and `tools/` |

**The unit of a commit is the whole change to a notation:** prose, data, cases and the
`CHANGELOG.md` entry in the same commit. Piling the changelog up for the end of the branch
is how an entry gets written from memory, days after the reason for it evaporated.

## 5. The pull request

The description has two mandatory sections, and the template
([`.github/pull_request_template.md`](.github/pull_request_template.md)) carries both.

1. **Summary of changes.** What the profile says now that it did not say before, and what
   an implementation has to change to keep conforming. An issue is referenced with
   `Closes #N`.
2. **AI productivity analysis.** The table in the template, filled in from the git history
   and the diff, without guessing and without omitting a field.

## 6. Versioning

The profile carries its own version, independent of any implementation, and follows
[Semantic Versioning](https://semver.org).

| Kind of change | Bump |
|---|---|
| A notation removed, or the effect of an existing one changed | Major |
| A notation added, or an effect gained | Minor |
| Prose, a correction that changes no effect, a case added for a notation already declared | Patch |

While the version is `0.x`, a breaking change may arrive in a minor version, recorded in
`CHANGELOG.md` under `Changed` or `Removed`.

**The canonical version is the `version` field of `profile.json`.** `SPEC.md`,
`tests/conformance.json` and `package.json` mirror it, and CI refuses a pull request where
the four disagree. Every mirror is a place somebody forgets, and this one already happened:
0.2.0 was released with the header of `SPEC.md` still saying 0.1.0.
A change that alters no notation — governance, CI, prose — **does not cut a version**: it
waits in `[Unreleased]` for the next cycle.

The tag is created **after** the merge and points at the merged commit.

## 7. Running the checks

```sh
npm run check
```

No dependencies, no build. It verifies that `profile.json` matches its schema, that every
notation an indexer decides has at least one conformance case, that every case names a
notation that exists, that identifiers are unique, that every section reference resolves to
a real heading of `SPEC.md` — from `profile.json` and from the prose of the document itself
— and that every file carrying the version agrees on it.

## 8. Licence

By contributing you agree that the text of the specification is published under
[CC BY 4.0](LICENSE-TEXT) and that `profile.json`, the schema and the conformance suite are
published under [MIT](LICENSE).
