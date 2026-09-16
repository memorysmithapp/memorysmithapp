# Software Vision: the MemorySmith.app platform

This document is the source of truth for **what the product does and under which rule**. It describes the vision, the ubiquitous language, the subscription business model, the roles, the domain entities, the business rules (`RN-XXX`), the public MCP contract, the screens and the scope of each version.

Business rules are numbered `RN-{CONTEXT}-{NNN}`, where `CONTEXT` is the prefix of the bounded context the rule belongs to (§6). The codes are **append-only**: they are never renumbered nor reused, and a rule that stopped holding is marked as removed on its own line, keeping its number. The moment a number is reserved is in [`development-process.md`](development-process.md) §6.

For general facts of the domain (Markdown, MCP, auditing, data protection law), see [`knowledge-base.md`](knowledge-base.md). For how the product is built (keys, transactions, adapters, infrastructure), see [`architecture-guide.md`](architecture-guide.md). This document **does not repeat** the content of those two: it references them by section.

---

## Contents

1. [Product vision](#1-product-vision)
2. [Product principles](#2-product-principles)
3. [Ubiquitous language](#3-ubiquitous-language)
4. [Platform and subscriptions](#4-platform-and-subscriptions)
5. [Roles and permissions](#5-roles-and-permissions)
6. [Map of domains](#6-map-of-domains)
7. [Domain: Access](#7-domain-access)
8. [Domain: Knowledge](#8-domain-knowledge)
9. [Domain: Agent Access (the public contract)](#9-domain-agent-access-the-public-contract)
10. [Domain: Discovery](#10-domain-discovery)
11. [Domain: Audit](#11-domain-audit)
12. [Domain: Portability](#12-domain-portability)
13. [Application interface](#13-application-interface)
14. [Product limits](#14-product-limits)
15. [Where version scope, risks and open questions live](#15-where-version-scope-risks-and-open-questions-live)

---

## 1. Product vision

### 1.1 The problem

The focus of this software is to strengthen the **efficiency and effectiveness of the relationship between people and AI agents**, whatever AI platform is chosen and however large the team of people is.

**The memory of the work fragments in two directions at once.** A team runs a project: an audit, a regulatory process, a piece of research, a construction site, a product launch. None of that has to be software. Each person handles their part alongside an agent, and there is no AI platform of the team: one works in Claude, another in ChatGPT, a third in the assistant built into the tool they already used. The choice is personal, it changes over time, and there is no reason to make it uniform. That diversity would not be a problem if a shared layer of retention existed. Without one, the memory breaks along two dimensions at the same time:

1. **By time, the session.** The memory of the agent ends when the session ends, and the next conversation starts from zero, knowing about the subject only what fits in that window.
2. **By vendor, the silo.** What a platform retains about whoever uses it belongs to that platform and that person, does not leave it, and no agent of anyone else reads it.

Added together, the two produce as many partial and private memories as there are people multiplied by platforms, about work that is one single thing. What the team actually knows stays scattered across conversations, documents, spreadsheets, decision threads and the heads of whoever took part.

**The cost does not show up as a lost file. It shows up as three operational bottlenecks:**

1. **Rework from rebuilding context.** Every task starts by rebuilding the context, and the person spends more time redescribing to the agent what the team had already decided, slightly differently each time, than doing the work.
2. **Diverging premises.** Two people describe the same fact in two ways to their agents, and there is no central point to check which of the two versions holds.
3. **Erosion of trust.** The answer comes back without its source. Checking costs more than accepting, so it is accepted unchecked, and that is what erodes trust in everything the base comes to hold.

**The four practices that describe fluency in working with AI all degrade from the same root cause:** the absence of a shared body of knowledge, persistent and readable by both sides (*Delegation*, *Description*, *Discernment* and *Diligence*, detailed in `knowledge-base.md` §4.4). Without it, what gets delegated is the retyping of context instead of the task, the same scenario is described again every session, the answer is judged by plausibility instead of by source, and no trail is left to answer for what was produced. Hence the double requirement running through the product: the base has to be **cheap to write**, because whoever writes in it most is the agent during the work, and **cheap to read**, because the person has to curate and decide without switching tools.

**What is missing is a single source of truth, shared by people and agents**, that survives the session and belongs to no platform. It is built in three linked movements:

1. **Capture with evidence.** A norm, legislation, technical documentation, research, a decision taken in a meeting. What comes in records where it came from and who wrote it, human or agent, because a statement that cannot be traced to its source does not sustain a decision later.
2. **Curate.** Captured material is not knowledge yet. Someone has to judge what is worth keeping, reconcile what contradicts itself, connect the new to what already existed, and see what is mature and what is still a draft. Curation is human work assisted by an agent, never an automatic by-product of ingestion.
3. **Serve both sides with the same material.** The base is the source of truth for the agent, which reads it on every task instead of guessing, and the working surface for the person, who learns from it, corrects what is wrong and decides with it in sight. Two readers with different demands on exactly the same content.

**That source is alive.** It is neither the report written at the end nor the document frozen at the start: it grows and corrects itself while the project runs, and today's version is not the one from two weeks ago. That is the characteristic, not the defect, and it imposes the last requirement: the base has to be able to say what it said on the date someone decided based on it.

**Improvised arrangements for centralisation fail wholesale**, because they treat the base as a passive file repository and ignore what collaboration between people and agents demands:

1. **A monolith of information, with no granularity.** Concentrating knowledge in long documents charges both sides. For the person, search and reading become slow and inflexible. For the agent, long text fills the context window with noise, makes the evidence hard to locate, and prevents linking concept, decision and reference precisely (`knowledge-base.md` §4.1 and §5.3).
2. **Proprietary format and visual rigidity.** A document formatted for presentation, such as a PDF, a slide deck or a complex spreadsheet, makes structured context hard to extract and to write, and blocks interconnection between pieces of information (`knowledge-base.md` §1.4).
3. **Access incompatible with an agent.** Without a standard connector, the agent does not navigate the network of information, does not follow a dependency, does not validate metadata and does not write into the base autonomously and safely (`knowledge-base.md` §3.1).
4. **No governance metadata.** The layer of instruction that tells people and agents how to read and how to update the content is missing, and so are the date, the maturity (draft or settled) and the explicit authorship of each passage. Without those the base becomes a pile, and a pile induces error, hallucination and loss of traceability (`knowledge-base.md` §2.3 and §7.3).

**The arrangement that comes closest today, and where it stops.** The flow that already works is a local folder of `.md` files, with a document at the root explaining to the agent how to write in it, and a vault editor on top for navigating. It gets the essentials right, the format is readable by both sides and the structure is declared, but it belongs to one person and stops at three predictable points (detailed in `knowledge-base.md` §2.5):

1. **Collaboration:** the content is local, and two people do not work on the same body of knowledge.
2. **Shared navigation:** vault editors are local clients, poor as clients of a remote repository.
3. **Multiple notebooks:** separating subjects requires loose folders, with no place listing them.

To those three add what the local folder never had and what curating and deciding actually require: a record of who wrote each thing, when, and with which agent.

### 1.2 The solution

**Knowledge notebooks in Markdown, with declared structure, natively reachable by AI tools.**

MemorySmith.app is the remote knowledge infrastructure that sustains the persistence of context: notebooks in plain Markdown, with declared structure, natively operable by AI agents and by people. It is the remote backend of the flow that already works, because it keeps the format (plain Markdown), keeps the practice (a Guidance at the root, a Template per folder) and solves the three points where the local folder stops, adding the four capabilities no improvised arrangement has:

- **Authenticated remote access.** One notebook reached by several clients and agents, under a verified identity (§4).
- **Collaboration with roles.** Permission by role in the subscription and a per-notebook role ceiling, holding equally for people and for agents (§5).
- **Auditable and immutable history.** Every change traceable to who wrote it, with which agent, and what the note said before (§11).
- **Relational and curation-driven discovery.** A graph of links over atomic notes, search over the text of the notebook, and facets showing the distribution of the content (§10).

#### Interoperability through the protocol

Against fragmentation by vendor the product acts at the protocol layer, and not by adopting a proprietary tool: the notebook is served by a remote MCP server, and MCP is an open standard spoken by clients from different makers (`knowledge-base.md` §3.5). Each person stays on the AI platform they prefer, and all of them reach the same notebook, with the same content, under the same role and on the same version of the truth.

#### The concept

The name says the rest. A forge does not store metal, it works it: the raw material, which here is data, norms and decisions, goes in and comes out as a piece, hammered and checked while it is hot. That is the role of the product over the memory of a team, which is forged during the work, by people and agents over the same material, and not transcribed after the work is done.

### 1.3 The cycle of use

The agent acts in both directions: it reads the notebook and it **feeds** it. The three movements of §1.1 appear here as the concrete case the product serves:

1. **Ingestion.** The agent reads a body of raw material, such as norms, legislation, technical documentation or research, and turns it into granular notes inside the notebook, obeying the Guidance (what this notebook is), the folder structure (where each thing goes) and the Template of the folder (how the note is shaped). Every write records who made it, with which agent, and what the note said before (§11).
2. **Curation.** People review what came in and drive the corrections, and the interface is where they read: the note and the structure as the agent receives them, the distribution of the notebook through the curation panel (§10.3), and the count of pending links and orphan notes in the catalogue (§13).
3. **Consumption.** Later, at another moment of the project, such as an audit, an opinion or a report, agents and people use the same notebook as the single source of truth to ground what they deliver.

**Three principles the cycle imposes on the whole product:**

- **Writing through the protocol is the primary path of ingestion.** Whoever populates the notebook is the agent, by construction. Writing is not a secondary feature exposed by the internal API.
- **The Guidance, the folder structure and the Template are executable instructions, not documentation** (`knowledge-base.md` §4.2). They are what makes the agent write the right note, in the right folder, in the right shape. A weak Guidance or a vague folder description degrades the quality of what comes in, and the effect only shows up later, at consumption.
- **Governance and provenance are by design.** The notebook sustains regulated and auditable work, so authorship and temporal traceability are a premise of the system (§11), and not compliance bolted on afterwards.

### 1.4 The thesis, in one sentence

The product is not storing `.md`, it is **delivering structured context to the agent without friction**. If consulting a hosted notebook costs more effort than reading a local folder, the value proposition is compromised. That is why MCP is not an accessory: it is the primary integration layer, and the internal API exists to serve the interface.

The complementary pillar of the same thesis is human reading and curation. A base a person cannot navigate and validate stops being curated, and a base without curation loses the ability to serve as a trustworthy source for the agent (§13).

### 1.5 Value proposition

| Audience | The central pain | What the product delivers |
|---|---|---|
| Whoever works with an agent over a body of knowledge | Improvised arrangements are static, isolated or expensive to consult | A remote notebook in plain Markdown, natively connected to the AI client |
| A team working with agents every day | Every new session rebuilds the context by hand | A shared memory between people and agents, written during the work and read on every task |
| A team where each person uses the AI platform they prefer | The vendor silo prevents sharing the context | One remote MCP server: the same notebook, with the same role, in any client that speaks the protocol |
| Teams sharing one base | Syncing files solves neither concurrent editing nor access control | A subscription with roles, and writing with conflict detection |
| Regulated work (audit, legal, compliance) | There is no way to show which premises grounded a past opinion | History by revision, authorship of human and agent, an immutable trail |
| Whoever has many subjects | Loose folders, with no catalogue | A catalogue of notebooks with descriptions, each one autonomous |
| Whoever fears lock-in | The base is a long-term asset, and a proprietary format traps it | Export of plain `.md`, with no proprietary format |
| Whoever has a sovereignty requirement over where the data lives | Hosting with a third party is a decision that does not rest on technology alone | The whole backend runs in the AWS account of whoever installed it, on the same code (§4.9) |

### 1.6 Slogan

**Structured knowledge, natively readable and writable by humans and agents.**

---

## 2. Product principles

Decisions that hold for the whole product and that any new feature has to answer to. The corresponding engineering principles are in `architecture-guide.md` §2.

| # | Principle | Practical consequence |
|---|---|---|
| **PP1** | **In the end it is all Markdown** | The backend organises and serves; it does not generate Markdown from a typed schema, and it does not impose structure on the content |
| **PP2** | **An autonomous notebook** | Each notebook describes itself in its own Guidance. No inheritance between notebooks and therefore no links between notebooks |
| **PP3** | **A mould is a suggestion, not a contract** | The Template guides the writing; a note is not required to follow it, and the server does not validate against it |
| **PP4** | **The backend does not interpret the content** | What goes inside a note, frontmatter included, is decided by the Guidance and the Template. The backend reads only the notation the specification declares, never a notebook convention. There are three sanctioned readers: the link extractor and the facet extractor, in Discovery projections (§10.3), which aggregate without assigning meaning; and the reader that names a note (RN-KNW-035), which reads one reserved key, `name`, and decides identity, never behaviour |
| **PP5** | **Discovery is derived** | The graph, the search and the facets are never the source of truth; they are rebuildable from the `.md` files |
| **PP6** | **The past is immutable** | Deleting a note does not destroy the history. Destroying content is a recorded administrative act, never a side effect |
| **PP7** | **Portable by construction** | Export returns plain `.md` in a readable file tree, with no proprietary format |
| **PP8** | **A complete model, a progressive interface** | Subscriptions, roles and links exist from the first line; the UI only shows each one when the user reaches the case that requires it |
| **PP9** | **Order is signal, not decoration** | The order of folders and notes is content: it is what tells the agent where to start. That is why it is editable and why it survives even the export |
| **PP10** | **An error is interface** | Every refusal returned to the agent has to say what to do next: a missing argument returns the valid options, and a conflict returns the current content |

---

## 3. Ubiquitous language

One term per concept, from the code to the product. Divergence here is the beginning of every anaemic model. These terms appear in the code exactly as they are in the "Term" column.

| Term | Means | Do **not** confuse with |
|---|---|---|
| **Subscription** | The subscription: the isolation boundary, the unit of collaboration, the unit of billing and the root of everything. It has an owner, members and a state | A user account |
| **Platform Admin** | Whoever operates the platform and authorises subscriptions. **It is not a role inside any subscription** and it does not reach content | Owner, customer administrator |
| **Owner** | The holder of the subscription: responsible for payment, changes the role of members and removes them, edits everything. One per subscription | An editor with many rights |
| **Notebook** | A self-describing knowledge notebook | A repository, a root folder |
| **Guidance** | The **role** of "what this notebook is for and how to structure its notes", played by a document the notebook points at | A file named `GUIDANCE.md` |
| **Folder** | An ordered node of the notebook tree, with a `description` saying *what is kept there*. The description is an attribute of the folder, never a Content Slot | A physical directory (there is none), a folder document |
| **Template** | The **role** of "the suggested layout of the notes of this folder", played by a document the folder points at | A schema, validation, a file named `TEMPLATE.md` |
| **Note** | A Markdown document; what goes inside it is decided by the Guidance and the Template | A record, a typed entity |
| **Position** | The key that orders siblings: folders among folders, notes within a folder | A dense index, an `order` field |
| **Link** | A reference from one note to another, extracted from the Markdown | An external hyperlink |
| **Edge** | A link already resolved to a target `NoteId` | A pending link |
| **Pending Link** | A link whose target does not exist yet; it resolves on its own when the target note is created | A broken link |
| **Facet** | A frontmatter attribute that can be aggregated for curation: the standard `maturity` and `reviewed`, plus whatever the Guidance of the notebook defines, discovered by the shape of the value | A typed backend field, a note schema |
| **Authorship** | Who wrote: the human **and** the agent used | The logged-in user |
| **Revision** | The exact content of a note at one instant | An event, a change |
| **Audit Event** | An append-only record of what happened, with authorship and revision | An application log |
| **Notebook Context** | A composed document (the Guidance plus the annotated tree) delivered to the agent. It is derived on every call and never stored | A dump of the notebook, a document somebody edits |
| **Content Slot** | A stored Markdown document, addressed by an opaque identifier. A note, a guidance and a template are the **same** kind of thing; what differs is who points at it | A file, a path |
| **Content Role** | The meaning assigned to a slot: `body` (a note), `guidance` (a notebook) or `template` (a folder) | A reserved file name |
| **Subscription Link** | The `(user, subscription)` relation that authorises that user to act in that subscription | Membership |
| **Active Subscription** | The subscription the session acts on behalf of right now, chosen among the links | The set of the user's subscriptions |
| **Membership** | The `(user, subscription)` relation with the role `EDITOR` or `VIEWER` | A Subscription Link, which only says the user reaches the subscription |
| **Notebook Role Limit** | The role ceiling of a member in a specific notebook. It only lowers, never promotes | A role of the notebook's own |

---
## 4. Platform and subscriptions

### 4.1 Overview of the model

The subscription is not a feature: it is the shape of the product. A customer is a **Subscription**, and inside it people collaborate on **Notebooks**.

```
Subscription  (boundary of isolation, collaboration, billing and identity: one owner, members, one state)
└── Notebook  (the knowledge itself, autonomous, PP2)
    ├── Guidance
    └── Folder (ordered, with a description)
        ├── Template
        └── Note (ordered)
```

**Above the subscription there is only the platform**, operated by the `PLATFORM_ADMIN`. It is not a level of the data hierarchy: it is a separate surface, which authorises subscriptions and never reaches content (§4.6).

### 4.2 The subscription is the boundary, the status is the state

The subscription carries two roles that are usually kept apart: it is the business object (who pays, on which plan, with which status) **and** the isolation boundary of all the data. That is only safe under one rule:

> **The `SubscriptionId` is perpetual.** It is issued once, never reissued and never changed, whether the subscription is pending, active, suspended or cancelled. Cancelling changes a status field; it does not move, does not rekey and does not delete anything. Re-subscribing reactivates **the same subscription**, with the same identifier, and all the data becomes reachable again exactly where it was.

Without that rule, "cancelling" would become a data migration and "re-subscribing" an import, and the isolation boundary would come to depend on a state that changes. With it, the status governs **access**, never **address**.

**The subscription has no name** (RN-SUB-020): what identifies it is the `SubscriptionId`, and who answers for it is its owner. A name would be one more field to keep up to date with nothing keeping it honest, and it would distinguish nothing the owner's e-mail does not already distinguish.

Besides its status, the subscription declares **what it is and how much it may hold**: a `type`, which at this stage can only be `individual`, and a storage `quota`, which is `500MB`, `1GB` or `2GB` (RN-SUB-018, RN-SUB-019). Both are chosen when the subscription is requested and can be changed later by an act of the `PLATFORM_ADMIN`.

The quota **is enforced** (RN-SUB-021). What it measures is the **current content**: the current revision of every note not deleted, plus every `Guidance` and every `Template`. Replaced revisions remain stored, because destroying bytes is an administrative act with a door of its own, and they deliberately do not count: charging for them would make usage rise on every edit and never fall, and deleting a note would give nothing back. A deleted notebook stops occupying anything once the purge completes, which is the one moment a deletion gives space back (RN-KNW-047).

What the quota refuses is only what **grows** the current content. Creating a note, lengthening one, writing a bigger `Guidance` and restoring a deleted note are refused with `LIMIT_EXCEEDED` when they do not fit; reading, deleting, moving, reordering and shortening keep working even above the ceiling. The reason is simple: a limit that freezes everything traps the person inside it, unable to shorten the very note that took them there.

### 4.3 Hierarchy, and why it has two levels

| Level | Who is in charge | Exists for |
|---|---|---|
| **Subscription** | `OWNER` (one, the holder) and the members `EDITOR` · `VIEWER` | Isolation, collaboration, billing, identity domain |
| **Notebook** | inherits the role from the subscription, with an optional ceiling (§5.3) | The knowledge itself |

**A conscious decision, with a declared cost.** There used to be a third level between the two, the workspace, and it was removed. It solved one case: two teams of the same customer that must not see each other. Without it, whoever is a member of the subscription reaches all its notebooks, and the only granularity left is the per-notebook ceiling, which lowers writing but never hides. Separating two groups now requires **two subscriptions**, and therefore two bills. The cost was weighed and accepted: one level fewer is worth more to whoever uses the product alone or in a single team, which is the case the product serves first, than the granularity would be worth for the case it does not serve yet.

### 4.4 Onboarding and the life cycle of a subscription

There is no automatic payment processing at this stage. Activation is an **administrative act** of the `PLATFORM_ADMIN`, which keeps the model complete while billing does not exist.

| Moment | What happens |
|---|---|
| **Signup** | Creates the user account. No subscription yet, no operational access. There is no open sign-up at this stage: the account is born by an act of platform operations |
| **Onboarding** | The user requests a subscription, choosing type and quota, and becomes its `OWNER`. Status: `pending_approval` |
| **Authorisation** | A `PLATFORM_ADMIN` approves (the status becomes `trial` or `active`) or rejects, with a mandatory reason |
| **Setup** | The `OWNER` creates notebooks and writes the Guidance and the Templates |
| **Leaving** | Removing a member revokes access; the account, the other links and the authorship of what they wrote remain |
| **Suspension / cancellation** | Operational access ceases; the data stays under the same key (§4.2) |

**Subscription states:**

```
                    ┌──────────────┐
   onboarding ─────▶│pending_approval│
                    └───┬────────┬─┘
               approval │        │ rejection (reason required)
                        ▼        ▼
             ┌───────────────┐  ┌──────────┐
             │ trial │ active│  │ rejected │──▶ may request again
             └───┬───────────┘  └──────────┘
                 │
                 ├──▶ suspended  ──▶ back to active
                 └──▶ canceled   ──▶ back to active (same subscription, §4.2)
```

### 4.5 One user, more than one subscription

Whoever onboards is the holder of their subscription, and whoever is also a member of another one takes part in a second one. Since the subscription is the isolation boundary, this is not an interface detail.

- **Identity is global; a subscription is a link.** The user account belongs to no subscription. Taking part is a relation with a role of its own in each one.
- **The active subscription is chosen, not inferred.** The session acts on behalf of one subscription at a time, and switching is an explicit action.
- **The MCP connector fixes the subscription at consent.** It enters the connector's access the moment the user authorises it and does not change for the life of that access. Without that rule, an agent with a long session would switch subscriptions in the middle of an ingestion job, and the half already written would be in the wrong place. One connector, one subscription; whoever works in two authorises two connectors.

### 4.6 The platform is a separate surface

The `PLATFORM_ADMIN` operates the platform: it approves, rejects and suspends subscriptions. **It is not a role inside any subscription** and, by construction, it does not reach content:

> A platform session **carries no active subscription**. Since every data key of the system starts with the subscription, there is no key an admin credential can assemble. The impossibility is structural, not a check somebody has to remember to write.

What it sees is subscription metadata: the owner, the e-mail, the status, the type, the quota, the dates and the member count. Never a notebook name, never note content.

It also has **two administrative operations**, which exist to operate an environment and not for the review flow: setting the status directly, without going through the transition machine of §4.4, and changing the type and the quota (RN-SUB-018, RN-SUB-019). Both are recorded as events of their own, distinct from the approval, rejection, suspension and reactivation events, precisely because they were not the common path: the trail has to say which of the two happened.

If a `PLATFORM_ADMIN` is also a user of some subscription, they act there like any other member, in a session of their own. The two roles never add up in the same session.

### 4.7 Progressive interface (PP8)

**The UI hides the member list while there is only the owner, and hides subscription switching while there is only one link.** The model is complete from the start, and it is the interface that appears in stages.

### 4.8 Business rules: subscription and isolation

- **RN-SUB-001:** Every piece of data in the system belongs to exactly one subscription; there is no data shared between subscriptions.
- **RN-SUB-002:** The subscription a request operates under is determined by the authenticated credential, never by a request parameter.
- **RN-SUB-003:** No query may return data from more than one subscription. Two questions cross the boundary and they are the only ones: *"which subscriptions does this user take part in?"* and the administrative listing of subscriptions by status. Neither reveals content.
- **RN-SUB-004:** A resource of another subscription is indistinguishable from a resource that does not exist: both answer `NOT_FOUND`.
- **RN-SUB-005:** The `SubscriptionId` is perpetual: issued once, never reissued, immutable across every status transition. Cancellation and reactivation use the same identifier.
- **RN-SUB-006:** Signup creates only the user account. No subscription is created automatically and no operational access is granted.
- **RN-SUB-007:** A subscription in `pending_approval`, `rejected`, `suspended` or `canceled` grants operational access to nobody, not even to its own `OWNER`, and not over MCP.
- **RN-SUB-008:** Only a `PLATFORM_ADMIN` approves, rejects, suspends or reactivates subscriptions.
- **RN-SUB-009:** Rejection requires a reason, which is communicated to the requester; they may request again.
- **RN-SUB-010:** Approval sets the status to `trial` or `active`, at the discretion of the `PLATFORM_ADMIN` according to the commercial agreement.
- **RN-SUB-011:** A user may be linked to multiple subscriptions; exactly one is the active subscription of the session.
- **RN-SUB-012:** One of the links is marked as the default and is assumed when no valid active subscription is found.
- **RN-SUB-013:** Switching the active subscription is an explicit user action; no business operation takes the subscription as an argument.
- **RN-SUB-014:** An authorised MCP connector always operates on the subscription fixed at the moment of consent, for the whole life of that authorisation.
- **RN-SUB-015:** Derived indexes (search, graph, facets, cache) respect the same subscription boundary as the source data.
- **RN-SUB-016:** A `PLATFORM_ADMIN` session carries no active subscription and therefore reaches no notebook or note data.
- **RN-SUB-017:** *(removed in 0.6.0)* It covered what accepting an invitation created. Inviting a member left the product until it comes back with a screen of its own (#114). The number is preserved and will never be reused.
- **RN-SUB-018:** Every subscription declares a `type`, chosen at request time, whose only value at this stage is `individual`. Only a `PLATFORM_ADMIN` changes the type afterwards, and it is also the `PLATFORM_ADMIN` who may set the status directly, without following the transition machine of §4.4. A status set that way is recorded as an event of its own, and setting `rejected` through that path does not satisfy RN-SUB-009: rejecting a request somebody is waiting on still requires a reason.
- **RN-SUB-019:** Every subscription declares a storage `quota`, chosen at request time among `500MB`, `1GB` and `2GB`, and changeable later by a `PLATFORM_ADMIN`. It is enforced under the terms of RN-SUB-021. *(Up to 0.2.0 this rule said the quota was declared and not enforced.)*
- **RN-SUB-021:** The `quota` of RN-SUB-019 is enforced over the **current content** of the subscription: the current revision of every note not deleted, plus every `Guidance` and every `Template`. Replaced revisions stay stored and are not counted. A write that increases that total is refused with `LIMIT_EXCEEDED` when the resulting total would exceed the quota; a write that reduces it or keeps it the same is always accepted, even above the ceiling. The count is kept outside the write transaction and is therefore slightly delayed: a subscription may end up a little above the ceiling, never indefinitely above it.
- **RN-SUB-020:** The subscription has no name. It is identified by the `SubscriptionId`, and to whoever operates it, it is recognised by the owner's e-mail. No screen, route, event or storage item carries a subscription name.
- **RN-SUB-022:** A session whose token can no longer be renewed is **ended**, and the person returns to the sign-in screen with the message of their case. The browser never keeps a credential the provider or the API has refused, and no screen presents a request that has already failed as a wait: a failure to authenticate is the absence of a session, never a session with less in it.

---

### 4.9 Modes of operation

The product runs in **two modes over the same code**, and what differs between them is not functionality: it is who occupies each role.

In the **hosted service**, the `PLATFORM_ADMIN` is product operations, and the quota of the subscription is its commercial limit.

In a **self-hosted install**, whoever operates the platform is whoever installed it. The first member of the administration group is born in the onboarding of the install, and only the first. The quota stops being a commercial limit and becomes a choice of whoever operates it.

**In neither of them is any capability held back.** There is no edition fork anywhere in the code, so what runs on the hosted service is exactly what is in the repository, under the MIT licence. The step-by-step install path lives in `README.md`, not here.

---

## 5. Roles and permissions

### 5.1 Taxonomy

Four roles, on two planes that never mix in the same session:

| Role | Plane | Granted to | Count |
|---|---|---|---|
| `PLATFORM_ADMIN` | Platform | Whoever operates the service | Several |
| `OWNER` | Subscription | The holder, set at onboarding | **Exactly one per subscription** |
| `EDITOR` | Subscription | A member who writes | Several per subscription |
| `VIEWER` | Subscription | A member who only reads, an external reviewer included | Several per subscription |

The three customer roles belong to the **subscription**. The `OWNER` reaches all of its notebooks without having to be invited to each one, and `EDITOR` and `VIEWER` reach all the notebooks with the role they hold, as far as the ceiling of each notebook allows (§5.3). A user has **one** role per subscription, not one role per slice.

**Transfer.** The `OWNER` may transfer ownership to another member of the subscription, and from then on becomes an `EDITOR`. The subscription is never left without a holder, because the transfer is atomic and is not "remove and then appoint".

### 5.2 Permission matrix

| Action | `PLATFORM_ADMIN` | `OWNER` | `EDITOR` | `VIEWER` |
|---|:---:|:---:|:---:|:---:|
| Approve / reject / suspend a subscription | ● | — | — | — |
| See subscription metadata (owner, status, dates) | ● | ●¹ | — | — |
| Change the role of a member, remove a member | — | ● | — | — |
| Set the role ceiling of a member in a notebook (§5.3) | — | ● | — | — |
| Transfer ownership of the subscription | — | ● | — | — |
| Create a notebook | — | ● | ● | — |
| Rename / delete a notebook | — | ● | — | — |
| Create / edit / delete a note | — | ● | ● | — |
| Create / rename / move / reorder a folder | — | ● | ● | — |
| Edit the Guidance and the Template | — | ● | ● | — |
| Move a note between notebooks | — | ● | ●² | — |
| Read the notebook, folders, notes | — | ● | ● | ● |
| Search | — | ● | ● | ● |
| See the graph, backlinks and notebook health | — | ● | ● | ● |
| See history and activity | — | ● | ● | ● |
| Export a notebook | — | ● | ● | — |

¹ Of their own subscription only.
² Only when the `EDITOR` reaches both notebooks involved with a writing role, which includes not being demoted in either of them (§5.3).

**The `PLATFORM_ADMIN` column is almost entirely empty, and that is the guarantee, not a gap** (§4.6). It operates the platform; the knowledge of the customers is out of its reach by construction.

### 5.3 Per-notebook role ceiling

A subscription may hold notebooks of differing sensitivity. For that the `OWNER` may **lower** the role of a member in a specific notebook.

**The effective permission is always the lesser of the subscription role and the notebook ceiling. It never promotes.**

| Role in the subscription | Ceiling in the notebook | Effective |
|---|---|---|
| `EDITOR` | — (none) | `EDITOR` |
| `EDITOR` | `VIEWER` | `VIEWER` |
| `VIEWER` | — (none) | `VIEWER` |
| `VIEWER` | `VIEWER` | `VIEWER` |
| `VIEWER` | `EDITOR` | **refused**, because the ceiling does not promote |

There is only one ceiling value: `VIEWER`. There is no "no access", because **whoever is a member of the subscription sees all of its notebooks**; what the ceiling controls is writing, not seeing. Taking a notebook out of someone's reach requires a separate subscription (§4.3), which keeps the question "who sees what" answerable by looking at the member list alone.

The ceiling does not apply to the `OWNER`: they hold the subscription and reach everything.

### 5.4 Access business rules

- **RN-ACC-001:** Every subscription has, at any instant, exactly one `OWNER`. Removing the `OWNER` is refused; the only way out is a transfer of ownership.
- **RN-ACC-002:** The transfer of ownership is atomic: the new holder becomes `OWNER` and the previous one becomes `EDITOR` in the same operation.
- **RN-ACC-003:** The e-mail is unique among the members of a subscription.
- **RN-ACC-004:** *(removed in 0.6.0)* It said a pending invitation granted no access. Inviting a member left the product until it comes back with a screen of its own (#114). The number is preserved and will never be reused.
- **RN-ACC-005:** *(removed in 0.6.0)* It said an invitation was single-use, bound to its e-mail and valid for 7 days. Inviting a member left the product until it comes back with a screen of its own (#114). The number is preserved and will never be reused.
- **RN-ACC-006:** Only the `OWNER` changes roles, removes members and sets notebook ceilings.
- **RN-ACC-007:** *(removed)* It covered the creation, renaming and removal of workspaces. The workspace level no longer exists (§4.3). The number is preserved and will never be reused.
- **RN-ACC-008:** *(removed in 0.6.0)* It said only a `trial` or `active` subscription issued invitations. Inviting a member left the product until it comes back with a screen of its own (#114). The number is preserved and will never be reused.
- **RN-ACC-009:** Removing a member revokes access to the subscription and fully preserves what they wrote, the recorded authorship included.
- **RN-ACC-010:** A `VIEWER`, whether by subscription role or by notebook ceiling, is refused on any write operation, through the UI and through MCP alike.
- **RN-ACC-011:** The per-notebook role ceiling only lowers. Setting a ceiling higher than the member's role in the subscription is refused with `VALIDATION`.
- **RN-ACC-012:** The only admitted ceiling value is `VIEWER`; there is no ceiling that removes visibility of the notebook.
- **RN-ACC-013:** The notebook ceiling does not apply to the `OWNER`.
- **RN-ACC-014:** Removing a member from the subscription also removes all of their notebook ceilings.
- **RN-ACC-015:** Every authorisation decision is taken by the service that owns the resource, combining the user's role in the subscription with the ceiling of the notebook.
- **RN-ACC-016:** Role changes, ceiling changes and removals may take up to 5 minutes to take effect on already authenticated sessions, because the authorizer decision is cached for that long.
- **RN-ACC-017:** Every message the product sends an account leaves from `no-reply@` the domain of the environment, carries the visual identity of the brand, is written in the language of that account, and states how long the credential it carries lasts. A credential stands alone on its own line, and nothing follows it.
- **RN-ACC-018:** The language of an account is `pt_BR` or `en_US`. It is the one given when the account is created, `pt_BR` when none is, and from then on the one the person last chose in the interface.

---

## 6. Map of domains

Six bounded contexts. The separation is one of responsibility and vocabulary; the deployment shape is an engineering decision (`architecture-guide.md` §3 and §17).

| Context | Responsibility | Type | `RN` prefix |
|---|---|---|---|
| **Access** | Subscriptions and their life cycle, members, roles, notebook ceilings, links, authorisation | Supporting | `SUB`, `ACC` |
| **Knowledge** | Notebooks, guidance, folders, order, templates, notes | **Core** | `KNW` |
| **Discovery** | The link graph, the text index and the curation facets, three projections | Supporting | `DSC` |
| **Audit** | The append-only trail: authorship, revisions, reconstruction by date | Supporting | `AUD` |
| **Agent Access** | The MCP server; composes the Notebook Context; translates domain ↔ tools | Supporting (anticorruption layer) | `AGT` |
| **Portability** | Export to a readable file tree | Generic | `PRT` |

The prefix is that of the context the rule belongs to. **Access carries two**, because it separates what belongs to the boundary from what belongs to whoever enters it: `SUB` for the subscription, its life cycle and isolation, `ACC` for members, roles and ceilings. No prefix is retired when a context changes shape, because the codes already issued stay referenced.

**Knowledge is the core domain**, because that is where the rule no competitor solves for free lives: declared structure, meaningful order, content roles and cheap concurrent writing. Everything else exists to serve it or to carry it.

**Discovery, Audit and Portability are never consulted by Knowledge.** They only feed on what it publishes. That single direction is what makes it possible to rebuild them from zero (PP5).

---
## 7. Domain: Access

### 7.1 Entities

#### Entity: `User` (global identity)

```
id,                          -- global identity; belongs to no subscription
email, name,
locale,                      -- pt_BR or en_US: the language every message to the account is written in (RN-ACC-018)
is_platform_admin (bool),    -- platform plane; never adds to a subscription role (section 4.6)
created_at, last_login?
```

#### Entity: `Subscription` (Aggregate Root)

```
id,                          -- PERPETUAL: issued once, never reissued (RN-SUB-005)
                             -- it has no name: what identifies it is the id, and who
                             -- answers for it is the owner (RN-SUB-020)
owner_id,                    -- exactly one, always present (RN-ACC-001)
status (pending_approval | trial | active | rejected | suspended | canceled),
type (individual),           -- what the subscription is, commercially (RN-SUB-018)
quota (500MB | 1GB | 2GB),   -- enforced over the current content (RN-SUB-019, RN-SUB-021)
requested_at,
reviewed_by_id?, reviewed_at?,
rejection_reason?,           -- required when status = rejected (RN-SUB-009)
created_at,
members: [{
  user_id,
  email,                     -- unique among the members of the subscription (RN-ACC-003)
  role (EDITOR | VIEWER),    -- OWNER is not a member: it reaches everything by ownership
  invited_by_id,
  joined_at
}]
```

The `status` field governs **access**, never **address** (§4.2). No status transition moves or rekeys any data.

#### Entity: `SubscriptionLink` (§4.5)

```
user_id, subscription_id,
is_owner (bool),
is_default (bool),
joined_at
```

#### Entity: `NotebookRoleLimit`, the per-notebook ceiling (§5.3)

```
notebook_id, user_id,
limit (VIEWER),              -- the only admitted value (RN-ACC-012)
set_by_id, set_at
```

It lives next to the notebook, not next to the member: whoever knows which notebooks exist is Knowledge, and the authorisation decision has to be local (`architecture-guide.md` §14.2).

### 7.2 Business rules

The Access rules are in §5.4 (`RN-ACC-XXX`), next to the permission matrix and the per-notebook ceiling they govern. The subscription and isolation rules are in §4.8 (`RN-SUB-XXX`).

---

## 8. Domain: Knowledge

The core. Four concepts: the notebook, the folder tree, the note and the content.

### 8.1 Entities

#### Entity: `Notebook` (Aggregate Root)

Consistency boundary: the notebook and **its whole folder tree**.

```
id, subscription_id,
name, slug,                  -- slug unique within the subscription (RN-KNW-032)
description,                 -- what shows up in the notebook catalogue
version,                     -- concurrency control of the aggregate
created_by (Authorship), created_at, updated_at
```

The Guidance is **not** a field here, and the Template is not a field of the folder: each is an entity of its own (RN-KNW-044). What the notebook still answers is which of its folders carry a Template and whether it has a Guidance, because that is what the Notebook Context and the tree show.

#### Entity: `Folder`, part of the `Notebook` aggregate

```
id, notebook_id,
parent_folder_id?,           -- null = root of the notebook
name, slug,
description,                 -- REQUIRED, 1 to 500 characters: it is what guides the agent
position,                    -- order among sibling folders
created_by (Authorship), created_at, updated_at
```

#### Entity: `Note`, a separate Aggregate Root

```
id, notebook_id, folder_id,
name?,                       -- the name: the content states, never given (RN-KNW-035)
position,                    -- order within the folder
body_ref,                    -- pointer to the Content Slot playing the body role
created_by (Authorship),
updated_by (Authorship),
deleted_at?, deleted_by?,    -- deleted, and awaiting the purge (RN-KNW-047)
version                      -- concurrency control
```

The name is **not a field a caller writes**: it is the `name:` of the frontmatter, read from the body on every write, and it is absent when the content states none a link could use (RN-KNW-036). Nothing about it is unique, and there is no slug: a note is addressed by its identifier and named by the `name:` it states.

`Note` is an aggregate of its own and not part of the `Notebook`. The technical justification is in `architecture-guide.md` §6.2; the product consequence is what matters here: **writing a note is cheap and concurrent**, which is the path through which the agent feeds the notebook.

#### Entities: `Guidance` and `Template`, each an object of its own

```
Guidance:  notebook_id, content_ref, version, created_by, updated_by, updated_at
Template:  notebook_id, folder_id, content_ref, version, created_by, updated_by, updated_at
```

Each **names its parent** rather than living inside it, as a note names its folder, and the cardinality is the one difference from a note: a notebook holds zero or one Guidance, a folder zero or one Template (RN-KNW-044). Three consequences, and they are the reason for the shape:

- **each is deleted on its own** (RN-KNW-045), and the folder or the notebook stays;
- **writing one is not a change to the tree**, so it contends with nothing but another write of the same object;
- **when it goes, what it occupied goes with it**, off the storage count of the subscription (RN-SUB-021).

#### Entity: `ContentSlot` and `ContentRef`

A Content Slot is a Markdown document stored under an opaque identifier. **A note, a guidance and a template are the same kind of thing**; what differs is who points at it and with which role.

```
ContentSlot:  content_id, subscription_id, created_at
ContentRef:   content_id, revision, sha256, bytes
```

| Role (`Content Role`) | Pointed at by | Field |
|---|---|---|
| `body` | A note | `body_ref` |
| `guidance` | The `Guidance` of a notebook | `content_ref` |
| `template` | The `Template` of a folder | `content_ref` |

From that follows the most counterintuitive product rule of the system: **`GUIDANCE.md` and `TEMPLATE.md` are not file names, they are roles.** There is no reserved name in storage. File names only come back into existence at the edge, in the export (§12) and in the UI.

Four similar things live together here, and mixing them up is expensive:

| What it is | Where it lives | Who writes it |
|---|---|---|
| **Guidance** | A Content Slot pointed at by the `Guidance` of the notebook, with a revision and history | A human |
| **The folder description** | The `description` attribute of the folder, 1 to 500 characters, with no revision | A human |
| **Notebook Context** | Nowhere: it is composed on every read (§9.2) | The product, deriving |
| **`GUIDANCE.md`, `STRUCTURE.md`, `TEMPLATE.md`** | Only at the edge: in the export (§12) and never in storage | The product, materialising |

None of those file names appears in the interface or on the MCP surface. There, only the role and the composed document exist.

That makes trivial the operations that would otherwise be special-cased code: promoting a note to the template of the folder, turning a template into a note, adopting the content of a note as the guidance of the notebook. All of them are a pointer swap.

#### Value: `Position`

The order of folders and notes is **content, not a display preference** (PP9): it is a signal to the agent about where to start and how the subject is organised. That is why it is editable, why it is preserved in the Notebook Context and why it survives the export.

Alphabetical ordering stays available as a display option in the client, without changing the stored order.

### 8.2 Business rules: notebook and structure

- **RN-KNW-001:** Every notebook belongs to exactly one subscription, and to one only.
- **RN-KNW-002:** The `slug` of a folder is unique among its siblings (same parent, same notebook).
- **RN-KNW-032:** The `slug` of the notebook is unique **within the subscription**, because a notebook is what a person and an agent choose **by name** before anything else: `list_notebooks` answers names, and two notebooks under one name make every choice between them a guess. Creating a notebook whose name yields an already used `slug` answers `ALREADY_EXISTS` **with the identifier of the existing notebook**, and never creates a second one: a call retried after its answer was lost finds the notebook it made instead of making a twin, and the server does not generate an automatic suffix. Renaming to a taken `slug` gets the same refusal. The rule is not about addresses, since the interface addresses a notebook by its identifier (RN-DSC-045).
- **RN-KNW-003:** The maximum depth of the folder tree is 6 levels.
- **RN-KNW-004:** Moving a folder may never create a cycle: the destination may not be a descendant of the source.
- **RN-KNW-005:** Every folder has a `position` ordering it among its siblings; every note has a `position` ordering it within the folder.
- **RN-KNW-006:** The `description` of a folder is required, between 1 and 500 characters. An empty description is not accepted, because it is what guides the writing of the agent.
- **RN-KNW-007:** Removing a folder that contains folders or notes requires an explicit removal policy (`CASCADE` or `REJECT_IF_NOT_EMPTY`). There is no implicit default.
- **RN-KNW-008:** A notebook has at most one Guidance and a folder at most one Template; both are optional.
- **RN-KNW-044:** **A Template belongs to one folder and a Guidance to one notebook, and each is an object of its own**, not a field of its parent. A folder holds at most one Template and a notebook at most one Guidance, and what guarantees the "at most one" is the address of each: there is no second place the Template of a folder could live. Writing one is a write of that object and of nothing else, so it never locks the tree: two agents writing the Templates of two folders do not meet, and neither does one of them meet somebody renaming a third folder.
- **RN-KNW-045:** **A Template and a Guidance are deleted on their own**, under the role that writes them, and the folder or the notebook stays. Deleting a Template leaves the folder with no suggested layout; deleting a Guidance leaves the notebook saying nothing about how it wants to be written. Until then, the only way to be rid of either was to remove the folder or delete the notebook that held it.
- **RN-KNW-009:** Renaming, reordering or moving a folder or a note never changes the stored content, only pointers and order.
- **RN-KNW-010:** A notebook supports up to 200 folders. Above that ceiling the Notebook Context is truncated with an explicit notice. **There is no ceiling of notes**: what bounds the content of a notebook is the storage quota of its subscription (RN-SUB-019, RN-SUB-021).

### 8.3 Business rules: the note

- **RN-KNW-020:** *Removed in 0.6.0.* The `slug` of a note was unique within the notebook. A note carries no slug: it is addressed by its identifier and named by the `name:` it states (RN-KNW-035).
- **RN-KNW-021:** *Removed in 0.6.0.* There is no slug conflict to be free of when a note changes folder.
- **RN-KNW-022:** *Removed in 0.6.0.* Moving a note between notebooks carries no conflict policy, because a name collides with nothing (RN-KNW-037).
- **RN-KNW-023:** Moving a note between notebooks preserves the `NoteId` and, with it, the whole timeline of the note.
- **RN-KNW-024:** Moving a note out of a notebook **breaks every backlink that pointed at it in that notebook**. It is the semantically correct consequence (PP2), and the links that break start showing up as broken in Discovery (§10.1).
- **RN-KNW-025:** A note holds at most 1 MB of content.
- **RN-KNW-026:** Every state-changing operation records complete authorship: the responsible human and, when there is one, the agent that executed it. There is no anonymous change.
- **RN-KNW-027:** Every content change produces a new, immutable revision, referenced by the corresponding event.
- **RN-KNW-028:** If the content sent is byte for byte identical to the current one, there is no new revision, no event and no reindexing.
- **RN-KNW-029:** **Deleting a note is definitive.** The note leaves every listing and the search at once, and nothing brings it back: there is no trash in the product, and a notebook that wants one declares it in its Guidance — a folder, and a rule saying to move a note there instead of deleting it, which an agent follows. What the note leaves behind, its item and every revision of its content, is purged in the background (RN-KNW-047).
- **RN-KNW-030:** *Removed in 0.6.0.* Deleting a note freed its slug and restoring it required the slug to be free. Nothing is reserved and nothing is released: a note that comes back stands beside whatever was written while it was gone (RN-KNW-037).
- **RN-KNW-031:** The backend does not validate the note against the Template of the folder (PP3), and does not interpret frontmatter or any content convention (PP4).
- **RN-KNW-033:** **Deleting a notebook is definitive**, and takes everything it holds with it: the notebook starts answering `404` in every context at once, and so does every folder, note, Template and Guidance under it (RN-KNW-046), all of which are purged afterwards (RN-KNW-047). The operation belongs to the notebook administration role, like renaming. The name of the notebook is free in the subscription the instant it is deleted, because the notebook that held it is never coming back to claim it.
- **RN-KNW-035:** **The name of a note is the `name:` of its frontmatter**, when it is a single text value of any length, trimmed and normalised to NFC, and it is never given by the caller. Nothing else names a note: not a heading, not a first line, not a file name. It is derived on every write, by one function shared by Knowledge and Discovery, so the two cannot disagree about what a note is called. A heading is only content — it structures the text, renders and is searchable — because a name that moves when the opening line of a text is edited moves every edge that pointed at the note.
- **RN-KNW-036:** A note whose frontmatter states no `name:`, or whose name carries one of `#`, `[`, `]` or `|` — the four delimiters of the form that addresses it — **has no name**. It is written, it renders, it links outward and it is searchable, and no link can name it. The write is never refused, because refusing content is how an import loses a notebook; the absence is reported, the way a pending link is. A `/` is not one of the four: `Reunião 03/09/2026` is an ordinary name, because folders play no part in identity.
- **RN-KNW-037:** **A live note carries a name no other live note of its folder carries.** Two folders may each hold a note of one name, and that repetition is expected: the folder is what tells them apart for whoever reads, never the link, which reaches every note of that name in the notebook (RN-DSC-042, RN-DSC-046). A note with no name reserves nothing. Names are compared the way a link compares them: trimmed, NFC and case-exact, so `Lei 14.133` and `lei 14.133` stand side by side.
- **RN-KNW-038:** A note is renamed by editing the `name:` of its frontmatter, and in no other way. There is no operation that renames a note apart from its content, and editing a heading renames nothing.
- **RN-KNW-039:** A `name:` of any other shape — a list, a nested block, an empty value — means the note has no name. It is never an error, the note is never reported as malformed, no name is invented out of the value that was not used, and nothing falls through to a heading, because there is no chain.
- **RN-KNW-040:** *Removed in 0.6.0.* The ceiling of 200 notes on a `CASCADE` lost its object: removing a folder writes nothing under it (RN-KNW-046).
- **RN-KNW-041:** *Removed in 0.6.0.* Restoring a note lost its object when deleting became definitive (RN-KNW-029).
- **RN-KNW-047:** **What a deletion invalidated is purged in the background**, and nothing restores it: every revision of its content, its items and its projections. It runs on a queue fed by the deletion itself, after a delay, so a note written into a folder at the instant of its removal is purged with it; it is delivered at least once and a second pass changes nothing; and a subtree larger than one run continues in a message of its own. **The storage of the subscription is freed when the purge completes, not at the click** (RN-SUB-021), and each unit is counted once: a note deleted on its own freed its bytes at the deletion, and one invalidated by its parent frees them at the purge.
- **RN-KNW-042:** **Every operation that would leave two live notes of one name in one folder is refused, and changes nothing.** Creating and renaming answer `CONFLICT` with the code `ALREADY_EXISTS` and the identifier of the note that holds the name; moving a note into a folder that holds its name answers the same. Deleting a note frees its name at once. An import carrying two notes of one name in one folder is refused whole, before its first write (RN-PRT-014).
- **RN-KNW-046:** **A folder, a note, a Template and a Guidance are valid only while every unit above them is valid.** A note needs its folder, a folder its parent, a Template its folder, and all of them their notebook. Deleting is ONE write on the unit deleted, and everything under it becomes invalid in the same instant without being written: a unit under a deleted one answers as not found everywhere, leaves every listing and takes part in nothing. That is what makes removing a folder cheap whatever it holds, and what closes the window where a note written at the instant of the removal survived live in a folder nothing showed.
- **RN-KNW-034:** Writing the Guidance and the Template requires the **base revision**, as writing a note already does, and a diverging revision answers `CONFLICT` with the current content instead of overwriting. `null` is a legitimate value and asserts that the slot is empty: it is not the absence of the argument, it is a statement about the current state. The reason behind RN-AGT-005 holds here with more force, not less, because the Guidance is the most shared document of a notebook and the one most likely to be written by two hands at once, one on the web and an agent over MCP.

---
## 9. Domain: Agent Access (the public contract)

**MCP is the public contract of the product.** The internal API (`architecture-guide.md` §12) exists to serve the UI. It is the tool catalogue below that external clients consume, and it is that catalogue the versioning policy protects (`CLAUDE.md` § Versioning policy).

### 9.1 Tool catalogue

| Tool | Signature | Role |
|---|---|---|
| `whoami` | `()` | Who is acting, what the connection reaches and **how to write here**: the reading order of the notebook, the skill index and the whole catalogue |
| `get_skill` | `(name)` | The written method for a task, by the name `whoami` and the instructions of the handshake index (RN-AGT-028). It teaches, and never validates nor writes (RN-AGT-019) |
| `list_notebooks` | `()` | Visible notebooks, with their descriptions |
| `create_notebook` | `(name, description)` | Creates a notebook in the subscription; a repeated name answers `ALREADY_EXISTS` with the identifier of the existing one (RN-KNW-032) |
| `delete_notebook` | `(notebook)` | Deletes a notebook and everything in it, definitively: no undo, no trash, and the content destroyed shortly after (RN-KNW-033, RN-KNW-047) |
| **`get_notebook_context`** | `(notebook)` | **The main call.** The full Guidance plus the tree with descriptions, order, note counts and which folders carry a template |
| `get_guidance` | `(notebook)` | The Guidance as it is stored, with the revision to state when writing |
| `set_guidance` | `(notebook, content, baseRevision)` | Writes the Guidance of the notebook, with conflict detection (RN-KNW-034), and answers the revision it produced |
| `delete_guidance` | `(notebook)` | Deletes the Guidance; the notebook keeps its folders, its templates and every note (RN-KNW-045) |
| `create_folder` | `(notebook, name, description, parent?, after?)` | Creates a folder; the description is required, because it is what says what belongs there. It goes last among its siblings, or right after `after` |
| `reorder_folder` | `(notebook, folder, after)` | Moves a folder among its siblings: first with `after: null`, or right after a sibling (RN-AGT-029) |
| `delete_folder` | `(notebook, folder, policy)` | Removes a folder under an explicit policy, `REJECT_IF_NOT_EMPTY` or `CASCADE` (RN-KNW-007); `CASCADE` takes the whole subtree, definitively and with no ceiling on its size (RN-KNW-046) |
| `get_template` | `(notebook, folder)` | The Template of the folder, to read before writing, with the revision to state when replacing it |
| `set_template` | `(notebook, folder, content, baseRevision)` | Writes the Template of the folder, with conflict detection (RN-KNW-034), and answers the revision it produced |
| `delete_template` | `(notebook, folder)` | Deletes the Template; the folder, its description and its notes stay (RN-KNW-045) |
| `list_notes` | `(notebook, folder?)` | The index of notes, in the defined order |
| `read_note` | `(notebook, note, asOf?)` | The full Markdown and the current revision; with `asOf`, the revision in force on that date |
| `create_note` | `(notebook, folder, content, after?)` | The ingestion path (§1.3). The name is the `name:` the content states, and a name its folder already holds is refused, naming the note that holds it (RN-AGT-024, RN-AGT-030). It goes last in its folder, or right after `after` |
| `update_note` | `(notebook, note, content, baseRevision)` | An update with conflict detection, and the only way to rename a note (RN-KNW-038) |
| `reorder_note` | `(notebook, note, after)` | Moves a note within its folder: first with `after: null`, or right after a note of the folder (RN-AGT-029) |
| `delete_note` | `(notebook, note)` | Deletes a note, definitively: no undo, no trash, and the content destroyed shortly after (RN-KNW-029, RN-KNW-047) |
| `search_notes` | `(notebook, query)` | Literal search over the text of the notebook, with fields and operators (§10.2) |
| `related_notes` | `(notebook, note, depth?)` | A dependency tree through the link graph |
| `backlinks` | `(notebook, note)` | Who points at this note |
| `note_history` | `(notebook, note)` | The timeline: who changed it, when, with which agent. A note that was deleted answers as not found, because what it pointed at was destroyed (RN-AUD-010) |

### 9.2 The Notebook Context

The output of `get_notebook_context` is **the product**, not a presentation detail: it is the exact equivalent of what the agent gets today by reading the guidance document and running `ls -R` on the local folder, in a single call.

```markdown
# Notebook: Normas e Legislação
<the full content of the Guidance>

## Reserved attributes
<the three names the specification reserves, and that the history of a note
answers who wrote it and when>

## Structure

81 notes · 4 of 200 folders

1. **Normas** `01J2Q4X8V6ZK9M3B7C5D1F0GHT`: Texto normativo por artigo. Uma norma por nota, sempre com órgão e vigência. (48 notes, has TEMPLATE.md)
2. **Achados** `01J2Q4X8V6ZK9M3B7C5D1F0GHV`: Achados de auditoria. Todo achado cita a norma que o fundamenta. (23 notes, has TEMPLATE.md)
3. **Trabalhos/** `01J2Q4X8V6ZK9M3B7C5D1F0GHW`: Relatórios emitidos. (5 notes)
   3.1. **2026** `01J2Q4X8V6ZK9M3B7C5D1F0GHX`: Emitidos neste exercício. (5 notes, has TEMPLATE.md)
```

The labels the product writes (`## Structure`, `notes`, `has TEMPLATE.md`) are en-US, like the whole MCP surface, which is a public contract and has `en_US` as its canonical locale (`CLAUDE.md` § Language policy). What appears in Portuguese in the example above is the content of the notebook, written by whoever authors it, and that is how it comes out in whatever language the notebook uses.

Six decisions are visible in that format:

- **The description of each folder comes along.** It is what directs where the agent writes, and that is why it is required (RN-KNW-006).
- **The order is the defined order**, numbered, because it is signal and not decoration (PP9).
- **The note count comes along.** The agent knows where the mass is before asking for any listing.
- **What the notebook holds is said once, before the tree** (RN-AGT-032): the notes, which are the sum of the counts beside each folder, and the folders against their ceiling of 200, which is the one that refuses and truncates. A design that multiplies folders is seen while it is still cheap to change, rather than learned from a refused write.
- **The identifier of each folder comes along** (RN-AGT-020). It is the argument every folder tool takes, and this document is where the agent gets it. The numbering is not an address: it is derived from the current position among siblings, so reordering a folder changes it, while the identifier is what stays.
- **The reserved vocabulary comes along** (RN-AGT-025), read from the Markdown specification. Without it an agent has no way to tell an attribute name that means the same thing in every notebook from one that belongs to this notebook alone, and the difference decides whether writing `etiquetas:` or `tags:` is a choice or a mistake. The section also says that who wrote a note and when is answered by its history, and not by a key of the frontmatter.

The identifier is **the one element the Notebook Context carries that `STRUCTURE.md` does not** (§12). Inside the system a folder is an opaque identifier and the tree is what names it; on the way out, the export is where names come into being, and a ULID printed next to a directory that already exists on disk addresses nothing the reader can call.

### 9.3 Writing by an agent

- **RN-AGT-001:** Every write over MCP records complete authorship: the human who owns the authorisation and the identity of the agent that executed it.
- **RN-AGT-002:** The server does not validate the content against the Template (PP3), but the tool description instructs the caller to fetch `get_template` before writing.
- **RN-AGT-003:** An error about a missing argument returns, along with the message, the information needed for the next attempt, the Template of the folder included when relevant (PP10).
- **RN-AGT-004:** *Removed in 0.6.0.* `create_note` answered `ALREADY_EXISTS` on a repeated slug. There is no slug and no key, so there is nothing to be repeated (RN-AGT-024).
- **RN-AGT-024:** **`create_note` takes the body of the note and no name.** The name is the `name:` of what was written (RN-KNW-035). A name its folder already holds is refused with `ALREADY_EXISTS`, answering the note that holds it, so a retry after a transport failure finds the note it made instead of writing a twin (RN-KNW-042); a new name is created. The tool still declares itself as **not** idempotent, because a note with no name reserves nothing and a retry of one writes a second.
- **RN-AGT-005:** `update_note` requires `baseRevision`. If the current revision diverges, the server answers `CONFLICT` **with the current content attached**, so the agent can decide between redoing and merging. Blind overwrite is not accepted in a notebook that sustains auditing.
- **RN-AGT-006:** A user with the `VIEWER` role is refused on `create_note` and `update_note`.
- **RN-AGT-007:** The connector always operates on the subscription fixed at consent (RN-SUB-014); no tool takes the subscription as an argument.
- **RN-AGT-008:** No MCP vocabulary enters the domain model: changing protocol does not change a business rule.
- **RN-AGT-025:** The Notebook Context declares the **reserved vocabulary**, read from the Markdown specification — `name`, `aliases` and `tags` — so a notebook reaching an agent says which attribute names are structural and which belong to that notebook alone. It teaches **no value** for who wrote a note or when, and says that the history of the note answers both, through `note_history`: the `Authorship` of the audit trail records every write with the person and the connector, nothing in the backend injects a key into a body, and a frontmatter `author:` or `created:` is an ordinary attribute of the notebook that writes it. Teaching `author` as the person who authorized the connection put the e-mail of the connected account into notes other people produced.
- **RN-AGT-022:** The notation the product reads is declared in the **MemorySmith Markdown Specification**, which lives in `docs/markdown-spec/` and is versioned with the product. The product derives the notation it reads and teaches from that data and never from a copy of it, and the skill cites no version of the specification apart from the product's. A specification and an implementation that keep separate transcriptions of the same list drift apart on the first cycle, and the drift is silent — which is the failure the specification exists to prevent one layer up, for the notebooks.
- **RN-AGT-023:** The declared notation covers **the reading surface** as well as the two sanctioned extractors, and every entry is proved by a conformance test of its own kind: the cases of `docs/markdown-spec/tests/conformance.json` run against the extractors, and each reading-surface entry runs through the real renderer. A rendering assertion cannot live in a data file — what a callout looks like is not something a suite can state — so the entries come from the specification and the expectation is written once, beside the components. A notation declared with nothing proving it fails the build. **What the rendering expectations are asked for is the notation the specification adds** to what a base parser already produces: asserting that emphasis renders as `<em>` is a claim about a library and not about this surface. Which forms those are is declared in the repository and asserted against the specification, because the tier the scope used to read is not something a specification owes an implementation. Where a restated form means something different here — a link inside a code span, an embed that looks like an image, a wikilink in a table cell — that **crossing** is proved on its own, and the skill teaches the whole table, the inherited forms included, because the crossings are what an agent gets wrong. It also teaches the rule that answers every form the table does **not** list — such a form may be drawn, never carries meaning, and never supports a conformance claim — because that is the one sentence that answers "I wrote something and got nothing" without a catalogue that can never be finished.
- **RN-AGT-021:** No text the product serves to an agent cites a business rule code. Not the answer of `whoami`, not the Notebook Context, not a skill, not the title or the description of a tool, and not an error message. The codes address a document of this repository, which whoever reads the MCP surface does not have, so a code there is a symbol that cannot be resolved: it is dropped as noise or mistaken for something addressable. Traceability between a rule and the code that fulfils it lives in comments and docblocks, and the sentence served to the agent has to stand on what it says.
- **RN-AGT-020:** The Notebook Context carries the identifier of every folder it renders. It is the argument every folder tool takes, and it has to be readable from the document the agent already reads before writing: a notebook describes itself to whoever arrives (PP1), and an agent addressing a folder it did not create itself is the ordinary case, not the exception. Returning the identifier only from `create_folder` bounds writing to the session that built the structure, which is the opposite of what the product promises.

### 9.4 Distribution of the connector

The connector is the product as seen by whoever arrives through an AI platform, and how it is found is part of the public contract as much as the signature of the tools. The curated directory mechanism and its criteria are in `knowledge-base.md` §3.7; the rules below say what MemorySmith does about it.

- **RN-AGT-009:** Every tool of the catalogue declares a readable title and a read-only or destructive hint. No tool enters the catalogue without both. The rule holds from the very first tool, and not from an eventual directory submission: those hints are what decide whether the client runs the call outright or asks the user first, so their absence charges friction to whoever uses the product, listed or not.
- **RN-AGT-014:** The connector writes the whole notebook, and not only its notes. Creating and deleting a notebook, writing the Guidance, creating, ordering and deleting a folder, writing the Template, and ordering and deleting a note exist as tools of their own, under the same role rules the interface obeys: the decision always belongs to the notebook, taken by the use case, and never to the protocol. The reason is the thesis of the product (§1.4): an agent that can only append notes to a structure somebody else assembled does not write knowledge, it merely deposits it.
- **RN-AGT-032:** The Notebook Context states **how many notes and folders the notebook holds**, before the tree: the notes as the sum of the counts it prints beside each folder, and the folders against their ceiling (RN-KNW-010). There is no ceiling of notes to state them against.
- **RN-AGT-030:** The refusal of a taken name an agent receives **names the note that holds it**, with its identifier, says that nothing was written, and says what to do next: read that note and change it with `update_note`, which is also the answer when the note is the one a retried call already made, or choose another name or another folder (PP10).
- **RN-AGT-029:** The connector **orders what it writes**. `create_folder` and `create_note` accept the sibling the new item goes right after, and without one it goes last; `reorder_folder` moves a folder among its siblings and `reorder_note` a note within its folder, first or right after a given sibling, and each answers the siblings in their new order. An anchor that is not a sibling is refused, with the siblings it could go after, and never guessed: an agent that named the wrong one would otherwise find its item somewhere nobody asked for, in silence. The order is what the Notebook Context numbers and what `list_notes` answers (PP9), which is why a folder name needs no number.
- **RN-AGT-015:** `read_note` returns the body as the author wrote it, with the literal `![[…]]`, and **never expands the embed**. An agent that wants the content of the target calls `read_note` on it, and is the one who decides whether it needs it. The same holds for the export: what comes out are the bytes that were written.
- **RN-AGT-016:** `set_guidance` and `set_template` take `baseRevision`, extending RN-AGT-005 to the two Content Slots that had been left out of it. `get_guidance` and `get_template` return the revision the agent has to state, and a missing argument is refused with a message saying what is missing, while an explicit `null` is accepted and checked like any other revision.
- **RN-AGT-017:** The product serves the agent, as a skill, the description of the notation it interprets inside the body of a note, including **the notation it deliberately does not read**. The content is derived from the declaration of the notation, and never written beside it: a skill teaching a notation the product stopped reading is worse than no skill, because it instructs the agent to write something that silently does nothing. The declaration is the same one Discovery checks against its two sanctioned extractors.
- **RN-AGT-018:** `whoami` indexes the available skills, one per task, and **the index is derived from the skill registry**, never written beside it. A skill that exists shows up, and one that does not exist cannot be announced, for the same reason RN-AGT-013 gives for the help itself: a hand-kept index diverges on the first renamed skill, and pointing at a skill that does not exist sends the agent down a path that fails.
- **RN-AGT-019:** `get_skill(name)` returns the text of the skill. A name that does not exist answers `NOT_FOUND` **with the list of the ones that do**, so the next attempt is informed instead of guessed (RN-AGT-003). The skill teaches the method and validates nothing: PP3 and PP4 hold without exception, and nothing starts being refused for not following what it advises.
- **RN-AGT-010:** Reading and writing never share a tool. There is no generic tool parameterised by operation. The catalogue of §9.1 is born that way, and the rule exists so that it stays that way as the surface grows.
- **RN-AGT-011:** OAuth client registration for the connector is done through a Client ID Metadata Document. The product does not offer dynamic client registration, and the authorization server metadata announces the two keys that CIMD selection requires (`knowledge-base.md` §3.4). The decision has two reasons: dynamic registration would create a new OAuth client on every connection, which is precisely the traffic pattern expected of a distributed connector, and the identity provider we use implements neither mechanism, which already forces us to broker the registration.
- **RN-AGT-013:** `whoami` answers two questions in the same call: **who** the connection represents (the person who authorised it, the connector and the subscription fixed at consent) and **how the product expects to be used** (the reading order: the Guidance, the folder structure with the description of each folder, and the Template of the destination folder). The help part is **derived from the catalogue itself**, never written beside it: a parallel text would diverge on the first renamed tool, and help that cites a tool that does not exist sends the agent down a path that fails. `whoami` also states that the server **does not validate** the content against the Guidance or the Template (PP4), because an agent that assumes validation trusts a check that never happens.
- **RN-AGT-026:** Outside production, the connector **declares the environment it serves and the exact version it runs**: the `serverInfo` of the handshake carries that version, the `instructions` returned at initialisation say which environment it is and that what is written there is disposable, and `whoami` opens with the same. An agent connected to staging is told so before it writes anything, because nothing in a notebook tells the two environments apart. In production neither the environment nor the warning appears, and the version is the released one; the instructions themselves are sent in every environment (RN-AGT-028).
- **RN-AGT-028:** In every environment, the `instructions` returned at initialisation tell the agent to call `whoami` before any other tool and **index the skills**, each with its task and the instruction to read it before the task, derived from the registry exactly as the index of `whoami` is (RN-AGT-018). Outside production the notice of RN-AGT-026 comes first. The instructions are the one text a client places before the model without a tool call, and a method is worth something only when it is read before its task: an agent that goes from the list of notebooks to the Notebook Context and to a write never calls `whoami`, and so never sees an index that lives only there. For the same reason, the description of a tool that starts a task a skill covers names that skill — `create_notebook` asks for `design-notebook`, and for the person to confirm the structure proposed, before it is called —, an account with no notebook tells the connector it can create one rather than sending it to somebody else, and `set_guidance` asks for the person's confirmation before a guidance that exists is replaced. All of it is what the agent is told: nothing starts being refused (PP3, PP4).
- **RN-AGT-012:** A directory listing is a product goal, not part of the initial scope. It presupposes an implemented tool catalogue, a published privacy policy, public documentation and a demo account with populated notebooks. Until there is a listing, the connector is added as a custom connector, and the product documentation has to tell the user which answers to give in the form.

---

## 10. Domain: Discovery

Three projections over the same facts, answering different questions. A conceptual comparison is in `knowledge-base.md` §5.6.

### 10.1 The link graph

Every link written in the body of a note becomes an edge. Two forms are recognised: `[[wikilink]]` and the relative Markdown link `[text](path.md)`.

**One resolution rule for both forms.** The target is reduced to the file name without extension, normalised, and resolved **within the scope of the notebook**.

- **RN-DSC-001:** *(revised in 0.6.0)* Path segments are discarded **in the Markdown form**: the edge is between notes, not between folders, and honouring the path would break the link the moment the note changed folder. A wikilink target is literal, so a slash inside one is an ordinary character of a name (RN-DSC-043).
- **RN-DSC-002:** An anchor (`#section`) is dropped in resolution and preserved in display.
- **RN-DSC-003:** A link with a scheme or a host (`https://…`) is external: it does not become an edge.
- **RN-DSC-004:** *(revised in 0.6.0)* A link whose target does not exist yet is not discarded: it becomes a **pending link** and resolves on its own when a note carrying **that name, or that alias**, is written. Without that, the graph would lie precisely while the notebook is being written, which is when it is consulted the most.
- **RN-DSC-005:** Deleting a note removes its edges and returns to the pending state the backlinks that pointed at it.
- **RN-DSC-006:** There are no links between notebooks (PP2). Moving a note to another notebook prunes its edges in the source notebook.
- **RN-DSC-007:** Graph traversal is limited to depth 3 and 200 nodes, with cycles deduplicated. Without a ceiling, a dense notebook returns the whole notebook and drowns the agent.
- **RN-DSC-036:** A link written **inside code is an example and not a reference**: a fenced block and a code span produce no edge, and the reading surface leaves the notation on the page as the characters somebody typed. The two have to agree, because a note teaching how to write a wikilink is the exact case where the page showed a link to the note it was describing. The **indented** code block is a declared exception: neither sanctioned reader implements it, because telling four spaces of code from four spaces of a nested list item needs the block context a parser has and these readers do not (PP4). Of the two ways to be wrong, a spurious pending link is cheap and a dropped edge is the graph lying about the notebook, so the cheaper mistake is the one that stays — declared here rather than discovered later.
- **RN-DSC-037:** The **three forms of a Markdown link produce the same edge**, because the destination decides it and never the syntax that carried it: the inline `[text](./note.md)`, the reference `[text][label]` and the collapsed or shortcut `[label]`, resolved against a definition written anywhere in the note. A label matches whatever its case and its internal spacing. A definition nobody used produces nothing, since it renders nothing where it stands. Reading only the inline form meant that a long note keeping its addresses at the bottom — which is how a long note stays readable — produced no edges at all, and did so silently.
- **RN-DSC-038:** An **image is not a link**, and produces no edge in any of its forms. The `!` in front is the whole difference between the two, and reading it as a link made a picture into a note: `![Curve](./curve.png)` announced a pending link called `curve-png`, a note somebody was apparently about to write. The **embed is untouched by this** and keeps producing exactly the edge a plain wikilink produces (RN-DSC-029), because `![[note]]` addresses a note and `![alt](file.png)` addresses a file.
- **RN-DSC-040:** Opening a note **fetches the image whose destination names a host**, and the product says so on the note that does it. An image reaching outside is a request made when the note is opened, by whoever opens it, and the trigger was written by whoever wrote the note — the same sentence RN-DSC-039 and the raw-HTML boundary already rest on. What travels with the request is the reader's address, their browser and the moment they read it. The specification admits three answers and forbids only silence: never fetching, fetching on the reader's action, or fetching and disclosing it. **This product gives the third**, because the first breaks a remote image in every notebook and the second needs a control the interface does not have, and because the third is the only one of the three a person cannot work out by looking. The disclosure names the hosts, appears on the notes that fetch and on no others, and reads as a footnote rather than a warning: nothing went wrong, somebody is being told something. An image written inside code fetches nothing and is not counted, and the alt text is never dropped, because it is what a person gets when an image does not load. *How* is not decided here: proxying, caching and a content policy remain open, and each would change the answer this rule discloses rather than the requirement to disclose it.
- **RN-DSC-039:** The reading surface **follows the web, a person, a note of the notebook and nothing else**: `http`, `https`, `mailto`, a path or a relative target, and the internal `pending:` of an unresolved wikilink. Every other scheme is left as text, keeping the words the author wrote and losing only the affordance, because a link that looks like one and goes nowhere is worse than plain text. The list says what passes and never what is refused, since a notebook is written by several people and by agents, and a list of what to block is a promise to have thought of everything. Two refusals are worth naming: a page carried inside its own address (`data:`), which is somebody else's script running in the reader's session, and **the scheme of a desktop editor (`obsidian://`), which is a decision and not an oversight** — it opens the notebook of whoever has that editor and that notebook on that machine, so it works for the author and does nothing for every other reader of the same note. The product serves a notebook to whoever reads it, and an address only its author can follow is not an address.

**Outputs:** a dependency tree from a note, backlinks, pending links and orphan notes.

> **In a regulated domain, the graph is the trail of grounding.** A finding note cites, in its body, the note of the norm that sustains it, and `related_notes` answers *"which normative basis does this finding rest on?"*. What makes that reliable is the Template of the folder, which instructs the writer to state the grounding as a link instead of citing it in prose. The backend does not know what a grounding is: it sees an edge, and it is the notebook that decides what it means (PP4).

### 10.2 Search

The search of the product is **literal over the text of the notebook**: the body of each note, its name, the folder and the headings. It answers "where is this word written", and it matches by substring, ignoring accents and case, so a term written only once inside a note is found by typing part of it.

The query accepts several terms, which all have to match, `"exact phrase"`, `-exclusion`, `OR`, parentheses, an interval over a date attribute (RN-DSC-034) and the fields `name:`, `folder:`, `content:` and `section:`. `name:` also answers on the `aliases` of the note (RN-DSC-032), and a `title:` prefix is an ordinary facet like any other. **Any other prefix is read as a frontmatter attribute of the notebook**, and that is what makes `maturity:evergreen`, `reviewed:false` or a `norma:federal` the notebook invented valid filters without any of it being written in the code. The vocabulary belongs to the Guidance (PP4, RN-DSC-020), and the ubiquitous language of the notebook becomes the query language.

What the search does **not** do is look for meaning. A note covering the subject in other words does not come back. That existed as `semantic_search`, backed by a vector index, and it was **withdrawn in 0.2.0**: scoring similarity inside the function required reading every chunk of the notebook on every query, and the item of a chunk cost ten times the size of the note. Whoever searches by subject relies on the link graph (§10.1) and the curation facets (§10.3) until the capability comes back over an adequate index.

- **RN-DSC-010:** The search always returns the source note along with the result, the heading the passage fell under when there is one, and the passage cut from the text as it was written. Whoever consumes it decides with the source in sight.
- **RN-DSC-011:** *(removed in 0.2.0)* Each chunk was enriched with the context it came from, that is the notebook, the folder, the folder description and the note title, before being vectorised.
- **RN-DSC-012:** Moving a note between folders triggers its reprojection, because the folder is part of the portrait the notebook shows of the note.
- **RN-DSC-013:** Deleting a note removes it from the projections immediately, and so does deleting anything above it: a note whose folder was removed or whose notebook was deleted leaves the search, the graph, the facets and the counts exactly as a note deleted on its own does (RN-KNW-046). What leaves the listing leaves the search, because deleted content that keeps being returned is a privacy problem, not a quality one.
- **RN-DSC-014:** *Removed in 0.6.0.* Restoring a note lost its object when deleting became definitive (RN-KNW-029).
- **RN-DSC-015:** *(removed in 0.2.0)* The vector index was isolated per subscription, not filtered by metadata inside a shared index. The requirement still holds for any index derived under RN-SUB-015, and it is what governs the content index that replaces it.
- **RN-DSC-016:** The graph, the search and the facets are derived (PP5): deleting and rebuilding them from zero out of the notes is a supported operation, and it is the recovery plan for all of them.
- **RN-DSC-025:** The search matches a **literal substring**, and not a whole word nor a stem. `14.133` is found by `14.133` and not by `14133`, because the separator was written by the author and inventing a normalisation of numbers would make the result impossible to explain. Accents and case, those are ignored on both sides.
- **RN-DSC-026:** The fields `name`, `folder`, `content` and `section` are the only ones the backend knows by name. Every other query prefix, `title:` included, is resolved as a facet of the notebook, and a prefix matching no facet simply does not match, and is never an error.
- **RN-DSC-027:** The search scans every note of the notebook on every query, and **records how many notes it read, how many bytes, the read units it consumed and how long it took**, one line per query in the logs of the environment. Nothing bounds a notebook but the storage of its subscription, so the cost of a search grows with the notebook, and that measurement is what shows when it becomes a real reason to change how the search is built. The scan has to walk the whole index: a search that answers from part of the notebook without saying it stopped is worse than no search.
- **RN-DSC-028:** The frontmatter does not take part in the searchable text. It is matter for the facet projector (RN-DSC-018), and keeping it in the body would make every note match its own metadata.
- **RN-DSC-029:** `![[target]]` is the embed form, and it produces **exactly the same edge** as `[[target]]`. The graph does not tell transclusion from reference apart, not even by counting: embedding a note and also linking to it is one single edge. An embed whose target does not exist yet follows RN-DSC-004 and becomes a pending link.

### 10.3 Curation facets

The curation panel (the Overview of the product) answers knowledge management questions: how much of the content is mature, how much has been through human review, how the notes spread across types, tags and creation dates. The answer comes from the third projection, the **facets**: aggregatable frontmatter attributes, extracted from each note the moment it changes and kept as counts per notebook. The set of attributes is not fixed: whoever defines the frontmatter of the notes is the Guidance of each notebook, and the projection discovers it by the shape of the values.

- **RN-DSC-017:** The curation panel is served by a derived projection, fed by note events. No screen and no tool scans notes to count; the one that counts is the projector, once, at the moment of the change.
- **RN-DSC-018:** The one that reads the frontmatter is the facet projector of Discovery, the second sanctioned reader of content next to the link extractor. The Knowledge core still does not read content (PP4), and no facet takes part in a rule, a validation or an authorisation: a facet guides curation, never behaviour.
- **RN-DSC-019:** `maturity` (`seed`, `growing`, `evergreen`) and `reviewed` (`true`, `false`) are the standard facets of the product, the only frontmatter vocabulary the product declares: `maturity` records the maturation stage of the content and is reassessed on every write; `reviewed` marks whether the current revision has been through human review, only a human writes it as `true` and any later content edit takes it back to `false`. To the projector they are not a special case, they are aggregatable attributes like any other; the standard exists so that the screens and the tools of the product can name them.
- **RN-DSC-020:** The remaining attributes are a convention of the notebook and are configured nowhere: the projection classifies each value by its **shape** and aggregates the aggregatable ones, that is dates, booleans, short enumerable values and lists of short values (such as `tags`). Free text is discarded. What `type: evidence` means belongs to the Guidance, never to the backend.
- **RN-DSC-021:** A note without a facet counts as a missing value; it is never rejected nor corrected. The projection describes the notebook as it is, and pointing out a gap is the job of the panel, not of the writer.
- **RN-DSC-022:** A deleted note leaves the counts the instant it is deleted, mirroring the search (RN-DSC-013).
- **RN-DSC-023:** The facet projection is derived (PP5): eventually consistent, deletable and rebuildable from zero out of the notes, like the graph and the search index (RN-DSC-016).
- **RN-DSC-035:** `^identifier` at the end of a block **names that block**, and `![[note#^identifier]]` embeds it rather than the whole note. The identifier is never rendered as text, and it names nothing outside its own note. The edge the embed produces is **exactly** the edge `[[note]]` produces (RN-DSC-029): the graph does not tell an embed from a reference apart, and it does not tell a block embed from either. An identifier that names nothing, and an embed of one that does not exist, are reported the way a pending link is and are never an error.
- **RN-DSC-034:** A facet of kind `date` accepts an **interval** in the query, in two forms with one meaning: the comparison `created:>=2026-01-01`, with the operators `>=`, `>`, `<=` and `<`, and the range `created:2026-01-01..2026-03-31`, which is sugar for `>=` and `<=` and has **both ends inclusive**. The comparison is the primitive because it composes with the boolean operators already there and needs no second syntax for an open interval; the range is kept because it covers the common case in one token, and defining it as sugar leaves one semantics to implement, to test and to explain. An operand keeps the prefix granularity of RN-DSC-031, so `created:<=2026-02` is the last instant of that month and a month is a legal end of an interval. Two things are refused rather than answered empty, because an empty result reads as "there is nothing filed under that" and neither of these means it: an interval over an attribute this notebook does not hold as a date, and a range whose ends are inverted. Relative and named dates are not part of this.
- **RN-DSC-033:** `#subject` written in the body of a note **is not read**. It becomes neither an edge nor a facet, it is stored and returned exactly as written, and the reading surface renders it as plain text — no chip, no colour, no click, because an affordance without the function it promises is worse than the raw text. Two lineages read the inline hashtag in incompatible ways, as a link and as metadata of the file, so there is nothing to inherit and any choice diverges from somebody: here the curation vocabulary lives in the frontmatter, where the Guidance governs it, and a subject worth marking in the middle of a sentence is worth a note of its own. Reading it would also require a third sanctioned reader of content and a real Markdown parser in the backend, against PP4 — `#` is a heading, a hex colour, `C#`, an issue number and a shell comment inside a fence, and in a survey of the 1,562 notes of the example notebooks one of the three inline matches was a colour. To group, write `tags:`; to connect, write `[[wikilink]]`.
- **RN-DSC-030:** The vocabulary the specification reserves — `name`, `aliases` and `tags` — is **always written in en-US**, and it is **read from the specification, never typed in this repository**: it is exactly the notations whose section is §6.4, so a change that reserves one more name reserves it here in the same commit. A name is reserved when the product decides something with it, or when every notebook needs the same one; who wrote a note and when is answered by its history, so `author`, `co-author`, `created` and `updated` are ordinary attributes. The interface may show the label of a reserved key translated and never the bytes: the note stores `tags`, the export writes `tags`, and the search answers `tags:contracts`, in a notebook kept in any language. Every other attribute keeps the name whoever wrote the note gave it, in the language they gave it. **Reserving is declaring, not enforcing**, and a reserved name is a guarantee rather than a prohibition: a reserved key whose value does not have the expected shape degrades to an ordinary attribute and is never an error, so `tags: contracts` written as a scalar is an enum, and a notebook that writes `etiquetas:` keeps it and keeps it indexed. What the reservation buys is the **name**, which is the one thing a notebook cannot invent for itself without leaving every other notebook behind. `name` is the exception in both directions: it is reserved, and it is never an attribute at all (RN-DSC-050).
- **RN-DSC-041:** A link resolves against the **name** of a note, compared case-exact after Unicode NFC and folded in no other way. A near miss is a pending link and never a landing: `[[Lei 14133]]` does not find `Lei 14.133`, and what used to make it find it also made `Ação` and `Acao` one note, and every name in a non-Latin script the same empty key.
- **RN-DSC-042:** **Every note whose name matches a target becomes an edge.** One link into two notes carrying one name is two edges — never the first one, because there is no order to appeal to — and the backlink on both is honest about it.
- **RN-DSC-043:** The three tolerances — discarding the path, dropping a trailing `.md`, percent-decoding — belong to the **Markdown form alone** and are applied in the order the specification fixes: split at the first unencoded `#`, then the path, then the extension, then decode. A **wikilink target is literal**: `[[Decisões/Índice]]` is a lookup for a name carrying a slash, and `[[Lei 14.133.md]]` for one carrying an extension.
- **RN-DSC-044:** A reference to an **attachment** renders and is never an edge: the graph is between notes, so it appears in no graph and generates no backlink. A name matching nothing in the notebook is reported the way a pending link is and is never an error.
- **RN-DSC-052:** **Only when no name matched** is a target compared against the `aliases` of the notebook, and every note carrying it as an alias becomes an edge — two of them are two edges. An alias fills an empty and never takes a target a name matched, which is the line that keeps the frontmatter out of the graph: the frontmatter may say what a note is called and may not redirect a link that has already found a note.
- **RN-DSC-053:** An edge that exists **by alias stops existing** when a note carrying that name is written, and the link goes to the note that owns the name. Resolution is therefore **not monotonic**: writing a note can destroy an edge in a third note nobody touched, so the link projection re-resolves what it holds by alias whenever a name appears, changes or is removed. Both ends of the change are legible, because a name is the `name:` at the top of a file.
- **RN-DSC-045:** The interface addresses a notebook, a folder and a note by **their identifiers and nothing else**: `/notebooks/:notebookId`, `/notebooks/:notebookId/folders/:folderId` and `/notebooks/:notebookId/notes/:noteId`. No name, slug, label or folder trail is part of an address, and a note is not nested under its folder. An identifier is written in lower case and read in either case. A segment that is not an identifier answers not-found without a request, and an address of an earlier form answers not-found rather than being redirected, because redirecting it would mean reading a name out of an address.
- **RN-DSC-055:** **The identifier is the whole address**, so nothing in it can be stale, wrong or absent, and nothing is corrected on load. A note with no name has an address like any other, because no name was ever part of one.
- **RN-DSC-046:** A wikilink target that does not resolve to exactly one note **offers the choice where the link is clicked**, in place, on every reading surface — the note, the folder, the Guidance and the Templates. The choice lists every note the target reaches, each written as its folder trail from the root and its name, which is unique once a folder holds one note of each name (RN-KNW-042), and says whether the target matched a name or an alias — because the two are not equally durable (RN-DSC-053). The link keeps a real address, `/notebooks/:notebookId/links/`, for an address that is pasted, bookmarked or opened in a new tab, and that page renders the same choice. It is notebook-wide, because resolution is.
- **RN-DSC-060:** A link whose target no name matches is **drawn as pending and can still be clicked**. The click asks what the target resolves to, because only Discovery knows the aliases: it opens the note when an alias answers one, offers the choice when an alias answers several, and says that no note carries the name yet when nothing answers.
- **RN-DSC-054:** The note page draws the **name** of the note in its frame, always, and every heading of the body is an ordinary heading, always. A note with no name says so in the frame, where the name would be.
- **RN-DSC-056:** A link target is percent-decoded, normalised to NFC and compared case-exact — the order §5.2 fixes for a link — so the URL and the wikilink cannot disagree about which note is which. A miss is a pending target and never a redirect that repairs it. The address of a note needs none of this: it is ASCII end to end and carries no name.
- **RN-DSC-057:** Renaming a notebook, a folder or a note, and moving a note to another folder, **changes no address**: an address copied before lands on what it was copied from. Only what was deleted stops answering, and an identifier is never reused, so an address never lands on something else.
- **RN-DSC-058:** The **title of the tab** names what the page shows, then the notebook that holds it, then the product: the name of the note, of the folder or of the link target, or the page of the notebook — Guidance, Templates, Root, the graph — and the notebook alone on its context. A note with no name is titled with the label every other surface gives it (RN-KNW-036). Since no address carries a name, the title is what tells two tabs, two entries of the history and two bookmarks apart.
- **RN-DSC-047:** The graph draws **one node per note and never one per name**. Two notes with one name are two nodes, both labelled with it, and the folder trail is what tells them apart — written beside the label of the node the pointer is on. A link into a repeated name is two edges leaving one note, and neither is more real than the other; an edge found by an alias is drawn like any other, because §5.4 makes no distinction between the two, not even by counting. Clicking a node opens that note directly and never the choice, because the graph already knows which note it drew.
- **RN-DSC-048:** A `|` in the alt text of an image separates the **description** from the **dimensions**: what precedes it is the description and is never dropped, what follows it is width, or width and height, in CSS pixels, and is never rendered as text. A value that is neither form stays part of the description, because deleting what an author wrote into an accessibility label is the worse of the two failures.
- **RN-DSC-049:** This product **stores no attachment**, so a reference to one is reported the way a pending link is and is never drawn as a link to a note nobody will ever write. The pipe is read by what the target is: a note takes the alias, an attachment takes the dimensions, and a target that resolves to neither takes the alias.
- **RN-DSC-050:** `name` **never becomes an attribute**. It is not indexed as one, is not filterable and produces no facet, whatever the shape of its value. A name is what a note *is*, not a category it belongs to. Leaving it to the cardinality ceiling of RN-DSC-024 would mean a small notebook showing a facet made of names, and a `name:` of the wrong shape surfacing as one, which is exactly the surprise the shape rule exists to prevent. **`title` is an ordinary attribute** of the notebook, classified by the shape of its value and subject to the cardinality ceiling like any other.
- **RN-DSC-051:** The reading surface draws the reserved attributes, `aliases` and `tags`, **first**, in the order the specification declares them, and then every other attribute — `author` and `created` included — under the key it was written with, in the order the note wrote them. That is the honest shape of the block: the first group is the same in every notebook of every language and is what the product can say something about, and the second belongs to the Guidance. Only a reserved key is **labelled** in the language of the interface; every other attribute keeps the name it was written with. `name` is drawn as the name of the note and never as a property, and `title` is an ordinary property.
- **RN-DSC-031:** A facet of kind `date` matches by **prefix** and never by substring: `created:2026`, `created:2026-09` and `created:2026-09-03` are the three granularities, and `created:09` matches nothing. Values are canonicalised to `YYYY-MM-DD`, so the prefix is exactly the granularity asked for, and substring made a fragment of the middle stand for a date — `09` meaning September and also the year 2009, which is not a question anybody asked. Every other kind keeps matching by substring.
- **RN-DSC-032:** *(revised in 0.6.0)* The entries of `aliases` join the search index as **alternative spellings of the note**, answering wherever the name does — under `name:` and under a bare term — and ranking as a name hit. A notebook of technical terms lives on acronyms, and requiring the full name in every search is what makes people stop finding things. **And they now resolve a wikilink that no name matched** (RN-DSC-052). The sentence that stood here said they did not, and it said it as a decision rather than a gap: an alias could move an edge invisibly, by editing a third note that is neither end of the link. That argument was not wrong, and it stops applying once an alias may only take what nothing holds.
- **RN-DSC-024:** An attribute that reveals itself as free text through use stops being aggregated: when the cardinality of distinct values of an attribute passes the per-notebook ceiling, its counts are discarded and it stops producing statistics. It is that mechanism, and not a hand-kept exclusion list, that keeps `source` from becoming a statistic. It is **not** what keeps `name` out, which is decided rather than discovered (RN-DSC-050).

---
## 11. Domain: Audit

The notebook sustains work in a regulated environment. That changes what "storing a note" means: besides the current content, the system answers **who wrote it, with which agent, when, and what the note said on the date the work was issued** (the grounding is in `knowledge-base.md` §7).

### 11.1 Entities

#### Value: `Authorship`

```
user_id,                     -- always a human: the owner of the authorisation
agent?: {                    -- absent = written through the UI
  client_id,
  client_name
},
at
```

The human is always identified, because even when the one writing is the agent, the authorisation belongs to whoever connected. It is that pair that turns *"written by X"* into *"written by that agent, on behalf of X, on 12 March"*: the difference between a record and a defensible record.

#### Entity: `AuditEvent`

```
subject (SUBSCRIPTION | MEMBER | NOTEBOOK | FOLDER | NOTE),
subject_id,
occurred_at,
type,                        -- the domain event that happened
authorship,
content_ref?,                -- the exact revision of the content at that instant
payload
```

### 11.2 Business rules

- **RN-AUD-001:** The audit trail is append-only. There is no path, of application, of operations or of administration, that alters or removes an event already recorded.
- **RN-AUD-002:** Every event records complete authorship (the human and, when there is one, the agent).
- **RN-AUD-003:** Every event that changes content carries the reference to the exact revision at that instant, and not merely the fact that a change happened.
- **RN-AUD-004:** The timeline of a note is indexed by the identifier of the note and survives it changing folder and notebook.
- **RN-AUD-005:** `read_note(asOf)` returns the content in force on the given date, reconstructed from the trail, which makes it possible to redo a piece of work reading the base as it stood on the date of issue.
- **RN-AUD-006:** *Removed in 0.6.0.* Deleting a note never destroyed the stored content and the history stayed readable. Deleting is definitive now: the content is destroyed and the history of a purged unit stops being readable (RN-KNW-029, RN-KNW-047, RN-AUD-010).
- **RN-AUD-010:** The trail records the **purge of each unit**, under the authorship of whoever deleted the unit above it, and keeps every earlier event of that unit. What the purge destroyed is named by the `ContentRef` its event carries, which from that moment points at content that no longer exists. Editing a note destroys nothing: its superseded revisions stay, and only the history of something somebody deleted stops being readable.
- **RN-AUD-007:** *(removed in 0.4.0)* It covered purging, the deliberate destruction of content, as an administrative act restricted to the `OWNER`, with a mandatory reason and an event of its own. The capability was never built, and what the product actually guarantees is still declared in RN-AUD-006. The number is preserved and will never be reused.
- **RN-AUD-008:** *(removed in 0.4.0)* It covered legal hold on the subscription, which would lock revisions against removal for the configured term. No path ever reached that activation, and what protects the revisions is the append-only trail of RN-AUD-001. The number is preserved and will never be reused.
- **RN-AUD-009:** *(removed in 0.4.0)* It stated that legal hold and purging were incompatible by design. With both capabilities removed, the rule lost its object. The number is preserved and will never be reused.

---

## 12. Domain: Portability

Zero lock-in is a requirement, not a courtesy: it is what makes the product safe to adopt in a context where the base has to outlive the vendor (`knowledge-base.md` §10).

**A notebook leaves as one document, and comes back as one.** It is a single JSON file, zipped, with the extension `.notebook`: the notebook, its Guidance, every folder with its parent, position, description and Template, and every note with its folder, its position, its dates and its body byte for byte.

```json
{
  "documentVersion": "1.0",
  "exportedAt": "2026-09-09T12:00:00.000Z",
  "notebook": { "name": "Normas e Legislação", "description": "…", "guidance": "# Propósito…" },
  "folders": [{ "folderId": "01J…", "parentFolderId": null, "name": "Normas", "description": "…", "position": "a0", "template": "# {{título}}…" }],
  "notes": [{ "noteId": "01J…", "folderId": "01J…", "position": "a0", "createdAt": "…", "updatedAt": "…", "body": "---\nname: Lei 14.133\n---\n\nArt. 75." }]
}
```

**It used to be a tree of `.md` files, and that was a one-way door.** Everything the product knows that a folder of files cannot hold was dropped at it: the identity of a note, its fractional position, the description of a folder, the Guidance, the Template, when each thing was written. Restoring a backup, moving a notebook between environments and seeding an account were none of them served — which is why the deploy script rebuilt a notebook by replaying API calls over a tree of files.

**The cost is real and it is stated rather than hidden.** RN-PRT-001 promised only `.md` files, readable with no parser, and that promise is spent: reading a note out of the archive now takes a JSON parser. What is kept is everything that made the promise worth making — the format is open, it is specified here, every body is Markdown in plain text and no part of the document is encoded, escaped beyond JSON or obfuscated. What is lost is unzipping the archive straight into a vault editor, and turning the document back into a tree of `.md` files is a conversion this product does not perform.

- **RN-PRT-009:** A notebook is exported as **one JSON document inside a zip whose extension is `.notebook`**. It carries the notebook, its Guidance, every folder with its parent, position, description and Template, and every note with its folder, its position, its dates and its body.
- **RN-PRT-010:** The document **stores nothing derived**. A note body is Markdown byte for byte, frontmatter included, and the name is read from it by RN-KNW-035 wherever it is needed. Two sources of truth for what a note is called is the defect this cycle exists to end.
- **RN-PRT-011:** The format is **open and fully specified**, every body is plain-text Markdown, and no part of the document is encoded or obfuscated beyond the zip. The document declares the version of its own shape, and no version of the Markdown specification, which has none apart from the version of the product that wrote it. Converting it back into a notebook of `.md` files is a conversion this product does not perform.
- **RN-PRT-001:** *Removed in 0.6.0.* The export contained only `.md` files and promised to be readable with no parser. Spent deliberately, for what a folder of files could not carry (RN-PRT-011).
- **RN-PRT-002:** *Removed in 0.6.0.* Order is a field of the document, so it is no longer encoded as a numeric prefix in a file name.
- **RN-PRT-003:** *Removed in 0.6.0.* The annotated tree is data in the document and is no longer materialised as `STRUCTURE.md`.
- **RN-PRT-005:** *Removed in 0.6.0.* There are no file names, so there are no reserved ones and nothing is renamed on the way out.
- **RN-PRT-004:** *(revised in 0.6.0)* A link comes out exactly as it was written, because the body is copied and never processed. Rewriting a destination was correct while a link addressed a file and is corruption now that it addresses a name, and this is a consequence of RN-PRT-010 rather than a rule of its own.
- **RN-PRT-006:** Deleted notes do not enter the export.
- **RN-PRT-012:** **An import always creates a new notebook** and never writes into an existing one. There is no merge, no conflict and no question of what wins: a failed import leaves a notebook somebody can delete, and importing the same document twice gives two notebooks rather than a mess in one. The name of the new notebook may be given on the call, because a subscription holds each notebook name once (RN-KNW-032) and a document often comes home to the subscription it left.
- **RN-PRT-013:** **Every identifier is minted at import.** The ones the document carries are internal references — this note sits in that folder — resolved while the notebook is written, and never restored as they were: a `NoteId` carries a timeline in the audit trail, and bringing an old one back would resurrect a history that did not happen.
- **RN-PRT-014:** An import is **refused whole** — for a file that is not an archive, for a document that does not match the format, for a version this build does not read, and for a size the plan does not allow — and the refusal happens before the first write. The file is uploaded to a short-lived address under the subscription and discarded once the import ends, whichever way it ended.
- **RN-PRT-015:** An import reports what it wrote: the notebook it created, how many folders and how many notes.
- **RN-PRT-007:** A notebook arriving with inline `#tags` is offered the conversion into the reserved `tags:`, **as a method the product teaches and never as an operation it performs**. The product serves the agent a skill: how to tell a tag from a heading, a hex colour, `C#`, an issue number and a URL fragment; to propose per note, in full, showing what would be written and what was rejected; to wait for a person to accept; to write one note at a time with `update_note` carrying its `baseRevision`, so each conversion is an ordinary authored write with its own revision in the history; and to leave the body untouched, because the inline tag is the author's bytes. It is a skill and not an endpoint for a structural reason: reading `#subject` for meaning would make the backend a third sanctioned reader of content, against PP4 and RN-DSC-033, and buying back the cost of a rejection by spending the guarantee that motivated it is not a trade this product makes. Nothing runs on import, nothing runs over a notebook unasked, and a false positive is cheap **only** because a person reads the proposal first.

---

## 13. Application interface

**The UI is the only human reading surface of the product.** That raises the bar for the note screen and the tree: they have to be comfortable to **read**, not merely to navigate.

### 13.1 Screens

**Entry**

| Screen | Content |
|---|---|
| Sign-in | Authentication through the identity provider, and the return from it. There is no open sign-up: the account is born by an act of platform operations (§4.4) |
| Sign-in with no active subscription | There is no waiting screen inside the product. A session whose subscription is absent, awaiting approval or blocked reaches nothing, so it is ended and the person goes back to the sign-in screen with the message of their case: an account with no subscription, a subscription awaiting authorisation, or an inactive subscription. The distinction is deliberate, because "there is nothing here" and "your access is suspended" are different facts |
| Subscription request | Outside the product at this stage. The route exists in the API, and whoever requests and approves is platform operations; the interface does not offer the form |

**Knowledge**

| Screen | Content |
|---|---|
| Notebook catalogue | Cards with the name, the description, the note count and the last update, and under them the panel of the subscription: the count of notebooks and notes, pending links, orphan notes, quota usage and the distribution of the content across the facets the notebooks declare (§10.3) |
| Notebook → Notebook Context | The notebook as the agent receives it in `get_notebook_context` (§9.2): the Guidance and the Templates as entry points and the folder tree with the description of each folder. Reading of the structure, with no reordering and no moving |
| Notebook → Guidance | Reading of the Guidance of the notebook, with the task list clickable for whoever may write, who may also delete it: the deletion asks in the page, saying what stays (RN-KNW-045) |
| Folder | Reading: the description of the folder, its Template and the notes in the declared order (PP9) |
| Folder → Template | Reading of the Template of the folder, with the task list clickable for whoever may write, who may also delete it. Two screens write the same Template, the folder and the page of Templates, and both offer the deletion the same way (RN-KNW-045) |
| Note | Reading: the frontmatter properties and the body in Markdown, with wikilinks navigable, the pending ones marked as such (RN-DSC-004), embeds expanded one level, and the task list clickable for whoever may write |
| Notebook → Graph | The link graph of the whole notebook, navigable, with the note opened from it |
| Notebook → Search | A single field over the text of the notebook, accepting fields and operators |
| Notebook → Export | Downloads the whole notebook as a tree of `.md` files, in the format of §12 |

**What the interface does not reach.** The governance of the subscription, that is members, roles, ownership, notebook ceilings and switching the active subscription, and the platform area of §4.6, exist in the API and have no screen. So do the audit and health reads, that is note history, notebook activity, and pending links and orphan notes as lists. Whoever needs them today calls the API or uses the operations scripts, and what is missing is recorded in the issues of the repository, which is where the future lives.

### 13.2 Interface rules

- A subscription outside `trial` or `active` ends the session and takes the user back to the sign-in screen with the message of their case, and never to an empty content screen. The message says which of the three cases it is, because the difference between "there is nothing here" and "your access is suspended" is the difference between an apparent bug and a piece of information.
- **The reading surface renders the whole MemorySmith ring the profile declares, and only it.** `==highlight==` is marked text; `%%comment%%` leaves the page and **stays in the bytes**, so a tool that returns the note returns it and an agent sees what a person on the page does not — an asymmetry declared here rather than discovered, because text somebody did not want on the page is still text they wrote; `^identifier` names its block and never shows; `$inline$` and `$$block$$` are mathematics, while a `$` followed by whitespace does not open one and a `$` preceded by whitespace does not close one, so two prices in a sentence stay two prices.
- **Raw HTML in a note is not rendered.** It is stored and returned exactly as written, and shown as text. This is a security boundary and not a rendering preference: a notebook is written by several people and by agents, and a page that renders arbitrary HTML out of one is a script injection whose trigger is written by whoever wrote the note. Superscript and subscript follow from it and have no notation here, which is a decision and not an omission: the GitHub form needs the HTML this rule forbids, and the Pandoc form renders in no vault editor.
- **A screen waiting for data shows the shape of what is coming, in the position it will occupy, and never a blank area or a bare line of text.** The frame of a screen is drawn as soon as it is known and is never withheld for a request: the notebook layout draws its sidebar, its brand, its search box and its navigation immediately and places a skeleton only where the query lands, so the frame does not move when the data arrives. A placeholder belongs to the wait alone — over a request that has already failed it is a page that looks alive and is dead — it carries `aria-busy` and keeps the word for whoever hears the page rather than only sees it, and its motion stops under `prefers-reduced-motion`.
- **The sign-in screen never asks for a click that decides nothing.** Every path that reaches it with no session to explain hands the browser to the identity provider, which owns the credentials; it stops and speaks only when it has something to say — an account that reaches nothing, a session that ended on its own, or a sign-in that came back empty. Signing out is not one of those: the person who left knows they left.
- A session that can no longer be renewed ends the same way (RN-SUB-022), and it is the same screen with a message of its own: the person did not ask to leave, so being returned to sign-in in the middle of reading owes an explanation. Signing out is never the only way out of a session that stopped working, and a screen waiting on a request that has already failed is not a wait: it says what failed.
- **Entering a notebook resumes where the reading stopped**, when this browser knows where that was, and shows the Notebook Context when it does not. It is a convenience of the browser and never a fact of the product: which note somebody read last is not sent to the server, not exported and not seen by anybody else, so it does not follow them to a second device. It fires on arrival and not on request — asking for the Notebook Context from inside the notebook is answered, or resuming would make the tree unreachable — and a remembered note that is no longer there is silently forgotten, never shown as an error.
- The reading surface of the note follows the metrics of the default theme of the desktop vault editors, because whoever reads the notebook on the web and in the editor it was written in should not have to relearn the page.
- No screen interprets a content convention. The frontmatter is presented as properties and the body is rendered as universal Markdown, which keeps the interface on the same side of PP4 as the backend.
- The reading surface **expands one level of transclusion, and only one**. A `![[target]]` found inside transcluded content is drawn as a link to the target, which makes a pair of notes that embed each other render without a loop. The transcluded block always says where it came from, with a link to the source note, because a passage pasted without provenance is indistinguishable from what the author wrote. There is a ceiling of expanded embeds per page, and what goes past it becomes a reference instead of disappearing.
- The **task list is clickable** where the effective role in the notebook allows writing, and stays disabled where it does not. Clicks in sequence within a short window become **one** write, so that ticking five items leaves one entry in the history and not five. A refused write returns the box to its previous state and **says which failure it was**, reloading the document when the reason is a conflict (PP10). Every write answers the revision it produced and the next one is based on that, so a conflict here means what it says: somebody else, or an agent, wrote in that note. One person alone can never produce it.
- **What the product says about a write is said in the frame of the screen, never inside the content it is about.** A grouped write is a property of the document and not of a box — five ticks are one transaction — so its status lives where it can be seen from any scroll position, and it says the whole life of the write and not only its failures: changed and not sent, being saved, saved. The success clears itself; a failure stays until the next attempt. It appears only when there is something to say, because the surface is a reading tool before it is an editing one. **And a write is never lost by leaving:** reloading, closing the tab or switching away while a change is still grouped sends it anyway.

---

## 14. Product limits

Declared so they become tests, and not folklore. The thesis is "without friction" (§1.4), and without a number that is not verifiable.

| | Limit |
|---|---|
| Note size | 1 MB |
| Folders per notebook | 200 |
| Notes per notebook | No ceiling; the storage quota of the subscription bounds it |
| Tree depth | 6 levels |
| Graph traversal depth | 3, with a ceiling of 200 nodes |
| Propagation of a role change | up to 5 minutes |

Performance targets are in `architecture-guide.md` §15.

---

## 15. Where version scope, risks and open questions live

This document describes what the product **does**, and not what it is going to do. Version
scope, delivery order, a risk not yet addressed and an undecided question describe the
future, and that is why they left this file:

| What you are looking for | Where it is |
|---|---|
| The scope accepted for a version | The milestone of that version |
| Product risks and questions not yet decided | Issues labelled `question` |
| What has been delivered, and when | `CHANGELOG.md` and the GitHub Releases |

The rule that motivates the separation, and the cycle that takes a need from an issue to
this document, are in `development-process.md`.
