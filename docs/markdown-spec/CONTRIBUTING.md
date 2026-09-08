# Contributing

This repository publishes a specification. What that changes about contributing is the unit
of work: **the unit is a notation, and a notation lives in three files at once.** A change
to any one of them alone is not a change to the specification.

| File | What it holds |
|---|---|
| [`SPEC.md`](SPEC.md) | The notation in prose: its syntax, an example, its observable effect |
| [`spec.json`](spec.json) | The same notation as data, so that an implementation never keeps a copy of the specification in its own words |
| [`tests/conformance.json`](tests/conformance.json) | The cases that prove an implementation reads it, including the ones whose expected result is nothing |

> **A notation without a case is not part of the specification.** The three files move in the same
> pull request, and the check in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
> refuses a pull request where they disagree.

---

## 1. The life cycle of a change

| # | Stage | Where it lives | What is true at this stage |
|---|---|---|---|
| 1 | **Capture** | An issue | Somebody wrote a notation and got an effect they did not expect. Nobody promised anything |
| 2 | **Triage** | Comments on the issue | The question behind the report is distilled. One of the four outcomes of §3 comes out |
| 3 | **Scope closed** | The issue, in a milestone | It gets a target version of the specification |
| 4 | **Implementation** | A branch, incremental commits | Prose, data and cases move together, and the issue closes on the commit that delivers it (§4.3) |
| 5 | **Published** | `main`, through the merged pull request | What the document says, the suite proves |

No stage is skipped, with one named exception: a **contradiction inside the document** —
two sections that cannot both be true — goes straight to stage 4, and the issue describing
it is written along with the fix. A specification that contradicts itself is not a backlog
item, because every hour it stands is an hour two implementations are diverging on purpose.

## 2. Capture: opening an issue

Two forms, in [`.github/ISSUE_TEMPLATE`](.github/ISSUE_TEMPLATE):

- **A notation report.** You wrote something in a note and the effect was not what the
  specification led you to expect — or the specification does not say. This is the common case and it
  is welcome even when it turns out the document was right: a form that had to be reported
  is a form the document explained badly.
- **A notation proposal.** The output of triage, not its input: the need already
  understood, with the form, the effect and the cases it would add.

**A report says what was written and what happened.** Paste the Markdown verbatim, in a
fenced block, and name the implementation and its version. A specification exists so that two
implementations can be compared, and a report with no bytes in it cannot be.

**What never goes into an issue:** real vault content, customer names or business data.
Reduce the case to the smallest note that still shows it.

## 3. Triage: the four outcomes

| Outcome | Label | What it costs | Cuts a version? |
|---|---|---|---|
| **The document was unclear** | `documentation` | A pull request of minutes, prose only | No |
| **The document is wrong or contradicts itself** | `bug` | A fix, in the three files | Patch |
| **The specification has to say something new** | `enhancement` | A notation, in the three files | Minor |
| **Refusal** | closed as `not planned` | A comment | No |

**Refusal is a first-class outcome, and the reason is written down in the issue.** The
specification carries no catalogue of the forms it declines — `SPEC.md` §8 is one rule covering
all of them — so a refusal changes no file and leaves its record where it was argued. Close
the issue with the reason, addressed to whoever opened it, and it stays findable there.

The label `conformance` is added on top of the outcome when the suite is what changes.

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
| `release/` | The cycle that closes a whole version of the specification | `release/v0.2.0` |
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
fix(data): correct the section reference of the embed
test(conformance): add the case of a list written with one item
chore(ci): check that the three files carry the same version
```

| Scope | Touches |
|---|---|
| `spec` | `SPEC.md` |
| `data` | `spec.json`, `schema/` |
| `conformance` | `tests/` |
| `docs` | `README.md`, this file, `CHANGELOG.md` on its own |
| `ci` | Workflows and `tools/` |

**The unit of a commit is the whole change to a notation:** prose, data, cases and the
`CHANGELOG.md` entry in the same commit. Piling the changelog up for the end of the branch
is how an entry gets written from memory, days after the reason for it evaporated.

### 4.3 When an issue closes

An issue closes **when the commit that delivers it is on the branch of the cycle**, and not
when the branch reaches `main`. It closes as `completed`, with a comment naming the commit.
A refused issue closes as `not planned`, with the reason (§3).

The consequence is counterintuitive, so it is stated rather than discovered: while a cycle
runs there are closed issues and a `main` that does not say that thing yet. What declares
the scope of a version is the **milestone**, and what carries everything to `main` is the
single pull request of the cycle, at the end. Closing on the commit is what makes progress
visible while the branch runs, and the price of it is that here *closed* means "it is on the
branch of the version".

`Closes #N` is still written in the commit message — it is the link between the commit and
the reason it exists — but GitHub acts on that keyword only at the merge, which is weeks
after the moment somebody needs to see the milestone move.

**No pull request is opened per issue.** It would take a branch per issue, and over a cycle
it would leave a merge button available for weeks with the version half done.

## 5. The pull request

The description has two mandatory sections, and the template
([`.github/pull_request_template.md`](.github/pull_request_template.md)) carries both.

1. **Summary of changes.** What the specification says now that it did not say before, and what
   an implementation has to change to keep conforming. An issue is referenced with
   `Closes #N`.
2. **AI productivity analysis.** The table in the template, filled in from the git history
   and the diff, without guessing and without omitting a field.

## 6. Versioning

The specification carries its own version, independent of any implementation, and follows
[Semantic Versioning](https://semver.org).

| Kind of change | Bump |
|---|---|
| A notation removed, or the effect of an existing one changed | Major |
| A notation added, or an effect gained | Minor |
| Prose, a correction that changes no effect, a case added for a notation already declared | Patch |

While the version is `0.x`, a breaking change may arrive in a minor version, recorded in
`CHANGELOG.md` under `Changed` or `Removed`.

**The canonical version is the `version` field of `spec.json`.** `SPEC.md`,
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

No dependencies, no build. It verifies that `spec.json` matches its schema, that every
notation an indexer decides has at least one conformance case, that every case names a
notation that exists, that identifiers are unique, that every section reference resolves to
a real heading of `SPEC.md` — from `spec.json` and from the prose of the document itself
— and that every file carrying the version agrees on it.

## 8. Licence

By contributing you agree that the text of the specification is published under
[CC BY 4.0](LICENSE-TEXT) and that `spec.json`, the schema and the conformance suite are
published under [MIT](LICENSE).
