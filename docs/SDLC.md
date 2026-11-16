# SDLC

How a change travels in this repository, from a need to production. It does not say what the product does or under which rule ([`PRD.md`](PRD.md)), nor how the software is built ([`ARCHITECTURE.md`](ARCHITECTURE.md)).

## Contents

1. [The life cycle of a change](#1-the-life-cycle-of-a-change)
2. [Issues and milestones](#2-issues-and-milestones)
3. [Branches](#3-branches)
4. [Commits](#4-commits)
5. [When an issue closes](#5-when-an-issue-closes)
6. [Pull request](#6-pull-request)
7. [A blocked merge](#7-a-blocked-merge)
8. [Tests and review](#8-tests-and-review)
9. [Versioning](#9-versioning)
10. [Release](#10-release)
11. [Rollback](#11-rollback)
12. [Done criteria](#12-done-criteria)

## 1. The life cycle of a change

| # | Stage | Where it lives | What is true at this stage |
|---|---|---|---|
| 1 | **Need** | Whoever felt it | A friction, a risk or an idea. Nothing is promised |
| 2 | **Issue** | A GitHub issue | The need is written down, as the friction and not only as a solution |
| 3 | **Triage** | Comments on the issue | One of three outcomes: accepted into a milestone, kept open without one, or closed as *not planned* with the reason |
| 4 | **Branch** | The `release/vX.Y.Z` of the issue's milestone, or a single-purpose branch for what [§3](#3-branches) allows | Work starts, and only on an explicit go-ahead from the owner, which puts the issue in a milestone |
| 5 | **Commits** | The branch | Code, test, document and changelog move together |
| 6 | **Staging** | The workflow *Staging*, started by hand on the branch | The branch is delivered to staging and exercised there |
| 7 | **Pull request** | GitHub | The single PR of the branch, reviewed by the owner |
| 8 | **Merge** | `main` | What is in the documents is true on `main` |
| 9 | **Production** | The workflow *Production* | The merged commit is delivered, then tagged and released |

`main` is protected: every change reaches it through a pull request, without exception, documentation, maintenance and version bumps included. Nobody pushes to `main`, and nobody uses `--admin`, *Bypass rules*, `--no-verify` or an equivalent. The only writes that reach the repository outside a pull request are the annotated tags `publish-release` writes on already merged commits.

No stage is skipped out of haste, with one named exception: a **defect that blocks use** goes straight to stage 4, and the issue describing it is written along with the fix, not before it.

## 2. Issues and milestones

**Issues use GitHub's blank default.** There are no issue templates and no pull request template; the format of a pull request is the text of [§6](#6-pull-request).

**GitHub's default labels are the base, and are never removed** (`bug`, `documentation`, `enhancement`, `question`, …). No label is created for what a default one already says, nor for a state: being accepted for a version is the **milestone**, and having been delivered or refused is the way the issue was **closed**.

**This repository adds two families of product labels.** An issue carries every value that applies, and none when no value does.

`domain:` answers which bounded context the issue affects, one value per service under `memorysmithapp-backend/services/`. Color `1D3557`.

| Label | Description |
|---|---|
| `domain:access` | Access: subscriptions, members, roles, invitations, shares |
| `domain:knowledge` | Knowledge: notebooks, folders, notes, files |
| `domain:discovery` | Discovery: links, graph, search, facets |
| `domain:audit` | Audit: the trail and provenance |
| `domain:agent` | Agent access: the MCP connector and its skills |
| `domain:portability` | Portability: export, import and transfers |

`layer:` answers which project of the monorepo the issue touches. Color `455A7A`.

| Label | Description |
|---|---|
| `layer:web` | The web interface |
| `layer:backend` | The services, the kernel and the contracts |
| `layer:infra` | Infrastructure, CDK, deployment |
| `layer:tools` | Operating and evaluation tools of the product |

Each is created with `gh label create <label> --color <color> --description "<description>"`, so a new value is added to this section and to GitHub in the same change.

**An issue before implementing.** When the owner asks for an opinion, or says "open the issue", the answer is to register the issue and ask; implementation starts only on an explicit go-ahead.

**The go-ahead puts the issue in a milestone**, the version that will carry it, and work starts on the branch [§3](#3-branches) assigns it: for anything deployed, that milestone's `release/vX.Y.Z`, created from `main` if it does not exist yet.

**A milestone per version declares its scope.** An issue in milestone `vX.Y.Z` is accepted for that cycle; one without a milestone has not been decided yet. A larger piece of work is one parent issue with **sub-issues** for its parts, in the order they are built.

**Refusal is an outcome, and it is written down:** the issue closes as *not planned*, with the reason in a comment.

**A document never describes the future. If it is in a document, it is true now.** What is not true yet lives in an issue:

| This | Goes to |
|---|---|
| A hypothesis of a need, a request, a reported friction | An issue |
| Scope under discussion, an alternative being evaluated | The issue itself, before a milestone |
| Roadmap, build order, target version | The milestone of the version, and the order of its sub-issues |
| A risk not yet addressed, an undecided question | A `question` issue, with the criterion that closes it in its body |
| Change history, release notes, revision dates | `CHANGELOG.md` and the git history |

## 3. Branches

| Prefix | Use | Lands on | Example |
|---|---|---|---|
| `release/` | The cycle of one version, named after its milestone, created from `main` | `main`, by the single pull request of the cycle | `release/v0.14.0` |
| `feat/` | One feature, worked apart from the rest of its cycle | The `release/vX.Y.Z` of its milestone, never `main` | `feat/note-move` |
| `fix/` | One fix, worked apart from the rest of its cycle | The `release/vX.Y.Z` of its milestone, never `main` | `fix/graph-touch-target` |
| `docs/` | Documentation and repository governance | `main` | `docs/sdlc-rollback` |
| `chore/` | Maintenance of what is not deployed: the CI that checks the repository, its configuration | `main` | `chore/actions-on-main` |

`release/` carries no Conventional Commits type on purpose: a cycle holds many types at once. The commits inside it keep their types.

**Which branch takes what.** A change to what is deployed (anything under `memorysmithapp-backend/`, `memorysmithapp-frontend/` or `memorysmithapp-infra/`, the workspace files `pnpm-lock.yaml` and `pnpm-workspace.yaml`, and the dependencies of any of them) always lands on the `release/vX.Y.Z` of its issue's milestone: committed there, or brought there by a pull request whose base is that branch. It never reaches `main` any other way, because a merge to `main` that touches it starts the workflow *Production* ([§10](#10-release)). The tools of `tools/` are released with the product ([§9](#9-versioning)), so they land there too.

A single-purpose branch reaches `main` with a pull request of its own only when it touches nothing deployed: documents, the CI that checks the repository, its configuration. Its `CHANGELOG.md` entry, when it has one, waits in `[Unreleased]` for the next cut ([§9](#9-versioning)). A **hotfix** is not an exception: it is a release of its own, the `release/vX.Y.Z` of the patch version, holding the fix and its cut ([§11](#11-rollback)).

A cycle has **one** branch and **one** pull request to `main` at its end. No pull request to `main` is opened per issue: it would need a branch per issue and leave a merge button available with the version half done. A `feat/` or `fix/` branch opens its pull request against the release branch of its milestone.

## 4. Commits

**Conventional Commits, imperative mood:** `feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, with a scope when it helps (`feat(knowledge): …`). The body says why, and references the issue by `#N` and the rule by its `RN-*` code.

**The unit of a commit is the whole behaviour change:** code, test, the document it changes and `CHANGELOG.md` in the same commit.

**Commit and push along the branch**, never piling everything up at the end. Every commit builds and keeps the checks of [§8](#8-tests-and-review) passing.

**No version notes, revision dates or "internal document" footers** are written inside documents: they duplicate what git records and fall out of sync at once.

### 4.1 When a commit touches each document

A document holds what the code cannot say, so a commit touches one only when it changes a rule, an invariant or a decision. A feature that changes none of the three touches no document but `CHANGELOG.md`.

| Touches… | When the commit… |
|---|---|
| `PRD.md` | Creates, changes or removes a business rule, a term of the ubiquitous language or a quality requirement |
| `ARCHITECTURE.md` | Changes the layout, an integration, the mechanism of an invariant, or a decision (a new ADR, or one superseded) |
| `AGENTS.md` | Adds or removes a limit or an invariant, verifies a command, or changes where a kind of paragraph belongs |
| `README.md` | Changes how to start, a prerequisite, a command a person types, or a capability the README mentions |
| `SDLC.md` | Changes the path to `main` or to production |
| `CHANGELOG.md` | Changes anything a person or an agent using the product can observe; a refactor, a test or a formatting adjustment with no observable effect does not |

A fix that **restores** what a document already describes touches no document but `CHANGELOG.md`. A code comment cites a rule, an invariant or a decision by its identifier (`RN-KNW-035`, `INV-04`, `ADR-003`), never by a section number.

On `main`, documents and code never diverge. Inside a branch they move in step: if the branch dies halfway, nothing inconsistent reached `main`; if it is merged, everything arrives together.

## 5. When an issue closes

The issue of a delivery closes **when its commit lands on the branch of the cycle**, the `release/vX.Y.Z` of its milestone, not when that branch reaches `main`: committed there, or merged there from a `feat/` or `fix/` branch. A commit on a `feat/` or `fix/` branch closes nothing. A change that reaches `main` by a single-purpose branch ([§3](#3-branches)) has that branch as its branch of the cycle. The issue stays in its milestone and closes as `completed`, with a comment naming the commit. A refused issue closes as *not planned*, with the reason.

The consequence is counterintuitive and accepted: during the cycle there are closed issues whose work is not in production yet. What declares the scope of the version is the **milestone**; what takes everything to `main` is the single pull request of the cycle.

## 6. Pull request

A pull request references issues by `#N`, **never with `Closes #N`** or another closing keyword: each issue closed already, when its commit landed on the branch ([§5](#5-when-an-issue-closes)).

Every PR description has three sections, in this order.

### 6.1 Summary of changes

```
## Summary of changes

{what changed, grouped by issue, each group headed by its #N}
{every change that implements or alters a business rule cites its RN code}
```

### 6.2 Staging validation

```
## Staging validation

{the version staging served and the commit it was delivered from, and what was exercised on it}
{or: nothing of this branch ran on staging, and the merge is the author's decision}
```

Written by whoever ran the delivery. Nothing blocks the merge on this section: merging without a staging run is a decision of the author, and the section is what makes it one taken knowingly.

### 6.3 AI productivity analysis

Collect the data from the git history and the diff, without guessing and without omitting fields.

```
## AI productivity analysis

| Metric | Value |
|---|---|
| Lines of code handled (added + removed) | {loc_added + loc_removed} ({loc_added} added, {loc_removed} removed) |
| Branch duration | {duration} (from `{branch_start_date}` to `{pr_date}`) |
| Technologies involved | {comma-separated list} |

### Estimated human effort (without AI assistance)

> **Estimated effort:** {hours}h, roughly {total_days} working days (8h/day) or {total_weeks} working weeks (40h/week).
```

**How to fill in each field:**

- **Lines of code handled:** run `git diff --stat origin/main...HEAD` and add the insertions and deletions of the final totals line. Exclude `pnpm-lock.yaml`.
- **Branch duration:** the date of the first commit on the branch as the start, and today as the PR date.
- **Technologies involved:** every language, runtime, framework, library, cloud service, CI system and tool the diff touches, derived from the extensions of the changed files and from the imports. Do not list what the repository has but this PR did not touch.
- **Estimated human effort:** a single realistic estimate of how long one engineer would take to deliver the same result alone, without AI assistance, based on:
  - **Volume:** total lines handled, weighted by complexity, distinguishing repetitive code from code with dense logic.
  - **Breadth:** the number of distinct technologies involved, since each adds a learning curve and an integration cost.
  - **Scope indicators:** the units of design the change adds or reshapes — bounded contexts, MCP tools, routes, screens, stacks, commands, documents — plus the test coverage added.
  - Expressed in hours, for example `8h`; `< 1h` when very small.
- **Total estimated effort:** `{total_days}` = `{hours}` ÷ 8 and `{total_weeks}` = `{hours}` ÷ 40, rounded to one decimal place. An estimate of `< 1h` counts as `0.5h`, noted on the line.

## 7. A blocked merge

**If a merge is blocked, stop and report.** The protection of `main` is not worked around, even with administrative rights to do so: the ruleset is the real layer of guarantee, and going around it silently defeats the reason it exists. Report what blocked it, and let the owner decide.

## 8. Tests and review

**A green suite is necessary, not sufficient.** Before a change is called done it is exercised the way a person would use it: a screen is opened and used, on a computer and on a phone; a tool is called from a real client; a command is run against a real environment. What was exercised is written in the PR's *Staging validation*.

**What CI checks.** The workflow *CI* runs on every pull request and every push to a `release/` branch, and its job *Quality* is the required status check of `main`. It runs, in order: `pnpm quality` (the checks of the documents and the version, in `scripts/quality.mjs`) and their tests, `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm depcruise` (the dependency rules of [`ARCHITECTURE.md` §3](ARCHITECTURE.md#3-invariants-and-their-mechanisms)), every unit suite, and the build of the frontend.

**What staging adds.** The workflow *Staging* delivers a branch to staging and closes with the smoke; on request it also runs the adapter tests against the real services and the functional suite, a browser driving the deployed product. A defect found there becomes a case of the suite before it is fixed.

**The agent evaluation.** Before the pull request of a release is merged, a round of the agent evaluation (`pnpm tools agent-eval`, in `tools/agent-eval/`) runs against staging, and its scorecard is posted on the issue of the cycle. Like the staging validation, it informs the merge and never blocks it. A case changes only in a commit of its own, never inside the round that reads it.

**The owner reviews and merges** the pull request of a cycle; nobody merges their own cycle without that review.

## 9. Versioning

**The version lives in the `version` field of the root `package.json`.** Every other `package.json` of the monorepo carries the same version, because the three projects are deployed together and the tools are released with them; `release-checks` refuses a merge where one disagrees. No document repeats it; `CHANGELOG.md` records the versions that were cut.

| Kind of change | Bump |
|---|---|
| A break in an MCP tool or API contract, a destructive key or schema migration | Major |
| A new MCP tool, a new visible feature, a new service, a new route | Minor |
| A defect fix, a configuration adjustment, a refactor with no external impact | Patch |

**While the version is `0.x`, a contract break enters as a minor bump**, recorded under `Changed` or `Removed`. From `1.0.0` on the table holds without exception, because by then somebody is integrated on the other side.

**`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).** Every entry is born under `[Unreleased]`, in the commit of the change, in one of the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`, referencing its issue. It is written from the side of the person and the agent using the product, never of the implementation.

**A change that alters nothing deployed does not cut a version.** Documentation and repository governance are the typical case: it waits in `[Unreleased]` and goes out inside the next cycle, dated by the cut.

**The cut takes the whole `[Unreleased]`, and the accumulation decides the number.** No subset is picked, because the compare range in the foot of `CHANGELOG.md` covers every commit between two tags. The bump is the **largest that any accumulated entry requires**, not what the last change would require on its own.

## 10. Release

**Nobody tags by hand.** The tag and the GitHub Release are written by `publish-release`, after production serves the version, on the merged commit, with the notes of that version's section of `CHANGELOG.md`.

1. On the branch `release/vX.Y.Z`, in **one commit** `chore(release): bump version to vX.Y.Z`: set `version` in every `package.json` of the monorepo to `X.Y.Z`; in `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` with the date of the cut, open a fresh empty `[Unreleased]` above it, and update the compare links in the foot.
2. Push the branch and open the single pull request of the cycle ([§6](#6-pull-request)).
3. The owner reviews and merges it. The bump never reaches `main` by a direct push.
4. A merge to `main` that touches `memorysmithapp-backend/`, `memorysmithapp-frontend/`, `memorysmithapp-infra/` or the workspace files starts the workflow *Production*, which runs, in order, stopping at the first that fails:
   1. `release-checks`: a version that disagrees anywhere, that has no dated section with notes, or whose tag already exists on another commit stops here;
   2. the checks of CI again, on the merged commit;
   3. `deliver --environment production`, which builds, deploys in the order the environment imposes and closes with the smoke;
   4. `publish-release`: the annotated tag `vX.Y.Z` on the merged commit and the GitHub Release, refusing a tag that already points at another commit, because a version names one commit.

A merge that touches nothing deployed starts nothing. A run that failed for a cause other than the code is run again from the Actions tab. A merge delivers with alarms, dashboards and tracing off; a manual run of *Production* delivers the released commit again with the ones chosen, and the next merge turns them off ([ADR-021](ARCHITECTURE.md#adr-021-what-costs-money-in-observability-is-a-choice-of-the-delivery-off-by-default)).

When a cycle is cut, every issue delivered in it is closed already ([§5](#5-when-an-issue-closes)), and the ones left behind move to the milestone of the next version: an accepted issue nobody reassessed is a silent promise.

## 11. Rollback

A released version that turns out wrong is **never undone by moving or deleting its tag**, and production is never deployed by hand from a workstation.

Production returns to the previous behaviour through a **new patch version**: the fix, or the revert of the offending commits, enters `[Unreleased]` under `Fixed` on the `release/vX.Y.Z` of that patch version, committed there or brought there from a `fix/` branch ([§3](#3-branches)), is cut, and is delivered by the flow of [§10](#10-release). `release-checks` refuses to deliver a version that is tagged already on another commit, so a revert merged without a bump stops before production. Data written meanwhile stays: a migration is never reversed by a rollback, which is why a destructive key or schema migration is a major bump ([§9](#9-versioning)).

## 12. Done criteria

An issue's work is done when, on the branch of the cycle ([§5](#5-when-an-issue-closes)):

- every point of its "Done when" holds, exercised the way a person would use it ([§8](#8-tests-and-review));
- the documents it touches and its `CHANGELOG.md` entry are in the same commit as the change ([§4](#4-commits));
- the commit is pushed and the checks of the branch are green;
- the issue, in its milestone, is closed as `completed`, with a comment naming the commit ([§5](#5-when-an-issue-closes)).

The version is done when its pull request is merged, production serves it, and its tag and Release exist.
