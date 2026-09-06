# The MemorySmith Markdown Profile

**Version 0.2.0** · Draft · <https://md.memorysmith.app>

A profile of Markdown for knowledge vaults: plain `.md` files, linked to each other, written by people and by agents, and read by software that has to build a graph and an index out of them without deciding what the content means.

---

## 1. Scope

### 1.1 What this document is

This profile defines **which notation a conforming implementation reads, and what it does with it**. It is a profile, not a new syntax: every form specified here is taken from CommonMark, from GitHub Flavored Markdown, or from the vault editors that established it. Nothing is invented.

The profile covers three things and nothing else:

1. Which base specifications a conforming implementation supports.
2. Which vault notations it reads, and their **observable effect**.
3. Which notations it **deliberately does not read**, and what to write instead.

The third point is not an appendix. Most of what goes wrong when writing into a knowledge base is not a notation typed wrongly, it is a notation the author believed in: a link that was expected to become a connection, a line of metadata that was expected to become a category. A profile that only lists what works is half a profile.

### 1.2 What this document is not

It does not specify storage, transport, authentication, an API or a file layout. It does not specify how a vault is organised, what a note should contain, or which frontmatter attributes a given vault ought to use. Those belong to the vault, never to the format.

### 1.3 Requirement keywords

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### 1.4 Roles

An implementation may take any of three roles, and conformance is stated per role:

| Role | What it does | Conformance means |
|---|---|---|
| **Reader** | Renders a note for a person | It renders every notation of §5 as specified |
| **Indexer** | Derives links and attributes from a note | It extracts exactly what §3 and §4 specify, and nothing from anywhere else |
| **Writer** | Produces notes | It emits only notation this profile declares |

An implementation MUST state which roles it claims. An implementation that claims the Indexer role MUST NOT derive meaning from any part of a note other than the two readers defined in §3 and §4.

---

## 2. The three rings

