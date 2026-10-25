# AGENTS.md

How an agent works in this repository. `.claude/CLAUDE.md` imports this file, so it is loaded whole in every session and every sub-agent: it stays short and points at sections of the other documents instead of repeating them.

## 1. Identity

- **Name:** `memorysmithapp`, the product **MemorySmith**, served on `memorysmith.app`. Deployed resources keep the identifier `memorysmith` in their names.
- **What it does:** hosts self-describing knowledge notebooks in Markdown, with structure, order and authoring Guidance declared as data, and serves them to AI tools through a remote MCP server, where the agent writes in a notebook obeying its Guidance and the Templates of its folders.
- **Organisation:** [`memorysmithapp`](https://github.com/memorysmithapp). **Licence:** MIT, public repository.
- **Version:** the `version` field of the root `package.json`, and nowhere else.
- **Visual identity:** the brand book *Livro da marca v1* (Figma), carried into the tokens of `memorysmithapp-frontend/src/styles.css`. Never redraw the symbol, and never create a colour combination outside the four versions of the book.

## 2. Reading map

Read in this order; open a document at the section that answers the question in hand, not whole.

| Question | Where |
|---|---|
| What is this and how do I start? | [`README.md`](README.md) |
| What does the product solve and deliver, and under which rule? | [`PRD.md`](docs/PRD.md), the rules in [§7](docs/PRD.md#7-features-and-rules) |
| How is it built, and why? | [`ARCHITECTURE.md`](docs/ARCHITECTURE.md), the invariants in [§3](docs/ARCHITECTURE.md#3-invariants-and-their-mechanisms), the decisions in [§6](docs/ARCHITECTURE.md#6-architecture-decision-records) |
| How is it operated and delivered? | [`ARCHITECTURE.md` §5](docs/ARCHITECTURE.md#5-operation) |
| How does a change travel to `main` and to production? | [`SDLC.md`](docs/SDLC.md) |
| How is a note written, in what notation? | The MemorySmith Markdown Specification, `SPEC.md` of [`@memorysmithapp/markdown-spec`](https://github.com/memorysmithapp/memorysmithapp-markdown/tree/main/packages/markdown-spec) |
| What changed, and when? | [`CHANGELOG.md`](CHANGELOG.md) and the git history |
| What is planned, undecided or at risk? | The issues and milestones on GitHub, never a document |

## 3. Writing map

Each fact has one home. When a paragraph seems to fit two documents it goes into exactly one, and the other references it by section. A document holds only what the code cannot say: if the code, a test or the git history already says it, it is not written.

| The paragraph says… | It belongs to… |
|---|---|
| What the product solves, for whom, a business rule, a term of the ubiquitous language, a quality requirement | `PRD.md` |
| How the code or the repository is organised, an integration, the mechanism of an invariant, how it is operated, a technical decision and its reason | `ARCHITECTURE.md` (a decision becomes an ADR) |
| How a change reaches `main` or production: issues, labels, branches, commits, PRs, review, versioning, release, rollback | `SDLC.md` |
| What the product is and how to run it | `README.md` |
| A rule an agent must not break, a verified command, the checklist before done | `AGENTS.md`, one line pointing at the home of its reason |
| What a notation means and produces | The specification, in `memorysmithapp-markdown` |
| What changed in a version | `CHANGELOG.md` |
| **Last row, absolute:** a hypothesis, the roadmap, an open risk, an undecided question, anything about the future | An issue, never a document |

## 4. Limits

One line each; the reason lives where the link points.

- `main` is protected: every change reaches it through a pull request. Never push to `main`; never use `--admin`, *Bypass rules*, `--no-verify` or an equivalent ([SDLC §1](docs/SDLC.md#1-the-life-cycle-of-a-change)).
- A blocked merge means **stop and report**, never work around it ([SDLC §7](docs/SDLC.md#7-a-blocked-merge)).
- An issue before implementing. An opinion asked for, or "open the issue", means register and ask; implement only on an explicit go-ahead from the owner ([SDLC §2](docs/SDLC.md#2-issues-and-milestones)).
- Nobody tags by hand, and nobody delivers production from a workstation ([SDLC §10](docs/SDLC.md#10-release)).
- A document never describes the future: if it is in a document, it is true now ([SDLC §2](docs/SDLC.md#2-issues-and-milestones)).
- No version notes, revision dates or "internal document" footers inside documents ([SDLC §4](docs/SDLC.md#4-commits)).
- Code cites a rule, an invariant or a decision by its identifier (`RN-KNW-035`, `INV-04`, `ADR-003`), never by a section number ([SDLC §4.1](docs/SDLC.md#41-when-a-commit-touches-each-document)).
- A business rule code is append-only: never renumbered, never reused; a rule that stops holding keeps its row, marked removed ([PRD §7](docs/PRD.md#7-features-and-rules)).
- Infrastructure code lives in `memorysmithapp-infra`, never in the backend, and a stack is never defined inside a service ([ARCHITECTURE §2](docs/ARCHITECTURE.md#2-layout)).
- Everything is written in American English (en-US): documents, code, comments, commits, branches, labels, issue and PR text. Brazilian Portuguese exists only in the `pt_BR` locale of the interface, in what a person reporting an issue writes, and in the words of the person in a case of `tools/agent-eval/`.
- In the `pt_BR` locale, and only there, Guidance is *Orientação*, Template is *Modelo* and Notebook is *Caderno* ([PRD §5](docs/PRD.md#5-ubiquitous-language)).
- The repository builds no container image; a Dockerfile, if one ever appears, comes with its `.dockerignore` in the same change.
- Create or delete a GitHub repository, change a ruleset, or act on production data only with the owner's go-ahead in the session.

## 5. Invariants

Breaking one is a rewrite, not a defect: when a task seems to require it, stop and raise the question. The mechanism of each is in [`ARCHITECTURE.md` §3](docs/ARCHITECTURE.md#3-invariants-and-their-mechanisms).

- **INV-01** Every key starts with the subscription, `S#{subscriptionId}` in DynamoDB and `s/{subscriptionId}/` in S3; the only exceptions are the links of a person and the platform queue ([mechanism](docs/ARCHITECTURE.md#inv-01-every-key-starts-with-the-subscription)).
- **INV-02** The subscription comes from the token, never from the path, the query, the body or a header ([mechanism](docs/ARCHITECTURE.md#inv-02-the-subscription-comes-from-the-token-never-from-the-request)).
- **INV-03** `domain/` and `application/` never import the AWS SDK, "just to get a type" included ([mechanism](docs/ARCHITECTURE.md#inv-03-the-domain-does-not-import-the-aws-sdk)).
- **INV-04** The S3 key is only a `ContentId`; renaming, moving and reordering never write to S3 ([mechanism](docs/ARCHITECTURE.md#inv-04-the-s3-key-is-opaque)).
- **INV-05** The backend reads only the notation the specification declares, in its named readers, and never interprets what a note means ([mechanism](docs/ARCHITECTURE.md#inv-05-the-backend-reads-only-the-notation-the-specification-declares)).
- **INV-06** No path alters an entry of the audit trail, and only the purge removes one, as part of a deletion ([mechanism](docs/ARCHITECTURE.md#inv-06-the-audit-trail-is-append-only)).
- **INV-07** Every domain operation that changes state takes an `Authorship` ([mechanism](docs/ARCHITECTURE.md#inv-07-every-mutation-takes-an-authorship)).
- **INV-08** Deleting is definitive and invalidity is inherited; only the purge destroys a revision ([mechanism](docs/ARCHITECTURE.md#inv-08-deleting-is-definitive-and-invalidity-is-inherited)).
- **INV-09** What the requester may not see answers `404`, never `403` ([mechanism](docs/ARCHITECTURE.md#inv-09-what-the-requester-may-not-see-answers-404)).
- **INV-10** A note transaction never writes the notebook's `META` item ([mechanism](docs/ARCHITECTURE.md#inv-10-a-note-transaction-never-writes-the-notebook-meta)).
- **INV-11** The subscription identifier is perpetual; a status governs access, never address ([mechanism](docs/ARCHITECTURE.md#inv-11-the-subscription-identifier-is-perpetual)).
- **INV-12** A platform administrator session reaches no customer content; never replace the missing subscription with a role check ([mechanism](docs/ARCHITECTURE.md#inv-12-a-platform-administrator-session-carries-no-subscription)).
- **INV-13** The per-notebook ceiling only lowers a role ([mechanism](docs/ARCHITECTURE.md#inv-13-the-per-notebook-ceiling-only-lowers-a-role)).
- **INV-14** The version has one home, the root `package.json`, and every manifest and `CHANGELOG.md` agree ([mechanism](docs/ARCHITECTURE.md#inv-14-the-version-has-one-home)).
- **INV-15** `.claude/CLAUDE.md` is exactly `@../AGENTS.md`, and no `CLAUDE.md` sits at the root ([mechanism](docs/ARCHITECTURE.md#inv-15-claudemd-is-only-the-import)).
- **INV-16** `main` changes only through a pull request ([mechanism](docs/ARCHITECTURE.md#inv-16-main-changes-only-through-a-pull-request)).
- **INV-17** Only `publish-release` writes a tag, and a version names one commit ([mechanism](docs/ARCHITECTURE.md#inv-17-only-publish-release-writes-a-tag)).
- **INV-18** The documents keep their form ([mechanism](docs/ARCHITECTURE.md#inv-18-the-documents-keep-their-form)).

## 6. Verified commands

Each command with the directory it runs in, what it does, and the date somebody last ran it and saw it work. A command nobody ran is never listed.

| Command | Run in | What it does | Last verified |
|---|---|---|---|
| `pnpm install` | The root | Installs the workspace, with the pnpm of `packageManager` | 2026-10-18 |
| `pnpm quality` | The root | The checks of the documents and the version (`scripts/quality.mjs`) | 2026-10-18 |
| `pnpm test` | The root | The tests of those checks, then every unit suite of the workspace | 2026-10-18 |
| `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm depcruise` | The root | The rest of what CI runs ([SDLC §8](docs/SDLC.md#8-tests-and-review)) | 2026-10-18 |
| `pnpm release-checks`, `pnpm release-notes [X.Y.Z]` | `memorysmithapp-infra` | Whether the version can be released; the notes of a version | 2026-10-18 |
| `pnpm tools --help`, `pnpm tools <command> --help` | The root | The tools that operate and evaluate the product, and what each takes | 2026-10-25 |

## 7. Before calling something done

- [ ] The issue's "Done when" holds, checked the way a person would use the change, not only by a green suite ([SDLC §12](docs/SDLC.md#12-done-criteria)).
- [ ] `CHANGELOG.md` has the entry under `[Unreleased]`, in the same commit as the change, written from the side of the person and the agent.
- [ ] Every document the change touches is updated in the same commit ([SDLC §4.1](docs/SDLC.md#41-when-a-commit-touches-each-document)).
- [ ] `.gitignore` was assessed for every file or directory created, moved or deleted; no sensitive file is left untracked without an entry.
- [ ] The commit is pushed, and the CI of the branch is green.
- [ ] The issue is closed as `completed`, with a comment naming the commit ([SDLC §5](docs/SDLC.md#5-when-an-issue-closes)).
