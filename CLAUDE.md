# CLAUDE.md

This file is the **single source of truth** for all agent behavior in this project.
Claude Code reads this file automatically on every session and every sub-agent invocation.

---

## Project Identity

### Organization
MemoryVaultGuru

### Project name
MemoryVaultApp

### Project identifier
memoryvault

### Product domain
memoryvault.guru

### What it does
MemoryVault.guru hosts self-describing Markdown knowledge vaults — structure, ordering and authoring guidance declared as data — and serves them natively to AI tooling through a remote MCP server. The agent does not only read a vault: it writes to it, following the vault's own guidance and folder templates.

### Slogan
Structured knowledge, natively readable — and writable — by agents.

### Brand Identity
- **Primary color:** to be defined
- **Visual tone:** to be defined — the product surface is a reading tool before it is an editing tool

### Base version
0.1.0

### Current state
Design phase. No code yet. The first deliverable is the MCP authentication spike (see `docs/architecture-guide.md` § MCP server).

### Git remote
github.com/MemoryVaultGuru/MemoryVaultApp

---

## Repository Layout

A pnpm monorepo with **three top-level projects**, named after the project identifier. Full structure and rationale in `docs/architecture-guide.md` §5.

```
MemoryVaultApp/
├── memoryvault-backend/     # six bounded contexts + shared kernel + event contracts
├── memoryvault-frontend/    # React SPA
└── memoryvault-infra/       # all CDK: stacks, constructs, IAM policies, pipeline
```

**Never put infrastructure code inside the backend project, and never put a stack definition inside a service.** The infra project declares resources for all three projects — including the bucket that serves the frontend and the pipeline that deploys everything — so it cannot live inside any one of them. This also keeps deploy credentials separable from application code.

**Dependency direction between projects — single direction, enforced in CI:**

```
memoryvault-infra      →  references backend and frontend artifacts (bundling, deploy)
memoryvault-backend    →  knows nothing about infra or frontend
memoryvault-frontend   →  imports @memoryvault/contracts (types only) and calls the API at runtime
```

An `import` from `memoryvault-infra` inside `memoryvault-backend` is an architecture error, not a style question. Services never import each other either: cross-context communication is HTTP with IAM auth or an event, never an `import`.

When creating a file, place it by asking what it is, not what it is for: a CDK construct for the audit table belongs in `memoryvault-infra/constructs/`, even though only the audit service uses it.

---

## Architecture Reference

The full engineering architecture lives in a single canonical document:

| File | Language | Role |
|---|---|---|
| [`docs/architecture-guide.md`](docs/architecture-guide.md) | Portuguese (pt-BR) | **Canonical version** — single source of truth for all engineering decisions |

Contains: technology stack, monorepo structure, tactical DDD (aggregates, value objects, domain events), hexagonal ports and adapters, subscription-scoped isolation, DynamoDB single-table design, Content Slots, transactions and outbox, discovery projections, provenance storage, MCP/OAuth wiring, internal API, infrastructure, NFRs, testing strategy, CI/CD, anti-patterns and the build sequence.

Does **not** contain: product vision, business rules (`RN-XXX` codes), user-facing screens, or general domain facts. Those live in the two documents below.

---

## Knowledge Base

Project documentation is split into two further concerns — domain knowledge and software vision:

### Domain Knowledge Base (Markdown knowledge management and the agent ecosystem)

| File | Language | Role |
|---|---|---|
| [`docs/knowledge-base.md`](docs/knowledge-base.md) | Portuguese (pt-BR) | **Canonical version** — domain facts about the space the product operates in |

Contains **only domain facts** that would remain true if this product did not exist: Markdown and its universal syntax, personal-knowledge-management practice (vaults, wikilinks, backlinks, templates), the Model Context Protocol and its authorization model, how agent clients consume connectors, context engineering, retrieval (embeddings, chunking, RAG) and its failure modes, knowledge graphs, audit and provenance requirements in regulated work, LGPD obligations, and general multi-tenant SaaS isolation concepts. No MemoryVault entities, no `RN-XXX` codes, no architecture.

### Software Vision (product requirements and business rules)

