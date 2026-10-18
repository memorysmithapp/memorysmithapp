# Architecture

How MemorySmith is built, and why. It says what the system is made of, what enforces each invariant of [`AGENTS.md` §5](../AGENTS.md#5-invariants), what it integrates with, how it is operated, and the decisions behind it. What the product does and under which rule is in [`PRD.md`](PRD.md); how a change reaches production is in [`SDLC.md`](SDLC.md).

Every statement here was checked against the code; where a guarantee does not fully hold, the gap is named with its issue.

## 1. Overview

MemorySmith is three projects in one pnpm monorepo, deployed together to one AWS account in `us-east-1`, as two environments: production on `memorysmith.app` and staging on `stg.memorysmith.app`.

```
 person ── memorysmith.app (SPA, CloudFront) ──► api.<zone> ── CoreApi Lambda (modular monolith)
                                                                 │  access · knowledge · discovery reads · audit reads · portability
 agent ─── mcp.<zone>/mcp ── AgentFunction ── HTTPS + bearer ───┘
            (MCP server + CIMD proxy in front of Cognito, auth.<zone>)

 CoreApi ── TransactWriteItems (item + EVENT# outbox) ──► DynamoDB stream ── relay ──► EventBridge mv-events
                                                                                         ├─► AuditConsumer      → mv-audit (append-only)
                                                                                         ├─► mv-discovery queue → DiscoveryProjector → mv-discovery
                                                                                         └─► mv-purge queue     → ContentPurge
 blobs: S3 content bucket  s/{subscription}/c/{contentId}.md · s/{subscription}/f/{contentId}
        served on uploads.<zone> (parts) and files.<zone> (kept files, exports)
 queues: mv-transfer → TransferWorker (export, import) · mv-print → PrintRenderer (Chromium, PDF and previews)
```

**Six bounded contexts**, each a package under `memorysmithapp-backend/services/`:

| Context | Owns |
|---|---|
| `access` | Subscriptions and their status, members, roles, per-notebook ceilings, shares, connector bindings, the Cognito triggers and the authentication of a request |
| `knowledge` | The core domain: notebooks, folders and their order, Guidance, Templates, notes, kept files; the outbox relay, the counters and the purge |
| `discovery` | Projections of the knowledge events: the link graph, pending links, aliases, facets and the text search. It owns no source data |
| `audit` | The append-only trail of every event, and the history reads |
| `agent` | The remote MCP server, the OAuth resource server and the CIMD proxy |
| `portability` | Export and import of a notebook, transfers, uploads in parts, prints and previews |

Every context except `agent` runs inside one Lambda, *CoreApi*, composed in `memorysmithapp-backend/apps/core-monolith/src/composition-root.ts`; the other entry points of that app (`*.handler.ts`) are the relays, the purge, the transfer worker, the print renderer and the link reprojection. `agent` is deployed on its own and calls `api.<zone>` over HTTPS with the user's bearer token, as any client does ([ADR-005](#adr-005-a-modular-monolith-with-the-audit-consumer-and-the-agent-apart)).

Contexts never import each other. A write and its event commit in one DynamoDB transaction, a relay on the table's stream publishes the event, and every consumer is idempotent ([ADR-006](#adr-006-a-transactional-outbox-drained-by-dynamodb-streams)). The event types and their envelope are Zod schemas in `memorysmithapp-backend/packages/contracts/src/events.ts`.

**Inside a context** the code is hexagonal: `src/domain/` holds aggregates and ports, `src/application/` the use cases, `src/adapters/` the inbound (HTTP routes, handlers) and outbound (DynamoDB, S3, Cognito, in-memory) implementations, and `src/main/` the wiring where a context has its own entry point. `agent` is shaped by its protocol instead: `src/mcp/` holds the tools and skills, beside the OAuth and CIMD modules.

### 1.1 Engineering principles

Code comments cite them by code.

- **PE1** The domain does not know AWS: no SDK import in `domain/` or `application/` ([INV-03](#inv-03-the-domain-does-not-import-the-aws-sdk)).
- **PE2** The subscription is a type, not a convention ([INV-01](#inv-01-every-key-starts-with-the-subscription)).
- **PE3** The S3 key is entirely opaque ([INV-04](#inv-04-the-s3-key-is-opaque)).
- **PE4** The past is immutable, and what is deleted is destroyed, by IAM, with one purge principal ([INV-06](#inv-06-the-audit-trail-is-append-only), [INV-08](#inv-08-deleting-is-definitive-and-invalidity-is-inherited)).
- **PE5** Discovery is derived: every projection is rebuildable from the notes.
- **PE6** No anonymous mutation ([INV-07](#inv-07-every-mutation-takes-an-authorship)).
- **PE7** An AWS error never reaches the domain: adapters translate it into a typed `DomainError`.
- **PE8** The hot path has no single point of contention ([INV-10](#inv-10-a-note-transaction-never-writes-the-notebook-meta)).

## 2. Layout

```
memorysmithapp/
├── AGENTS.md                      how an agent works in this repository
├── .claude/CLAUDE.md              only imports AGENTS.md (INV-15)
├── README.md, CHANGELOG.md, LICENSE
├── docs/                          PRD.md, ARCHITECTURE.md, SDLC.md
├── scripts/                       quality.mjs: the checks of the documents and the version
├── .github/workflows/             CI, Production, Staging, Production maintenance
├── .dependency-cruiser.cjs        the dependency rules (INV-03, and the direction between projects)
├── memorysmithapp-backend/
│   ├── apps/core-monolith/        the composition root and every Lambda entry point but the agent's
│   ├── packages/kernel/           primitives: ids, SubscriptionContext, Authorship, Role, Position, errors
│   ├── packages/contracts/        Zod schemas of the events and the API DTOs, and the notation derived
│   │                              from @memorysmithapp/markdown-spec; the one backend package the
│   │                              frontend imports
│   ├── packages/observability/    one JSON log line per operation, with a correlation id
│   └── services/                  access, knowledge, discovery, audit, agent, portability
├── memorysmithapp-frontend/
│   └── src/                       app/ (router, layout), features/ (one folder per screen), shared/
│                                  (api client, components, config), i18n/ (en_US, pt_BR)
└── memorysmithapp-infra/
    ├── bin/app.ts, config/, cdk.json   the CDK app and the two environments
    ├── stacks/, constructs/       every resource of the three projects
    ├── commands/                  deliver, smoke, release, onboard, maintenance, destroy-staging
    ├── functional/                Playwright suites against staging: api, mcp, connector, web, journeys
    ├── agent-eval/                the blind evaluation of agents writing through the connector
    └── test/                      synth assertions and the tests of the commands
```

**The direction between the projects is single, and `.dependency-cruiser.cjs` checks it in CI:** `memorysmithapp-infra` references the artifacts of the other two; `memorysmithapp-backend` knows nothing of either; `memorysmithapp-frontend` imports `@memorysmithapp/contracts` and calls the API at runtime. Infrastructure code never lives in the backend, and a stack is never defined inside a service. A file goes where what it *is* belongs, not what it is *for*: a construct for the audit table is in `memorysmithapp-infra/constructs/`.

Deployed names keep the identifier `memorysmith`: stacks are `Memorysmith{Production|Staging}{Name}` and physical resources `{name}-{environment}`, such as `mv-knowledge-production`.

## 3. Invariants and their mechanisms

Breaking one of these is not a defect to fix later; it is a rewrite. When a task seems to require it, stop and raise the question. `AGENTS.md` §5 lists them one line each.

### INV-01 Every key starts with the subscription

Every DynamoDB key starts with `S#{subscriptionId}` and every S3 key with `s/{subscriptionId}/`. Repositories take a `SubscriptionContext` in their constructor, and the key builders (`services/knowledge/src/adapters/outbound/dynamodb/keys.ts`) accept only a `SubscriptionId`. On S3, IAM backs it: the API and the workers are granted only `s/*/…` prefixes (`memorysmithapp-infra/stacks/api.stack.ts`). There is no IAM condition on DynamoDB keys; the type is the mechanism.

The only keys outside a subscription are the **links of a person** (`USER#{user}` with `SUB#{subscription}` and `SHARED#{notebook}`, in `mv-access`) and the **platform queue** (`GSI2PK = PLATFORM#{status}`). There is no third. A share its grantee accepted is the one door through the boundary: `SubscriptionContext.fromAcceptedShare`.

### INV-02 The subscription comes from the token, never from the request

`SubscriptionContext` has a private constructor and is built from the token claims (`fromClaims`) or from a stored accepted share (`packages/kernel/src/subscription-context.ts`). The claim `subscription_id` is written by the Cognito pre-token generation trigger from the user's default link, and read only in `authenticate` (`services/access/src/adapters/inbound/http/authentication.ts`); handlers receive it as `request.subscription`. Workers take it from the event envelope the core wrote.

Two routes read a subscription id from the request, and neither acts in it on the request's word: switching the default subscription checks the id against the caller's own links, and the platform routes are for a platform administrator only.

### INV-03 The domain does not import the AWS SDK

`domain/` and `application/` import only themselves, the kernel and the Node standard library, without exception, "just to get a type" included. The rules `domain-imports-only-kernel` and `application-imports-domain-and-kernel` of `.dependency-cruiser.cjs` fail CI otherwise. The same file holds the other dependency rules: no import between services, the backend never imports the infrastructure, the frontend imports only the contracts of the backend, the kernel imports nothing of ours, no cycle.

### INV-04 The S3 key is opaque

A note, a Guidance or a Template is stored at `s/{subscriptionId}/c/{contentId}.md`, and a kept file at `s/{subscriptionId}/f/{contentId}` (`S3ContentStore.ts`, `S3FileStore.ts`). The key holds no notebook, folder, name or role, and the object metadata only immutable facts. Renaming, moving and reordering write DynamoDB only and never a byte to S3 ([ADR-002](#adr-002-the-s3-key-is-opaque-and-never-shared)).

### INV-05 The backend reads only the notation the specification declares

The backend never interprets what a note means: frontmatter and convention belong to the Guidance and the Template. It reads the notation `@memorysmithapp/markdown-spec` declares, and only in these places:

- **Discovery**, which extracts links (`LinkExtractor`), facets (`FacetExtractor`) and aliases (`Aliases`), and keeps a text portrait of each note for search (`application/projections.ts`);
- **`noteName`** in the kernel, which reads one key of the frontmatter, `name`, to name a note (RN-KNW-035), called by Knowledge and by the import;
- **the notices of the connector**, which hand an agent the renderer's own `diagnose` of what it wrote and decide nothing (`services/agent/src/mcp/notices.ts`, RN-AGT-052).

The extractors pass the conformance suite of the published specification on every build (`services/discovery/test/notation-conformance.test.ts`).

### INV-06 The audit trail is append-only

No path alters an entry of `mv-audit`, and exactly one principal removes one: the purge worker, as part of a deletion. Every role that touches the table carries an explicit `Deny` on `UpdateItem` and `DeleteItem`; `grantTrailPurge` is the one grant that allows `DeleteItem`, and only the purge holds it (`memorysmithapp-infra/constructs/subscription-table.ts`, [ADR-004](#adr-004-the-audit-trail-is-append-only-by-iam)). `test/transfer-permissions.test.ts` asserts it over the *Api* and *Projections* stacks.

**Gap:** the GitHub delivery role of staging may update and delete items of `mv-audit-staging` for the adapter tests (#321).

### INV-07 Every mutation takes an Authorship

`Authorship` (the person, the agent they wrote through or none, and the instant) has a private constructor (`packages/kernel/src/authorship.ts`), and every method that changes an aggregate — Notebook, Note, Guidance, Template, Subscription, Share, NotebookFile — takes one. There is no anonymous mutation. The preferences of a person about themselves (locale, picture, the welcome seen, the default subscription, a share marked as seen) are not domain mutations and carry none.

### INV-08 Deleting is definitive and invalidity is inherited

Deleting writes once, on the unit deleted: the mark on a note, `deletedAt` on a notebook's `META`, the tree for a folder. Everything under it is invalid in the same instant, because every read checks reachability against the tree. A queue-fed purge (`mv-purge`, `services/knowledge/src/adapters/inbound/content-purge.ts`) then destroys the content, the items and the projections, through a port of its own. Nothing restores. Exactly one principal may destroy a revision, the purge: only it holds `s3:DeleteObjectVersion` over the content bucket ([ADR-007](#adr-007-delete-is-one-mark-invalidity-is-inherited-a-purge-destroys)).

**Gap:** the GitHub delivery role of staging holds `s3:DeleteObjectVersion` on the content bucket of staging (#321).

### INV-09 What the requester may not see answers 404

A refusal answers `404` unless it reveals nothing, because a `403` confirms that the thing exists: `httpStatusFor` maps `forbidden()` to 404 and only `forbiddenVisible()` to 403 (`packages/kernel/src/errors.ts`). `forbiddenVisible` is used only where the requester already sees what refuses them: a write or an administration on a notebook they can read, a notebook created without the role to create one, a member operation reserved to the owner, a suspended subscription.

### INV-10 A note transaction never writes the notebook META

A note's `TransactWriteItems` holds the `NOTE` item under its version lock, its outbox event and, when a name moves, the name guard; never the notebook `META`, never even a `ConditionCheck` on a `FOLDER` (`DynamoNoteRepository.ts`). Counters are kept by the relay, outside the transaction ([ADR-003](#adr-003-no-note-transaction-includes-an-item-another-one-includes), [ADR-010](#adr-010-counters-and-storage-usage-are-kept-by-the-relay)).

### INV-11 The subscription identifier is perpetual

A status transition changes the subscription's `META` and its place in the platform queue, and nothing else: no consumer of a subscription event moves, rekeys or deletes data. The status governs access (`ResolveRequestContext`), never address.

### INV-12 A platform administrator session carries no subscription

The platform routes are reserved to the Cognito group `platform-admin` (`requirePlatformAdmin`), and a token without the claim `subscription_id` yields no `SubscriptionContext`, so no Knowledge repository can be constructed under it.

**Gap:** the pre-token generation trigger adds the claim to anyone with a link, a platform administrator who owns a subscription included, and `onboard` gives the first administrator a subscription; such a session reaches its own subscription and no other (#322).

### INV-13 The per-notebook ceiling only lowers a role

The effective role is the owner's when the requester owns the subscription, and otherwise `Role.min(subscription role, notebook ceiling)`; a notebook with no ceiling for a member limits nothing (`services/knowledge/src/domain/access/AuthorizationPolicy.ts`, `packages/kernel/src/role.ts`).

### INV-14 The version has one home

The `version` field of the root `package.json`. `release-checks` refuses a merge where another manifest disagrees, where `CHANGELOG.md` has no dated section with notes for it, or whose tag exists (`memorysmithapp-infra/commands/lib/release.ts`); `scripts/quality.mjs` checks the version against the changelog and every manifest of the workspace on every pull request.

### INV-15 CLAUDE.md is only the import

`.claude/CLAUDE.md` is exactly `@../AGENTS.md`, and no `CLAUDE.md` sits at the root. An import resolves from the file that holds it, so `@AGENTS.md` there would load nothing, silently. Check 3 of `scripts/quality.mjs` holds it.

### INV-16 main changes only through a pull request

The ruleset of `main` on GitHub forbids deletion and force pushes and requires a pull request and the status check *Quality* of the workflow *CI*.

### INV-17 Only publish-release writes a tag

The tag `vX.Y.Z` is written by `publish-release`, the last job of the workflow *Production*, after production serves the version, on the merged commit; it refuses a tag that already names another commit (`memorysmithapp-infra/commands/publish-release.ts`).

### INV-18 The documents keep their form

`scripts/quality.mjs` fails a pull request on a `CHANGELOG.md` outside the Keep a Changelog format, a relative link or anchor that does not resolve, or a version footer in a document.

## 4. Integrations

- **AWS**, one account, `us-east-1`: Lambda (Node.js 22), API Gateway HTTP APIs, CloudFront, S3, DynamoDB with streams, EventBridge, SQS, Step Functions, Cognito with managed login, SES, ACM, Route 53, Secrets Manager, CloudWatch, SNS, Budgets, IAM with GitHub OIDC.
- **Route 53:** the zone `memorysmith.app` delegates `stg` to the zone `stg.memorysmith.app`. Both were created by hand and are referenced by id in `memorysmithapp-infra/cdk.json`. Each environment serves `<zone>` and `www.<zone>`, `api.`, `mcp.`, `auth.`, `uploads.` and `files.`.
- **E-mail:** Cognito sends through SES from `no-reply@<zone>`, in the account's language (the *CustomMessage* trigger).
- **MCP clients:** Claude and ChatGPT register through CIMD ([ADR-009](#adr-009-a-cimd-proxy-in-front-of-cognito-binding-each-token-to-its-connector)). The MCP server is written by hand over JSON-RPC (`services/agent/src/mcp.ts`), without the MCP SDK.
- **npm, the organisation's packages:** `@memorysmithapp/markdown-spec` (the specification as data and its conformance suite, read by the contracts) and `@memorysmithapp/markdown-renderer` (draws every note in the frontend; its `diagnose` produces the notices of the connector), both published from `memorysmithapp/memorysmithapp-markdown`. `pnpm-workspace.yaml` exempts `@memorysmithapp/*` from the minimum release age.
- **Chromium:** `@sparticuz/chromium` as a Lambda layer of the print renderer ([ADR-018](#adr-018-pdfs-and-previews-are-the-apps-own-page-opened-by-a-server-chromium)).
- **GitHub Actions:** CI, delivery and release ([§5](#5-operation)).
- **The `claude` CLI:** only the agent evaluation drives it.

**Stack:** TypeScript 5.7, React 19 with Vite 6, React Router 7, TanStack Query 5, i18next; Hono 4, Zod 4 and `jose` in the backend, the AWS SDK v3; AWS CDK 2; Vitest and Playwright; pnpm 11, and Node.js 24 in CI.

## 5. Operation

### 5.1 Environments

`memorysmithapp-infra/cdk.json` declares both, in the same account; `-c environment=` chooses which one a synthesis describes, and the CDK refuses any account but the one named.

| | production | staging |
|---|---|---|
| Zone | `memorysmith.app` | `stg.memorysmith.app` |
| Alarms | yes | none |
| Data on deletion of a stack | retained | destroyed by `destroy-staging` |

Staging is disposable and never watched: it carries no alarm, and the subjects of the messages its pool sends start with `[staging]`. Every stack carries the tags `app:project`, `app:environment`, `app:version` and `deploy:sha`; the first two are the cost allocation tags of the bill.

### 5.2 Delivery

`pnpm -C memorysmithapp-infra deliver --environment <name>` builds the SPA, synthesises, deploys *Network* and *Frontend*, waits for DNS and for the SES identity, deploys *Data*, *Identity*, *Api*, *Projections*, *Agent* and *FrontendRelease* in that order, and closes with `smoke`. It refuses an environment with alarms and no `ALARM_EMAIL`, and an account other than the environment's.

Nobody delivers production from a workstation. The workflows ([`SDLC.md` §10](SDLC.md#10-release)):

| Workflow | Started by | Does |
|---|---|---|
| *CI* | a pull request, a push to `release/**` | the checks; no AWS |
| *Staging* | hand, on a branch; inputs: adapter tests, functional suite, a maintenance job | `deliver` to staging, then what was asked |
| *Production* | a merge to `main` touching what is deployed; or by hand | `release-checks`, the checks, `deliver` to production, `publish-release` |
| *Production maintenance* | hand; `report` or `apply` | `reproject-links` against production |

They assume the roles `memorysmith-github-production` and `memorysmith-github-staging` through GitHub OIDC, trusted only for the matching GitHub environment, with no key stored. The repository variables `AWS_PRODUCTION_ROLE_ARN` and `AWS_STAGING_ROLE_ARN` name them, and the variable `ALARM_EMAIL` of the environment `production` is where alarms and budgets write: it is not in the repository because the repository is public.

### 5.3 Bringing an account up

Once per account, with the owner supervising each step:

1. Create the hosted zones by hand, write the `stg` NS record in the production zone, and put their ids in `cdk.json`.
2. `cdk bootstrap` with the default qualifier.
3. `cdk deploy MemorysmithGithubDelivery -c environment=production -c alarmEmail=<address>`: the OIDC provider and the two delivery roles.
4. On GitHub: the environments `production` and `staging`, the two role variables, and `ALARM_EMAIL` in `production`.
5. The first delivery of production, then confirm the subscription of the SNS topic `memorysmith-alarms-production` from the e-mail AWS sends.
6. `pnpm -C memorysmithapp-infra activate-cost-tags`, once.
7. `pnpm -C memorysmithapp-infra onboard --environment <name> --email … --name … --quota 500MB --status active`: the first account of a pool becomes its platform administrator.

### 5.4 Commands

Run from `memorysmithapp-infra` with `pnpm <command>`, credentials from the default AWS chain (`AWS_PROFILE`). Each refuses an account other than the environment's.

| Command | Does |
|---|---|
| `onboard` | Creates or hands over an account and its subscription, with its quota and status |
| `cleanup-staging [--apply]` | Deletes the notebooks of functional-suite accounts that no longer exist; staging only |
| `recount-storage [--apply]` | Rebuilds the storage counters from what is kept |
| `reproject-links [--apply] [--follow <arn>]` | Starts the Step Functions run that rebuilds the link graph, 20 notebooks at once, and follows it; exit 2 when an edge would be lost ([ADR-017](#adr-017-the-link-graph-is-rebuilt-by-a-step-functions-run-through-the-products-own-write-path)) |
| `destroy-staging [--preview]` | Deletes the stacks of staging in reverse order and purges what they retained; leaves the zone and the delivery roles |
| `functional` | The Playwright suites against staging; never production |
| `agent-eval` | A round of the agent evaluation against staging; never production |

Without `--apply`, a maintenance job only reports.

### 5.5 Observability

Every function writes one JSON line per operation, with identifiers only and never a name, a path or a body, and one correlation id follows a call from the connector through the core, the relay, the projector and the trail (`packages/observability`). Both HTTP APIs keep access logs. Every log group the stacks declare keeps a month.

In production every function has alarms on errors, throttles and, unless asynchronous by design, p99 duration, and every dead-letter queue an alarm on its depth, all notifying the SNS topic `memorysmith-alarms-production`. Alarms are created only through `mandatoryAlarm`, and an aspect fails the synthesis of an alarm without an action, or of any alarm in staging (`memorysmithapp-infra/constructs/alarms.ts`). Two budgets, declared in the *Network* stack of production: the account at US$ 12 a month and staging, read through `app:environment`, at US$ 3.

## 6. Architecture decision records

Each record has an identifier, never reused; its context, decision, rationale and consequences; its date, status and origin. A decision that changes keeps its old record, marked *Superseded by ADR-NNN*, and a new record states the new decision. Only decisions somebody could undo for not knowing why are recorded; what the code explains is not.

The records ADR-001 to ADR-018 are **reconstructed**: taken before this document existed, verified against the code when it was written, and dated by the commit that introduced them.

### ADR-001 The subscription is a type taken from the token, and leads every key

- **Context:** one table per context and one bucket hold every subscription's data, and isolation must survive a forgotten condition in a query.
- **Decision:** every key starts with the subscription ([INV-01](#inv-01-every-key-starts-with-the-subscription)), and repositories take a `SubscriptionContext` buildable only from the token or from an accepted share.
- **Rationale:** a rule held by the compiler rather than by review: no code path builds a repository without a subscription. Introducing the boundary later would mean rekeying every item and object.
- **Consequences:** a subscription id is never added as a parameter of a request, a path or a repository method.
- **Date:** 2026-08-12. **Status:** Accepted. **Origin:** reconstructed.

### ADR-002 The S3 key is opaque, and never shared

- **Context:** notebooks, folders and names are renamed and moved constantly; the content is Markdown blobs.
- **Decision:** a blob's key is only its `ContentId` under the subscription ([INV-04](#inv-04-the-s3-key-is-opaque)); a slot is never content-addressed or deduplicated.
- **Rationale:** renaming and moving cannot touch S3 because no field of the key could change. Content addressing was rejected: across subscriptions it shares an object over the boundary and answers whether a content exists; within one it needs reference counting, and a deletion might delete nothing.
- **Consequences:** the bucket is unreadable by a person; what names an object is the `ContentRef` the items and the trail carry.
- **Date:** 2026-08-01. **Status:** Accepted. **Origin:** reconstructed.

### ADR-003 No note transaction includes an item another one includes

- **Context:** agents write notes in bursts of dozens into one folder, and `Note` is an aggregate apart from `Notebook` so that writing one does not lock the tree.
- **Decision:** a note transaction holds only the note, its event and, when a name moves, the name guard ([INV-10](#inv-10-a-note-transaction-never-writes-the-notebook-meta)).
- **Rationale:** DynamoDB cancels a transaction when any of its items is in another transaction in flight, and a `ConditionCheck` counts. DynamoDB Local runs transactions one at a time and hid it; the first run against DynamoDB cancelled 33 of 50 parallel creates. Folder existence is read before the write, and the remaining race is closed by inherited invalidity ([ADR-007](#adr-007-delete-is-one-mark-invalidity-is-inherited-a-purge-destroys)), not by a lock.
- **Consequences:** a "safety check" on the folder or the `META` reintroduces contention on the hot path; counters are eventual ([ADR-010](#adr-010-counters-and-storage-usage-are-kept-by-the-relay)).
- **Date:** 2026-08-12, refined 2026-09-13. **Status:** Accepted. **Origin:** reconstructed; #108.

### ADR-004 The audit trail is append-only by IAM

- **Context:** the trail is the immutable history of every subject and the index of what S3 holds, yet deleting a notebook must destroy what happened inside it.
- **Decision:** every role touching `mv-audit` carries an explicit `Deny` on updates and deletes; the purge alone may delete, and it first marks the trail of the notebook closed (`S#{subscription}#TRAILCLOSED#{notebookId}`).
- **Rationale:** "we cannot alter the log" rather than "we do not". The close mark exists because the purge's own events reach the trail after it ends, through the outbox, and would otherwise populate an erased trail again.
- **Consequences:** grant helpers cannot be combined, since a `Deny` cancels the other's `Allow`: that is why `grantReadAndAppend` exists.
- **Date:** 2026-08-01, purge 2026-09-18. **Status:** Accepted. **Origin:** reconstructed; #149.

### ADR-005 A modular monolith, with the audit consumer and the agent apart

- **Context:** the design has one deployable per bounded context, and there was no load, team or cycle reason to pay for six.
- **Decision:** Access, Knowledge, Discovery reads, Audit reads and Portability ship as *CoreApi*, composed in one composition root; the audit consumer is a function with its own append-only role, and the agent is deployed apart.
- **Rationale:** hexagonal code makes a split a change of composition root, so postponing it costs nothing, except for audit, whose immutability is an IAM property of a dedicated role and would be lost inside a shared one.
- **Consequences:** services still never import each other; only the composition root knows two contexts.
- **Date:** 2026-08-26. **Status:** Accepted. **Origin:** reconstructed.

### ADR-006 A transactional outbox drained by DynamoDB Streams

- **Context:** the trail, the projections, the counters and the purge all live on events.
- **Decision:** every mutation writes its event as an `EVENT#` item in the same transaction; a relay on the stream of `mv-knowledge` and of `mv-access` publishes it to EventBridge, failing the batch when any entry is refused.
- **Rationale:** without it, "written but not published" is silent, and a silent gap is a hole in an append-only record. Delivery is at least once, so every consumer is idempotent: the trail by event, the counters by a `SEEN#` item, the projections by version.
- **Consequences:** a table that writes events without a drained stream loses them.
- **Date:** 2026-08-01. **Status:** Accepted. **Origin:** reconstructed.

### ADR-007 Delete is one mark, invalidity is inherited, a purge destroys

- **Context:** deleting a notebook or a folder may cover thousands of items, and a deletion must be definitive and stop being billed.
- **Decision:** deleting writes only on the unit deleted ([INV-08](#inv-08-deleting-is-definitive-and-invalidity-is-inherited)); a queue-fed purge later destroys content first and the item second.
- **Rationale:** writing nothing under the folder is what closes the race ADR-003 leaves open: a note landing in a removed folder is invalid on arrival. The purge runs in the reverse order of a write ([ADR-008](#adr-008-content-first-pointer-second)) so that a retry finds the item and redoes the work, where item first would leave bytes nothing can name.
- **Consequences:** every use case reaching a note checks the validity chain against the tree it loaded.
- **Date:** 2026-09-16. **Status:** Accepted. **Origin:** reconstructed; #140.

### ADR-008 Content first, pointer second

- **Context:** a write touches S3 and DynamoDB, with no transaction across them.
- **Decision:** the object is put first, then the transaction carrying its `ContentRef` in the item and in the event.
- **Rationale:** the order chooses the failure: an orphan object is invisible and harmless, where the reverse leaves a pointer to nothing on the hot path. The `ContentRef` travels in the event, so the trail records the exact revision and Discovery indexes the version that triggered it.
- **Consequences:** an object left by a failed transaction is never collected.
- **Date:** 2026-08-26. **Status:** Accepted. **Origin:** reconstructed.

### ADR-009 A CIMD proxy in front of Cognito, binding each token to its connector

- **Context:** claude.ai and chatgpt.com register themselves with the authorization server through CIMD, which Cognito does not speak, and a Cognito token cannot say which connector it was issued to.
- **Decision:** the agent serves the OAuth metadata and implements CIMD itself, forwarding to Cognito with one pre-registered app client and returning Cognito's tokens unchanged; at `/token` it binds the token to the connector in `mv-access` before handing it out. There is no registration endpoint.
- **Rationale:** no new infrastructure, and no app client per registration in the pool. The binding is the only way the connector reaches an `Authorship`; an unbound token reads, but every write is refused, because an incomplete authorship would be permanent.
- **Consequences:** if Cognito ever speaks CIMD, the metadata points at Cognito and the proxy is deleted, with no registration state to migrate.
- **Date:** 2026-08-23, binding 2026-09-13. **Status:** Accepted. **Origin:** reconstructed; #113.

### ADR-010 Counters and storage usage are kept by the relay

- **Context:** the count of a folder's notes, the notebook counts and the storage a subscription uses change on every write, and the quota is enforced against the usage.
- **Decision:** the outbox relay applies each event's declared `storageDelta` and counts in one transaction guarded by a `SEEN#{event}` item; the delta is declared by the aggregate, not derived from the event type.
- **Rationale:** one usage item inside the user's transaction would be the contention ADR-003 forbids, across the whole account. The delta comes from the aggregate because one event type covers both a rename and a new body.
- **Consequences:** the quota lags by what is in flight; a drift is repaired by `recount-storage`.
- **Date:** 2026-08-29. **Status:** Accepted. **Origin:** reconstructed.

### ADR-011 Guidance and Template are aggregates of their own

- **Context:** both used to be fields of the notebook's `META` and of the `FOLDER` items, so writing a Template locked the tree and nothing could delete one.
- **Decision:** each is a `ContentSlot` at `GUIDANCE` or `FTPL#{folderId}`, written in the shape of a note's transaction under its own lock; the first write claims the key with `attribute_not_exists`.
- **Rationale:** zero or one per key is guaranteed by the key. The sort keys fall between `FOLDER#` and `META`, so the query of the tree still learns which folders have a Template.
- **Consequences:** no key of a slot may start with `FOLDER#`, which the tree loader reads as a folder.
- **Date:** 2026-09-15. **Status:** Accepted. **Origin:** reconstructed; #139.

### ADR-012 Search scans a text portrait of each note

- **Context:** a vector index cost about ten times the Markdown it indexed, and silently searched only the first page of results.
- **Decision:** Discovery keeps one `TEXT#` portrait per note, split below the item limit, and every query scans the whole notebook, through every page; each search is measured.
- **Rationale:** an inverted index would make every write update postings, and the scan of a 2,000-note notebook costs about 1,000 read units. A scan that stops at the first page is the defect that sank the previous search.
- **Consequences:** replacing it is an adapter behind `ContentIndex`, justified by the measurements; any index is per subscription.
- **Date:** 2026-08-27. **Status:** Accepted. **Origin:** reconstructed.

### ADR-013 Discovery keeps its own projection of the notebook structure

- **Context:** the graph and the context an agent receives need the notebook's name and tree.
- **Decision:** Discovery projects notebook and folder events into `STRUCT` and `SFOLDER#` items and answers from them, never asking Knowledge.
- **Rationale:** asking Knowledge would invert the one dependency direction, core to projections, that makes every projection rebuildable from events.
- **Consequences:** a folder renamed reaches Discovery eventually.
- **Date:** 2026-08-26. **Status:** Accepted. **Origin:** reconstructed.

### ADR-014 Every projection of a note is gated by a version claim

- **Context:** the projector receives events at least once, in any order, and two projections of one note may run at once.
- **Decision:** before projecting, the projector claims the version in `S#{subscription}#PROJECTED` / `NOTE#{noteId}`, only forward, reads again after writing and projects again if a newer state was claimed; the marker of a note gone keeps 30 days.
- **Rationale:** thirty days outlives the queue's retention and a redrive of its dead letters; keeping it forever would grow one item per deleted note.
- **Consequences:** a shorter time to live lets a late event bring back the projections of a deleted note.
- **Date:** 2026-09-16. **Status:** Accepted. **Origin:** reconstructed; #141.

### ADR-015 Whether a link target is a file is decided when the graph is read

- **Context:** a file is kept and deleted without any note being rewritten.
- **Decision:** a target no note answers is stored as pending, and a reader sets aside the pending links a kept file answers (`ATTACH#{name}`, fed by `FileKept` and `FileDeleted`).
- **Rationale:** deciding when the note was written froze the answer: a note written before its picture was kept stayed pending. The rule feeding the projector must carry both file events, and a test compares it with the events handled, because a missing one fails only in AWS.
- **Consequences:** any new kind of target living apart from notes is resolved when the graph is read.
- **Date:** 2026-09-22. **Status:** Accepted. **Origin:** reconstructed; #185.

### ADR-016 Upload parts and kept files are served on hosts of the product

- **Context:** an agent's sandbox allows hosts one by one and cannot be asked to allow a bucket's name; a kept file must not run in the product's origin.
- **Decision:** `uploads.<zone>` and `files.<zone>` are CloudFront distributions in front of the content bucket that forward everything but `Host`, so S3 verifies the signature the API made. `files.` allows only reads, adds `nosniff` and a sandboxing CSP, and uses a cache policy naming every query string.
- **Rationale:** nothing re-signs or sees the bytes in between. `CachingDisabled` drops the response-type parameters from the query and breaks the signature.
- **Consequences:** a presigning client uses `requestChecksumCalculation: 'WHEN_REQUIRED'`, or the parts are signed with the checksum of an empty body.
- **Date:** 2026-09-26, files 2026-09-28. **Status:** Accepted. **Origin:** reconstructed; #241, #255.

### ADR-017 The link graph is rebuilt by a Step Functions run, through the product's own write path

- **Context:** the rebuild ran on a workstation, one notebook after another, and stopped whenever the machine did.
- **Decision:** the state machine `mv-reproject-links` lists the live notebooks and rebuilds each in a Distributed Map iteration, 20 at once, with two retries and the failures named in its summary, through the ordinary projection code. Notebooks and results travel in the run's state, never in a bucket.
- **Rationale:** a rebuild with its own path to the table would be a second, untested implementation of the projection, and a bucket keyed by run would be a key outside every subscription. A run reports by default, because replacing a graph nobody looked at makes a wrong graph the truth.
- **Consequences:** production starts it from the Actions tab, with a role that may start the run and reaches no table.
- **Date:** 2026-10-17. **Status:** Accepted. **Origin:** reconstructed; #311.

### ADR-018 PDFs and previews are the app's own page, opened by a server Chromium

- **Context:** a PDF must match what the print tab lays out, and an agent's preview what the person reads.
- **Decision:** a worker on `mv-print` opens the application's print or preview page in Chromium with the caller's access token, and refuses every request outside the app, its API, the files host and the fonts. It alone runs on x86_64.
- **Rationale:** one renderer for the screen, the print, the PDF and the preview; the caller's token means the page reads exactly what that person may read. The Chromium binary exists only for x86_64, and filtering egress keeps a note's image address from reaching the function's network.
- **Consequences:** prints and previews expire in a day and never count toward storage; a message is never retried.
- **Date:** 2026-10-01. **Status:** Accepted. **Origin:** reconstructed; #263.

### ADR-019 Documents in the structure of memorysmithapp-template, written from the code

- **Context:** the agent instructions had grown into a `CLAUDE.md` of about 8,700 words loaded whole in every session, and five documents of about 95,000 words that every change dragged along, much of it no longer true.
- **Decision:** the documents of [`memorysmithapp-template`](https://github.com/memorysmithapp/memorysmithapp-template) v0.3.0: `AGENTS.md` and `.claude/CLAUDE.md` at the root, `PRD.md`, `ARCHITECTURE.md` and `SDLC.md` in `docs/`, written from the code rather than migrated, holding only what the code cannot say.
- **Rationale:** text an agent loads that is no longer true misleads more than missing text. A document per question gives each fact one home, and identifiers (`RN-*`, `INV-*`, `ADR-*`) give the code something stable to cite where a section number breaks at the first renumbering.
- **Consequences:** a commit touches a document only when it changes a rule, an invariant or a decision ([`SDLC.md` §4.1](SDLC.md#41-when-a-commit-touches-each-document)); the Markdown specification is the one `memorysmithapp-markdown` publishes, and no longer has a copy here.
- **Date:** 2026-10-18. **Status:** Accepted. **Origin:** #319.