| Ring | Specification | Status here |
|---|---|---|
| **Base** | [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) | Normative. An implementation MUST support it in full |
| **Extended** | [GFM 0.29-gfm](https://github.github.com/gfm/): tables, task list items, strikethrough, extended autolinks, disallowed raw HTML | Normative. An implementation MUST support it in full |
| **Vault** | This document, §3 to §6 | Normative |

The vault ring is where implementations of Markdown usually diverge in silence. Everything in it is specified here with a syntax, an example and an effect, and every entry has a machine-readable counterpart in [`profile.json`](profile.json) and at least one case in the [conformance suite](tests/).

---

## 3. Links

A **link** is a reference from one note to another note of the same vault. Links are what turn a folder of files into a graph, and they are the first of the two places an Indexer is allowed to read.

### 3.1 Forms

| Form | Syntax | Becomes an edge |
|---|---|---|
| Wikilink | `[[Target note]]` | Yes |
| Wikilink with alias | `[[Target note\|what the reader sees]]` | Yes |
| Wikilink with anchor | `[[Target note#Section]]` | Yes |
| Embed | `![[Target note]]`, `![[Target note#Section]]` | Yes |
| Relative Markdown link | `[what the reader sees](target-note.md)` | Yes |
| External link | `[text](https://example.org/page)` | **No** |

### 3.2 Resolution

An Indexer MUST resolve every form above by the following rule, and by no other:

1. If the target carries a **scheme** (`https:`, `mailto:`, any `[a-z][a-z0-9+.-]*:`) or begins with `//`, it is **external**. It MUST NOT become an edge.
2. The target is split at the first `#`. What precedes it is the path; what follows is the **anchor**.
3. Path segments MUST be discarded: the basename is taken. `../decisions/lei-14133.md` and `lei-14133` resolve to the same target. An edge is between notes, never between folders, and honouring the path would break the link the moment a note changed folder.
4. A trailing `.md` or `.mdx` extension MUST be removed.
5. The result is reduced to a **slug** by the rule in §3.3, and resolved **by slug, within the same vault**. Resolution MUST NOT cross vault boundaries.
6. The anchor MUST be preserved for display and MUST NOT take part in resolution. Two links to two sections of the same note are two links to the same note.

### 3.3 Slug

The slug is produced deterministically:

1. Normalise to Unicode NFD.
2. A `.` or `,` **between two digits** is removed, so `Lei 14.133` becomes `lei-14133` and not `lei-14-133`.
3. Remove combining marks (accents are folded, `ç` becomes `c`).
4. Lowercase.
5. Replace every run of characters that is neither `a-z` nor `0-9` with a single `-`.
6. Trim leading and trailing `-`, truncate to 80 characters, and trim any `-` the truncation left at the end.

The same title MUST always produce the same slug.

### 3.4 Deduplication

Several links to the same target in one note are **one** edge. An embed and a plain link to the same target are also one edge: the graph does not distinguish transclusion from reference, not even by counting.

### 3.5 A target that does not exist

A link whose target has no note is **not an error and MUST NOT be discarded**. It is a *pending link*: it is kept, it is reported as pending, and it resolves on its own if a note with that slug is later created. Discarding it would make the graph lie precisely while a vault is being written, which is when it is consulted most.

### 3.6 Code

A link inside a code span or a fenced code block is an example, not a reference. An Indexer MUST NOT extract it.

### 3.7 Embeds

`![[target]]` is the embed form. For an Indexer it is identical to `[[target]]` in every respect. For a Reader, see §5.3.

---

## 4. Frontmatter

Frontmatter is a block at the top of the file delimited by `---`, written in a YAML subset. It is part of neither CommonMark nor GFM; this profile specifies it because it is the **only** place a vault declares attributes about a note, and the second and last place an Indexer is allowed to read.

### 4.1 The block

The block MUST begin on the first line of the document with `---` and end at the next line consisting of `---`. Everything between the delimiters is frontmatter; everything after them is the body.

The frontmatter MUST NOT take part in the searchable text of the body. Keeping it there would make every note match its own metadata.

### 4.2 What an Indexer reads

An Indexer MUST support this subset of YAML and no more:

```yaml
---
key: value
list: [one, two]
block:
  - one
  - two
---
```

Scalars, inline lists and dash lists. One layer of matching quotes around a value is stripped. Nesting, anchors, multi-line scalars and typed tags are **not** part of this profile: an implementation MAY store them, and MUST NOT derive anything from them.

### 4.3 The shape of the value decides indexing

**No attribute name is special.** An Indexer MUST NOT hold a list of known keys, and MUST classify each attribute by the shape of its value:

| Shape | Kind | Indexed |
|---|---|---|
| `2026-09-03`, or an ISO 8601 date-time whose first 10 characters are a date | `date` | Yes, canonicalised to `YYYY-MM-DD` |
| `true`, `false`, `yes`, `no`, case-insensitive | `boolean` | Yes, canonicalised to `true` / `false` |
| A single value of at most 40 characters | `enum` | Yes |
| A list whose every value is at most 40 characters | `list` | Yes, each value on its own |
| A list written with one single item | `list` | Yes. The kind comes from the **form that was written**, never from how many items it happens to hold: an attribute MUST NOT change kind on the day a second value is added to it |
| Anything longer than 40 characters | — | **No.** Above that a value is prose, not a category |
| An empty value | — | No |

That is what lets the vocabulary belong to the vault: a vault that starts writing `norma: federal` gets `norma:federal` as a filter the same day, with no configuration anywhere.

An implementation SHOULD additionally stop indexing an attribute whose distinct values grow past a cardinality ceiling of its choosing, and MUST document the ceiling if it does. An attribute whose value is unique per note is prose that happens to be short, and it gives itself away through use rather than through a name.

### 4.4 The reserved vocabulary

The profile reserves **four** attribute names. They are always written in en-US; an implementation MAY translate the *label* it shows and MUST NOT translate the bytes in the file. Every other attribute keeps the name whoever wrote the note gave it, in whatever language they wrote it.

| Key | Shape | Effect |
|---|---|---|
| `aliases` | list of short values | Alternative spellings of this note. They MUST join the search index as spellings of the note. They MUST NOT resolve wikilinks (§3.2 resolves by title slug only) |

`aliases` join the search index and stop there, and the reason is worth stating so the
question does not return without new evidence. Resolution is **behaviour**: it decides an
edge, a backlink, a pending link and a navigation. Letting an attribute of the content
govern it would put the frontmatter in charge of the graph, which §1.4 keeps it out of. And
while a title collision cannot happen, an alias collision can — and it is created from
outside, by editing a third note that is neither end of the link, which would move an
existing edge with nothing on screen saying so. A link that does not resolve is at least
visible: it renders as pending (§3.5).
| `tags` | list of short values | Subjects of this note, filterable and countable like any other list attribute |
| `created` | ISO 8601 date | The date the author states the note was created. See §4.6 |
| `updated` | ISO 8601 date | The date the author states the content was last revised. See §4.6 |

A reserved key whose value does not have the expected shape **MUST NOT be an error**. It degrades to an ordinary attribute and is classified by §4.3 like any other. This profile never validates content.

### 4.5 `title` is not reserved

The title of a note is structural: it is what the note is called, and what §3 resolves against. A `title` key in the frontmatter is an ordinary attribute; it MUST NOT rename the note and MUST NOT take part in resolution. In practice it is prose that is unique per note, and the cardinality ceiling of §4.3 stops indexing it on its own.

### 4.6 Dates are the author's statement, not the file's history

`created` and `updated` are what the **author** says about the content. An implementation that also knows the real history of the file — a revision log, an audit trail, a version control system — MUST treat that history as authoritative for the file, and MUST NOT present a frontmatter date in its place. The two answer different questions, and showing one as the other produces a product that disagrees with itself in front of the reader.

### 4.7 Date granularity in a query

Dates are canonicalised to `YYYY-MM-DD`, which is ordered lexicographically. A query over a `date` attribute MUST match by **prefix**:

```
created:2026            the whole year
created:2026-09         the whole month
created:2026-09-03      the day
```

Prefix, not substring: `created:09` MUST NOT match `2026-09-03`.

### 4.8 Date intervals in a query

A point is not enough for the ordinary question of curation: what came in during the first
quarter, what has not been revised since March, what was written before a decision. A query
over a `date` attribute MUST support an interval, in two forms with **one** meaning:

```
created:>=2026-01-01 created:<2026-04-01     comparison, the primitive
created:2026-01-01..2026-03-31               range, sugar for two comparisons
```

The comparison operators are `>=`, `>`, `<=` and `<`. The range `a..b` MUST be equivalent to
`>=a` and `<=b`: **both ends inclusive**, which is what `..` means everywhere a person has
met it before. An exclusive end is written with a comparison, which is what comparisons are
for. Defining the range as sugar is deliberate: there is one semantics to implement, one to
test and one to explain.

An operand keeps the prefix granularity of §4.7. `created:>=2026-02` is the first instant
matching `2026-02` and `created:<=2026-02` is the last, so a month is a legal end of an
interval and not only a point. That falls out of lexicographic comparison over canonicalised
ISO 8601 rather than being a rule of its own, which is why ISO 8601 was chosen.

Two things MUST be errors rather than empty results, because an empty result reads as "there
is nothing" and both of these mean "you asked something that has no answer":

- a comparison or a range over an attribute that is not of kind `date`;
- a range whose ends are inverted.

Relative and named dates (`last-7-days` and friends) are **not** part of this profile.

---

## 5. The reading surface

A **Reader** renders a note for a person. Everything in this section is display: none of it produces an edge, an attribute or an index entry, and none of it changes the bytes of the note.

### 5.1 Callouts

```markdown
> [!warning] What can go wrong
> The body of the notice.
```

A blockquote whose first line begins with `[!type]` is a **callout**. The type is the word between `[!` and `]`, case-insensitive; the rest of that line, if any, is its title. A Reader MUST render it as a callout rather than as a quotation with a marker in front of it, and MUST NOT render the marker as text.

An optional `+` or `-` immediately after `]` marks the callout as foldable, expanded or collapsed respectively. A Reader MAY honour it.

The type vocabulary is open. The five types of GitHub alerts — `note`, `tip`, `important`, `warning`, `caution` — MUST be recognised; a Reader SHOULD render an unknown type as a generic callout rather than as plain text.

A `[!type]` inside a code fence is not a callout. A conforming Reader therefore has to recognise callouts on the parsed document, not on the raw string.

### 5.2 Diagrams

A fenced code block whose info string is `mermaid` is a diagram. A Reader SHOULD render it. A Reader that cannot MUST fall back to showing the source as a code block, never to hiding it.

### 5.3 Transclusion

`![[target]]` and `![[target#section]]` are embeds. A Reader SHOULD render the content of the target in place: the whole note for the plain form, the named section for the anchored form.

Expansion MUST be limited to **one level**: an embed found inside embedded content is rendered as a link to its target. Without that limit, two notes that embed each other hang the page.

A Reader SHOULD impose a ceiling on how many embeds one page expands, and MUST render the ones past the ceiling as links rather than dropping them.

An embed MUST NOT be expanded anywhere but on the reading surface. What an interface renders is display; what a tool returns is the note. A reader of the raw note gets the `![[...]]` that was written.

### 5.4 Wikilinks

A Reader MUST render a wikilink as a navigation to the resolved note, using the alias as the visible text when one is present. A wikilink whose target does not exist yet MUST be visibly distinguished from a resolved one, and MUST NOT be rendered as a broken link or hidden.

### 5.5 Marked text

`==highlight==` marks a run of text. A Reader SHOULD render it as marked and MUST NOT render
the `==` as characters. It carries no meaning beyond emphasis: no edge, no attribute, no
index entry.

### 5.6 Comments

`%%comment%%` is text the author does not want read on the page. A Reader MUST NOT render it,
inline or as a block.

**The bytes are untouched, and the asymmetry is the decision.** The comment stays in the
file: a tool that returns the note returns it, an export writes it, and a search MAY find
it. So an agent reading the note sees what a person reading the page does not. That is
deliberate — text the author does not want *on the page* is still text the author wrote, and
deleting bytes to make a page tidier is not something this profile asks of anyone — but it
MUST be declared to whoever writes one, or it is a surprise instead of a feature.

### 5.7 Block identifiers

```markdown
The rule is stated once, here. ^article-75

![[Lei 14.133#^article-75]]
```

A `^identifier` at the **end of a block** names that block. The identifier is `[A-Za-z0-9-]+`
and is unique within the note. A Reader MUST NOT render it as text.

`![[target#^identifier]]` embeds the named block rather than the whole note or a section.
Resolution of the *note* is unchanged (§3.2), and the edge it produces is **exactly the edge
`[[target]]` produces** (§3.7): the graph does not tell an embed from a reference apart, and
it does not tell a block embed from either.

A `^identifier` that names nothing, or an embed of an identifier that does not exist, MUST be
reported the way a pending link is (§3.5) and MUST NOT be an error.

### 5.8 Math

`$inline$` and `$$block$$` are mathematics. A Reader SHOULD render them, and one that cannot
MUST show the source rather than hide it.

A `$` that is not opening or closing a formula MUST NOT become one: a price, a shell variable
and a lone currency symbol are text. In practice a Reader MUST NOT treat `$` as an opening
delimiter when it is followed by whitespace, nor as a closing one when preceded by it.

### 5.9 Superscript and subscript: no notation

This profile has **no notation** for superscript or subscript, and the absence is a decision
rather than an omission.

There is nothing to inherit. GitHub writes `<sub>` and `<sup>`, which needs raw HTML, and
§5.10 declares raw HTML off. Pandoc writes `~x~` and `^x^`, which no vault editor renders —
a vault written with it would read correctly here and look broken in every other tool its
author uses, which is the opposite of what this profile is for. The `^` form would also
collide with §5.7.

### 5.10 Raw HTML

A Reader MUST NOT render raw HTML found in a note. It is stored and returned as written, and
displayed as text.

This is a **security boundary and not a rendering preference**, which is why it is stated
rather than left to each implementation. A vault is written by several people and by agents,
and a reading surface that renders arbitrary HTML out of it is a script injection whose
trigger is written by whoever wrote the note. CommonMark admits raw HTML; this profile does
not, and an implementation MUST NOT claim conformance while rendering it.

### 5.11 Task lists

GFM task list items MAY be interactive. A Reader that lets a person toggle one MUST write back exactly the one character that changed, and MUST NOT rewrite, reformat or re-serialise the rest of the note.

---

## 6. What the profile rejects

Each of these is written by somebody every day, in some tool, with an effect this profile deliberately does not give it. An implementation MUST NOT assign them the meaning described as absent, and SHOULD tell whoever writes one what to write instead.

### 6.1 The inline tag `#subject`

`#subject` written in the body of a note carries **no meaning** in this profile. It is neither an edge nor an attribute. It is stored and returned exactly as written, and a Reader MUST render it as plain text, with no label, no colour and no link.

Write `tags:` in the frontmatter to group notes by subject. Write `[[subject]]` to connect a note to a subject that deserves a note of its own.

Two established lineages read `#` in incompatible ways: as a link (Roam, Logseq) and as file metadata (Obsidian). There is no standard to inherit, so this profile chooses neither and says so. Its reason: the curation vocabulary belongs in the frontmatter, where the vault declares it, and reading the body for meaning would require a third reader of content, which §1.4 forbids.

### 6.2 An external link is not an edge

Anything with a scheme or a host refers to the world, not to the vault. Use external links freely as sources; do not expect a connection.

### 6.3 Prose in the frontmatter

A value longer than 40 characters is read and discarded (§4.3). A summary belongs in the body, where it is searchable, and not in an attribute that would become a category of one.

### 6.4 Anything not specified here

Notation absent from this document is **not part of the profile**. An implementation MAY
render it, MUST NOT claim conformance on account of it, and MUST NOT derive meaning from it.

Two things are absent **on purpose** and say so where they belong: superscript and subscript
(§5.9) and raw HTML (§5.10). Everything else is absent because nobody has written it down
yet, which is a different statement and a smaller one.

---

## 7. The machine-readable profile

[`profile.json`](profile.json) carries every notation of §3 to §6 as data: an identifier, the ring, which reader decides it, the syntax, a worked example, the observable effect, and whether it is recognised. It is validated by [`schema/profile.schema.json`](schema/profile.schema.json).

It exists so that a specification and an implementation cannot drift apart in prose. An implementation SHOULD build its own documentation, and anything it teaches an agent, from this file rather than from a copy of it.

## 8. The conformance suite

[`tests/conformance.json`](tests/conformance.json) is the executable half of this document: each case is a Markdown input and the links and attributes a conforming Indexer produces from it. Cases whose expectation is *nothing* are as important as the others.

An implementation claiming the Indexer role SHOULD run the suite in its own continuous integration. See [`tests/README.md`](tests/README.md) for the format.

## 9. Versioning

This profile carries a version of its own, independent of any implementation. It follows [Semantic Versioning](https://semver.org): a notation added is a minor version, a notation removed or an effect changed is a major version, and while the version is `0.x` a breaking change may arrive in a minor one.

Each released version is published at a stable URL under <https://md.memorysmith.app>, and the unversioned root always serves the latest.

## 10. Media type

A document written in this profile is `text/markdown`. When the variant is declared per [RFC 7763](https://www.rfc-editor.org/rfc/rfc7763.html) and [RFC 7764](https://datatracker.ietf.org/doc/rfc7764/):

```
Content-Type: text/markdown; charset=utf-8; variant=MemorySmith
```

The variant is not registered with IANA at this version.

---

## Appendix A. Implementations

| Implementation | Roles | Profile version | Known deviations |
|---|---|---|---|
| [MemorySmith.app](https://memorysmith.app) | Reader, Indexer, Writer | Tracking 0.1.0 | [1 open](https://github.com/memorysmithapp/memorysmithapp/issues/70) |

An implementation is listed here when it runs the conformance suite in public. Conformance is the suite passing, never a claim in a README.