| File | Language | Role |
|---|---|---|
| [`docs/software-vision.md`](docs/software-vision.md) | Portuguese (pt-BR) | **Canonical version** — authoritative for all implementation decisions |

Contains: product vision and thesis, product principles, ubiquitous language, the **business model** (Subscription → Workspace → Vault, subscription lifecycle, roles), permission matrix and per-vault role ceiling, bounded-context map from a product standpoint, domain entities with field definitions, business rules (`RN-XXX` codes), the MCP tool catalogue as a **product contract**, UI screens, export, release scope and product risks.

For technical implementation details (DynamoDB key design, Content Slots, outbox mechanics, Cognito triggers, CDK stacks), always defer to `docs/architecture-guide.md` — `software-vision.md` must not duplicate that content.

### Boundary rule between the three documents

Before writing a paragraph into `docs/`, decide which question it answers:

| The paragraph answers | It belongs in |
|---|---|
| "This is true about Markdown / MCP / auditing in general" | `knowledge-base.md` |
| "This is what our product does, and under which rule" | `software-vision.md` |
| "This is how we build it" | `architecture-guide.md` |

When a fact seems to fit two documents, it goes in exactly one and the other **references it by section** — never restates it. Duplication across these three files is the failure mode this structure exists to prevent.

### Business rule codes

Business rules are stated only in `software-vision.md`, one rule per line, with a stable code:

```
RN-{CONTEXT}-{NNN}
```

`CONTEXT` is the three-letter bounded-context tag: `SUB` (subscription and isolation), `ACC` (access: workspaces, members, roles, invites), `KNW` (knowledge), `DSC` (discovery), `AUD` (audit), `AGT` (agent access / MCP), `PRT` (portability).

Codes are **append-only**. Never renumber a rule and never reuse a retired code — other documents, commits and issues reference them. A rule that no longer applies is marked as removed in the same line, keeping its number.

---

## Documentation Hygiene

**Never append version notes, review dates, or internal-use footers to any file in `docs/`.** Lines of the form:

```
*Documento para uso interno de desenvolvimento. Última revisão: … — vX.Y (…)*
```

are forbidden. They duplicate information already captured in git history and `CHANGELOG.md`, drift out of sync immediately, and add noise that readers must filter out.

**Where change history belongs:**

- **`CHANGELOG.md`** — the single place where notable changes to the project (including significant documentation updates) are recorded. Add an entry here when opening a pull request, not as an inline footnote inside the edited document.
- **Git commit messages** — every commit already records what changed, when, and why. That is the audit trail for document edits.

**Rule:** when editing any `docs/*.md` file, do not add, update, or preserve any trailing footnote that mentions a version number, a review date, or the phrase "uso interno de desenvolvimento". If such a note already exists in a file being edited, remove it as part of the same change.

---

## Language Policy

**All project artifacts must be written in American English (en-US)**, with the single, explicit exception of `docs/*.md`, which is written in Brazilian Portuguese (pt-BR).

The English rule covers without exception:
- Source code (identifiers, comments, docblocks)
- Git commit messages, branch names, and pull request descriptions
- Configuration files, `README.md`, `CHANGELOG.md`, `CLAUDE.md`
- Log and error messages in code
- DynamoDB attribute names, S3 key components, EventBridge event names
- API endpoint names, MCP tool names and tool descriptions
- User-facing UI strings (labels, messages, placeholders, tooltips) — must use i18n translation keys (never hardcoded). `en_US` is the canonical locale; `pt_BR` is the second required locale. Both translation files must stay in sync.

**The `docs/` exception.** The three architecture and product documents are written in pt-BR because they are the reasoning surface between the product owner and the agent, and reasoning is done in the reader's language. Inside them, **code identifiers, file paths, entity field names, event names, tool names and error codes stay in en-US and are never translated** — a pt-BR document referencing `NoteId`, `get_vault_context` or `PRECONDITION_FAILED` writes them exactly as the code does.

**When en-US versions of the docs are created**, they become the canonical pair member and this policy switches to the bilingual sync rule: any edit to either file in a pair must be reflected in the other before the task is considered complete, with the en-US file taking precedence on conflict. Do not create half a pair.

