# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `CLAUDE.md` as the single source of truth for agent behavior: project identity, documentation boundaries, business-rule code scheme (`RN-{CONTEXT}-{NNN}`), non-negotiable design rules, language policy, ignore-file policy, versioning flow, changelog rules, branch protection, incremental commit policy and pull request template.
- `docs/knowledge-base.md` — domain facts about Markdown knowledge bases and the agent ecosystem: format standardization, personal knowledge management practice, the Model Context Protocol and its OAuth 2.1 authorization model, context engineering, retrieval (embeddings, chunking, RAG) and its failure modes, audit and provenance in regulated work, LGPD, and multi-tenant isolation concepts.
- `docs/software-vision.md` — product vision, product principles, ubiquitous language, multi-tenancy business model, role and permission matrix, domain entities, business rules under `RN-XXX` codes, the MCP tool catalogue as the public product contract, UI screens, product limits, release scope per version, product risks and open questions.
- `docs/architecture-guide.md` — engineering architecture: founding decisions, engineering principles with their enforcement mechanisms, bounded contexts, technology stack, monorepo structure and dependency rule, tactical DDD model, ports and adapters, technical multi-tenancy, DynamoDB single-table design and Content Slots, transactions and outbox, discovery projections, provenance storage, MCP wiring, internal API and authorization, error taxonomy, infrastructure, NFRs, testing strategy, CI/CD, anti-patterns, feature checklist, three-layer versioning, the microservice/modular-monolith lever, build sequence and technical risks.
- `CHANGELOG.md`.

### Changed

- Documentation split into three documents with explicit, non-overlapping responsibilities (domain facts / product / engineering), replacing the single `DESIGN.md`. Cross-references replace duplication: each fact is stated in exactly one document and referenced by section from the others.
- `README.md` now points to `docs/` and to `CLAUDE.md` instead of `DESIGN.md`.
- `.gitignore` extended with build, dependency, coverage and environment entries in line with the ignore-file policy.
- Tenancy model replaced by a subscription model. `Subscription` is now both the business object and the isolation boundary: every key begins with `S#{subscriptionId}`, every S3 key with `s/{subscriptionId}/`, and the `tenant` vocabulary is gone from the product and the code. The subscription id is perpetual — approve, suspend, cancel and reactivate change a status field and never move, rekey or delete data.
- Subscription lifecycle added: signup no longer creates anything but the account. A user requests a subscription during onboarding and a `PLATFORM_ADMIN` authorizes it, since billing is out of scope for now. Rejection carries a mandatory reason and the request can be resubmitted.
- Role taxonomy reworked to `PLATFORM_ADMIN`, `OWNER`, `EDITOR` and `VIEWER`, replacing `TENANT_ADMIN`. The owner is the subscription holder — exactly one, transferable, stored as a field rather than a collection so the invariant is the shape of the data. Editors and viewers are invited into workspaces by the owner.
- Platform surface separated from customer data by construction: a platform session carries no `subscription_id` claim, so no Knowledge repository can be instantiated under it. The platform queue reads through a dedicated index that projects metadata only.
- Per-vault role ceiling added: the owner can lower a member from `EDITOR` to `VIEWER` on a specific vault. Effective role is the minimum of the workspace role and the vault ceiling — it never promotes, and it never hides a vault.
- Business rule prefix `RN-MTN` (multi-tenancy) retired in favour of `RN-SUB` (subscription and isolation), before any code or issue referenced it.
- Repository layout defined as three top-level projects — `memoryvault-backend`, `memoryvault-frontend` and `memoryvault-infra` — instead of infrastructure living inside the backend project. Infrastructure declares resources for all three projects, so it owns a project of its own; the dependency direction between the three is single and enforced in CI.

### Removed

- `DESIGN.md` — its content was redistributed across the three `docs/` documents. History remains available in git.