**Locale-sensitive formatting** (dates, numbers) is runtime behavior driven by `Intl` APIs — governed by the active locale, not by this policy.

---

## Non-Negotiable Design Rules

These are the load-bearing decisions of the system. They are stated in full in `docs/architecture-guide.md`; they are repeated here because violating any one of them is not a bug to fix later — it is a rewrite. When a task appears to require breaking one, stop and raise it instead of working around it.

| # | Rule | Where it is enforced |
|---|---|---|
| 1 | **Every key starts with the subscription.** Every DynamoDB item key begins with `S#{subscriptionId}`; every S3 key begins with `s/{subscriptionId}/`. Exactly two exceptions exist and both are named in the design: the user↔subscription link, and the platform queue index. | Key builders accept only a `SubscriptionId` value object |
| 2 | **`subscriptionId` comes from the JWT claim, never from the request.** Not from path, query, body, or header. | Lambda Authorizer + `SubscriptionContext` injected per request |
| 3 | **`domain/` and `application/` import no AWS SDK.** No exceptions, including "just for a type". | `dependency-cruiser` rule in CI — the build fails |
| 4 | **The S3 key is opaque.** It encodes no vault, folder, name, or role — only a `ContentId`. Renaming, moving and reordering must never write a byte to S3. | `s/{subscriptionId}/c/{contentId}.md` is built only inside the S3 adapter |
| 5 | **The backend never interprets note content.** Frontmatter, field names and conventions belong to the vault's Guidance and Template. The backend reads only universal Markdown syntax (links, headings). | `LinkExtractor` is the only content reader |
| 6 | **The audit trail is append-only by IAM, not by discipline.** The audit role carries an explicit `Deny` on `UpdateItem` and `DeleteItem`. | IAM policy + an isolation test in the suite |
| 7 | **Every state-changing domain operation takes an `Authorship`.** There is no anonymous mutation; the signature makes it impossible. | Aggregate method signatures |
| 8 | **Deleting a note never destroys bytes.** Soft delete only; byte destruction is an administrative act with its own port, its own role and its own event. | `ContentStore` has no `purge` method |
| 9 | **A forbidden resource returns `404`, never `403`.** `403` would confirm the existence of something the requester may not see. | Error taxonomy in `memoryvault-backend/packages/kernel` |
| 10 | **A note transaction never writes to the vault's `META` item.** That single item would become the contention point of the whole vault under batch ingestion. | Repository transaction shape + a concurrency test |
| 11 | **The subscription id is perpetual.** No status transition — approve, suspend, cancel, reactivate — ever moves, rekeys or deletes data. Status governs access, never address. | `SubscriptionId` is `readonly`; no repository reads status to build a key |
| 12 | **A platform-admin session carries no subscription.** Its token has no `subscription_id` claim, so no Knowledge repository can even be constructed under it. Never add a role check as a substitute — the impossibility is the guarantee. | `SubscriptionContext` requires the claim; isolation test asserts the failure mode |
| 13 | **A per-vault role ceiling only lowers a role, never raises one.** Effective role is `min(workspace role, vault ceiling)`, with the subscription owner above both. | `Role` is an ordered enum exposing `Role.min`; no code path assigns a role directly |

---

## Ignore Files Policy

Whenever Claude creates, moves, deletes, or modifies files or directories, it must evaluate whether `.gitignore` and `.dockerignore` need to be updated.

**Update `.gitignore` when:** new build output dirs (`dist/`, `cdk.out/`, `build/`), dependency dirs (`node_modules/`), env/secret files (`.env`, `*.key`), cache/temp dirs (`.cache/`, `tmp/`, `.turbo/`), IDE and editor files (`.idea/`, `.vscode/`, `.obsidian/`), or coverage dirs (`coverage/`) are introduced.

**Update `.dockerignore` when:** new dirs exist that should not be copied into build contexts, new build artifacts or local configs are added, or new secret/env files are created.

**Rules:**
- Never leave untracked sensitive files without a `.gitignore` entry
- Keep build contexts lean — never copy unnecessary files
- Both files must be reviewed together — a change affecting one usually affects the other
- If `.dockerignore` does not exist and Docker files are present, create it
- If `.gitignore` does not exist, create it before committing any new files

**Standard `.dockerignore` entries to always include:**
```
.git/
.claude/
.obsidian/
node_modules/
dist/
cdk.out/
coverage/
tests/
*.log
.env
.env.*
README.md
CHANGELOG.md
CLAUDE.md
docs/
```

---

## Versioning Policy

This project uses a **three-layer versioning model** defined in full in `docs/architecture-guide.md` § Versioning strategy. The summary below governs agent behavior.

### Source of truth

The canonical product version lives in `CLAUDE.md` under `## Project Identity → Base version`.
It must be propagated to every `package.json` in the monorepo and to `CHANGELOG.md` before a release commit is made.

### When to bump

| Change type | Bump |
|---|---|
| Breaking MCP tool contract, breaking API contract, destructive key/schema migration | Major (`2.0.0`) |
| New MCP tool, new user-visible feature, new service, new API route | Minor (`0.2.0`) |
| Bug fix, config tweak, refactor with no external impact | Patch (`0.1.1`) |

The MCP tool surface is the product's **public contract** (`docs/software-vision.md` § MCP). Removing a tool, renaming an argument, or narrowing a return shape is a major bump even when no internal API changed.

### Version bump flow

Execute in this exact order:

```
1. Update  CLAUDE.md                                       ← bump "Base version" under Project Identity
2. Update  memoryvault-backend/package.json
           memoryvault-backend/packages/*/package.json
           memoryvault-backend/services/*/package.json     ← every service package
3. Update  memoryvault-frontend/package.json
4. Update  memoryvault-infra/package.json
5. Update  CHANGELOG.md                                    ← cut the release section with date and summary
6. Commit on a release branch  "chore(release): bump version to vX.Y.Z"
7. Push the branch, open a PR, and merge it into main (never push the bump directly to main)
8. Tag the merged commit on main  git tag vX.Y.Z && git push origin vX.Y.Z
9. Publish a GitHub Release for the tag, with notes copied from that version's CHANGELOG section
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <changelog-section>
```

The three projects share one product version — they are deployed together and a mismatch between them is never meaningful to a user.

Steps 1–5 must land in the same commit on the release branch. The version bump reaches `main` only through the PR in step 7 — never push it directly. Never tag before the PR is merged, and never push a tag whose commit is not yet on `main`. The tag must point at the merged commit; the GitHub Release (step 9) is created from that tag.

---

## CHANGELOG Maintenance Policy

`CHANGELOG.md` must be kept current throughout the life of a feature branch — not only at release time.

### When to update

Update `CHANGELOG.md` **in the same commit** as the change it documents. Every incremental commit that touches user-visible behavior, adds a new capability, fixes a bug, or removes something must include a corresponding entry in the `[Unreleased]` section.

Do **not** batch changelog entries at the end of a branch. Each entry belongs alongside the commit that introduced it.

### How to write entries

Use the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) categories. Pick the most accurate one:

| Category | Use when |
|---|---|
| `Added` | New feature, new MCP tool, new route, new service, new config option |
| `Changed` | Behavior change in an existing feature, key/schema migration, UI redesign |
| `Fixed` | Bug fix — describe the symptom that was corrected |
| `Removed` | Feature, route, tool, field, or dependency deleted |
| `Deprecated` | Something marked for future removal |
| `Security` | Vulnerability fix or security hardening (subscription isolation, authorization, audit immutability) |

Write entries from the user/agent perspective, not the implementation perspective. Describe what changed in the product, not which files were edited.

**Good:** `Added asOf argument to read_note, returning the revision in force on a given date`
**Bad:** `Updated NoteQueryHandler.ts to accept an optional timestamp`

Group multiple small entries under the same category rather than writing one entry per file touched.

Documentation restructures inside `docs/` are notable changes and get an entry.

### At release time

When cutting a release (following the Version bump flow), rename `[Unreleased]` to `[{version}] - {date}`, add the new empty `[Unreleased]` section above it, and update the comparison links at the bottom of the file.

---

## Branch Protection Policy

`main` is a protected branch. **All changes reach `main` only through a reviewed pull request that is merged on GitHub** — features, fixes, docs, chores, and release/version bumps alike.

**Hard rules:**
- Never commit or push directly to `main`. Always create a working branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`), push it, open a PR, and merge via GitHub.
- Never bypass branch protection. Do not use "Bypass rules and merge", `gh ... --admin`, `git push --no-verify`, or any equivalent override — even when you have admin rights to do so.
- If a merge is blocked (e.g. a required review is missing), stop and report it. Ask the user how to proceed instead of overriding the rule.
- The only writes that ever touch `main` directly are **annotated tags** on already-merged commits (see the Versioning Policy → Version bump flow).

**Why:** the protection rule is the real enforcement layer; bypassing it silently defeats the purpose. Routing every change through a PR keeps `main` reviewable, auditable, and always green.

---

## Incremental Commit Policy

When working on a feature branch, commit and push incrementally — do not accumulate all changes into a single end-of-task commit.

**When to commit:**
- After completing any self-contained unit of work (an aggregate, a port and its in-memory adapter, an API route, a CDK stack, a passing test suite run).
- Whenever a meaningful milestone is reached, even if the overall task is not yet finished.
- Before switching context to a different area of the codebase within the same task.

**Commit hygiene:**
- Each commit must be buildable and must not break existing tests — never commit a half-implemented state that leaves the branch in a broken state.
- Write a concise, descriptive commit message following the project's commit style (imperative mood, present tense, e.g. `feat(knowledge): add fractional Position value object`).
- Push to the remote branch after every commit, or at least after every two to three consecutive commits.

**Why:** Frequent pushes protect in-progress work from local machine failures, make code review easier by providing a clear history of decisions, and allow collaborators to see progress without waiting for a final PR.

---

## Pull Request Policy

Every pull request description must contain two sections: a **Code Changes Summary** and an **AI Productivity Analysis**.

### Code Changes Summary

Describe what changed, why, and any relevant architectural decisions. Follow the existing PR template in the repository if one exists. When a change implements or alters a business rule, cite its `RN-XXX` code.

### AI Productivity Analysis

Append this section to every PR body. Collect the data from git history and the diff; do not guess or omit fields.

```
## AI Productivity Analysis

| Metric | Value |
|---|---|
| Lines of code manipulated (added + removed) | {loc_added + loc_removed} ({loc_added} added, {loc_removed} removed) |
| Branch duration | {duration} (from `{branch_start_date}` to `{pr_date}`) |
| Technologies involved | {comma-separated list} |

### Estimated human effort (without AI assistance)

> **Estimated effort:** {hours}h — equivalent to approximately {total_days} work days (8h/day) or {total_weeks} work weeks (40h/week).
```

**How to populate each field:**

- **Lines of code manipulated** — run `git diff --stat origin/main...HEAD` and sum the insertions and deletions shown in the final totals line. Exclude lock files (`pnpm-lock.yaml`, `package-lock.json`) from the count.
- **Branch duration** — use the date of the first commit of the branch as the start date; the PR date is today's date.
- **Technologies involved** — list every language, framework, library, and toolchain touched by the diff (e.g. TypeScript, Node.js, AWS CDK, DynamoDB, S3, Bedrock, React, Vite, Hono, Zod). Derive from changed file extensions and import statements; do not list technologies present in the repo but untouched by this PR.
- **Estimated human effort** — produce a single realistic estimate of how long a human engineer would need to deliver the same result working alone, without AI assistance. Base the estimate on:
  - **Volume:** total lines of code manipulated (added + removed), weighted by complexity (boilerplate vs. logic-heavy code).
  - **Breadth:** number of distinct technologies involved — each additional technology adds ramp-up and integration overhead.
  - **Scope indicators:** number of new aggregates, ports, adapters, API routes, MCP tools, CDK stacks, and test coverage added.
  - Express the result in hours (e.g. `8h`, `2h`). If the scope is very small (< 1h), use `< 1h`.
- **Total estimated effort** — use the single estimated hours value from above. Then compute:
  - `{total_days}` = `{hours}` ÷ 8, rounded to one decimal place
  - `{total_weeks}` = `{hours}` ÷ 40, rounded to one decimal place
  - If the estimate is `< 1h`, treat it as `0.5h` for arithmetic purposes and note the approximation inline.
