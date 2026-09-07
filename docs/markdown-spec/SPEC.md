# The MemorySmith Markdown Profile

**Version 0.3.0** · Draft · <https://md.memorysmith.app>

A profile of Markdown for knowledge vaults: plain `.md` files, linked to each other, written by people and by agents, and read by software that has to build a graph and an index out of them without deciding what the content means.

---

## 1. Scope

### 1.1 What this document is

This profile defines **which notation a conforming implementation reads, and what it does with it**. It is a profile, not a new syntax: every form specified here was taken from CommonMark, from GitHub Flavored Markdown, or from the vault editors that established it — chiefly Obsidian. Nothing is invented, and §2 names each source.

It is also **self-contained**. §3 and §4 state every block and every inline the profile accepts, with the form as it is typed and what it produces, so that writing a note, or implementing one, does not mean reading three specifications side by side with a finger in each. Where this document and the source a form was taken from disagree, the source governs (§2.1).

The profile covers four things and nothing else:

1. Which blocks and inlines it accepts, with the form as it is typed and what it produces (§3, §4).
2. Which MemorySmith notations it reads, and their **observable effect** (§5 to §7).
3. What happens to notation this document does not describe (§8).
4. How all of that is published as data, and proved (§9, §10).

The list is the profile. Most of what goes wrong when writing into a knowledge base is not a notation typed wrongly, it is a notation the author believed in — a link that was expected to become a connection, a line of metadata that was expected to become a category — and the answer to every one of them is the same: **if it is not described here, it is not read.** One rule, stated once, covers every form of every other dialect at once, which no list of refusals could ever do.

### 1.2 What this document is not

It does not specify storage, transport, authentication, an API or a file layout. It does not specify how a vault is organised, what a note should contain, or which frontmatter attributes a given vault ought to use. Those belong to the vault, never to the format.

### 1.3 Requirement keywords

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### 1.4 Roles

An implementation may take any of three roles, and conformance is stated per role:

| Role | What it does | Conformance means |
|---|---|---|
| **Reader** | Renders a note for a person | It renders every notation of §3, §4 and §7 as specified |
| **Indexer** | Derives links and attributes from a note | It extracts exactly what §5 and §6 specify, and nothing from anywhere else |
| **Writer** | Produces notes | It emits only notation this profile declares |

An implementation MUST state which roles it claims. An implementation that claims the Indexer role MUST NOT derive meaning from any part of a note other than the two readers defined in §5 and §6.

---

## 2. Reference sources

Nothing here is invented. Every form this profile declares was taken from somewhere, and the places it was taken from are named once here and cited again on each form that came from them.

| Source | What it established | Declared in |
|---|---|---|
| [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) | Blocks and inlines | §3 |
| [GFM 0.29-gfm](https://github.github.com/gfm/) | Tables, task list items, strikethrough, extended autolinks, disallowed raw HTML | §4 |
| [Obsidian](https://help.obsidian.md/syntax) | The wikilink and its alias, anchor, embed and block forms; callouts; marked text; comments; block identifiers | §5, §7 |

Obsidian is a source and not an authority. It publishes documentation rather than a versioned specification, so it carries no version above, and where it and this document differ **this document governs** — the opposite of the precedence CommonMark and GFM hold in §2.1. This profile is not *Obsidian compatible* and does not undertake to follow it; Obsidian is where a form was established and where its established meaning can be checked.

Two other lineages are named where the form they established is specified: the `---` frontmatter block, which is Jekyll's (§6), and the alert form of the callout, which is GitHub's (§7.1).

A source is where a form was established and where its parsing detail lives. It is not a tier this document is built out of, and an implementation is never asked to support a source *in full*: what it is asked to support is the notation this document lists.

### 2.1 What a source governs, and what it does not

Where this document and the source a form came from disagree on what a sequence of characters means, **the source governs and this document is in error**. That is a bug to report here, and never a licence to parse differently.

This document does not reproduce a source. It does not carry the flanking rules for emphasis, the seven kinds of HTML block or the tables of Unicode punctuation: it says what an author types and what comes out, and points at the source for the rest. An implementation is written against the source; a note is written against this.

What no source can give is the place where a form meets the rest of this profile, and that is what §3 and §4 add. A fenced code block is CommonMark, and that a `[[link]]` inside one produces no edge is §5.6. A block quote is CommonMark, and that one beginning `[!warning]` is a callout is §7.1. CommonMark admits raw HTML, and that a Reader here MUST NOT render it is §7.9 — a security boundary, and the one place this profile narrows a source rather than following it. Each crossing is stated where an author meets it, and again in the section that governs it.

From §5 onward no source stands above this document. That is where implementations of Markdown usually diverge in silence, and every form there is stated with a syntax, an example and an effect, with a machine-readable counterpart in [`profile.json`](profile.json) and at least one case in the [conformance suite](tests/).

---

## 3. Blocks and inlines

A note is a Markdown document. This section states every block and every inline the profile accepts, with the form as it is typed and what it produces. All of them were established by [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/), which is where their parsing detail lives (§2.1). An implementation MUST support every form listed here, and MUST NOT require an extension of its own to obtain any of it.

None of this notation produces an edge, an attribute or an index entry. It is structure and display. The two readers that derive meaning are §5 and §6, and they are the only ones.

A document is parsed in two passes: **block structure first**, then inline content inside the blocks it found. That order is not an implementation detail, it decides what a character means. A `[!warning]` inside a fenced code block is code because the fence was resolved first (§7.1), and a `[[wikilink]]` inside a code span is text for the same reason (§5.6).

### 3.1 Paragraphs and blank lines

Consecutive lines of text are one paragraph. One or more blank lines end it; a blank line is a line holding nothing but spaces or tabs.

```markdown
This is one paragraph,
written over two lines.

This is a second.
```

Up to three leading spaces on a line are ignored — four open an indented code block (§3.7). Trailing spaces are stripped, unless there are two or more of them, which is a hard line break (§3.17).

A paragraph is also the unit a block identifier names: `^article-75` at the end of one names that block, and that is §7.7.

### 3.2 Backslash escapes and character references

A backslash before any ASCII punctuation character makes that character literal.

```markdown
\*not emphasis\*   \[\[not a wikilink\]\]   \# not a heading
```

A backslash before anything else is a literal backslash. Escapes have no effect inside code spans, code blocks, autolinks or raw HTML — there is nothing to escape from.

Named and numeric character references are recognised wherever a literal character is: `&amp;`, `&copy;`, `&#35;`, `&#X1F600;`. Only the [HTML5 named references](https://html.spec.whatwg.org/multipage/named-characters.html) are valid; anything else stays as it was typed.

**A Writer escapes more here than in plain CommonMark**, because this profile gives meaning to characters CommonMark leaves alone: `[[`, `![[`, `==`, `%%`, `$` and a trailing `^`. Whatever is meant literally SHOULD be escaped or put in a code span. A notation invoked by accident is the failure this profile exists to prevent, and it is as easy to commit while writing prose as while writing a link.

### 3.3 Headings

Two forms, both normative and interchangeable at their levels. **ATX**: one to six `#`, a space, the text. A closing run of `#` is optional and discarded.

```markdown
# Level one
### Level three
##### Level five #####
```

**Setext**: a line of `=` (level one) or `-` (level two) directly under a paragraph.

```markdown
Level one
=========

Level two
---------
```

Headings are what an anchor points at: `[[Target note#Section]]` names a heading of the target, and §5.2 keeps it for display without letting it change which note is resolved.

A `#` that is not opening a heading is not a subject either: `#procurement` in the middle of a line is plain text, because nothing in this document describes it (§8).

### 3.4 Thematic breaks

Three or more `*`, `-` or `_` alone on a line, spaces between them allowed.

```markdown
---
***
___
```

`---` is context-dependent, and all three readings are correct in their place: on the **first line of the file** it opens frontmatter (§6.1), **directly under a paragraph** it is a level-two setext heading (§3.3), and **anywhere else** it is a thematic break.

### 3.5 Block quotes

`>` at the start of the line, with an optional space after it. A block quote holds any block, including other block quotes.

```markdown
> A quotation.
>
> > Nested.
```

A block quote whose first line begins with `[!type]` is a callout (§7.1). That is display and nothing else: to a parser that does not know the convention it stays an ordinary block quote, which is why it degrades gracefully everywhere else the file is opened.

### 3.6 Lists

A bullet item starts with `-`, `+` or `*`. An ordered item starts with a number of at most nine digits followed by `.` or `)`.

```markdown
- one
- two
  - nested, indented to the content column of its parent

1. first
2. second

7) a list that starts at seven
```

The number of the first item sets where the list starts; the numbers of the rest are ignored, so a list written entirely with `1.` numbers itself correctly. Changing the marker character starts a new list.

A list is **tight** when no blank line separates its items and **loose** when one does; a loose list wraps each item in a paragraph, which is the whole of why blank lines between items change the spacing. Continuation content of an item is indented to the column where that item's text began.

An item whose text begins with `[ ]` or `[x]` is a task list item, which is GFM and is §4.2.

### 3.7 Code blocks

**Fenced**, with three or more backticks or tildes, closed by a fence of at least the same length and the same character:

````markdown
```sql
select 1;
```
````

The word after the opening fence is the **info string**, and by convention it names the language. `mermaid` is the one info string this profile attaches a rendering rule to (§7.2). A tilde fence may carry backticks in its info string; a backtick fence may not.

**Indented**, with four spaces or one tab:

```markdown
    an indented code block
```

Nothing inside a code block is parsed: no emphasis, no links, no wikilinks, no callouts, no frontmatter. That is what lets this document write its own notation down without invoking any of it, and §5.6 makes it binding on an Indexer.

### 3.8 Link reference definitions

A definition binds a label to a destination, and is not rendered where it stands.

```markdown
[the act]: https://example.org/lei-14133 "Optional title"

The rule is in [the act], and stated again in [the act][].
```

Labels match case-insensitively and collapse internal whitespace. The definition MUST be in the same document as the reference; a reference with no definition renders as literal text, brackets and all.

### 3.9 HTML blocks

A line that begins with `<` and a recognised tag opens an HTML block, whose content CommonMark does not parse as Markdown.

```markdown
<div class="note">
  Raw, and *not* emphasised.
</div>
```

**The block structure is CommonMark's; what a Reader does with the result is not.** §7.9 declares raw HTML unrendered, as a security boundary, and it is the one place this profile narrows its base instead of extending it. The bytes are kept and returned as written; an Indexer derives nothing from them; a Writer SHOULD NOT emit them.

### 3.10 Inlines, and what binds tighter than what

Inside every block that holds text, inline notation is resolved in a fixed order. Code spans, autolinks and raw HTML bind tighter than emphasis; emphasis binds tighter than the text of a link; and a link MUST NOT contain another link.

```markdown
*emphasis holding `a * code span` inside it*
```

The `*` inside the code span is a literal asterisk: the span was resolved before emphasis was considered. Every "why did that not work" in Markdown is this rule, and every MemorySmith notation obeys it too.

### 3.11 Code spans

One or more backticks, closed by a run of exactly the same length.

```markdown
`code`   ``a span containing a ` backtick``
```

One leading and one trailing space are stripped when both are present and the content is not all spaces, which is how a span can begin or end with a backtick. A code span is where an author writes notation without invoking it — `[[Lei 14.133]]` in a span is an example of a link and not a link — and §5.6 makes that binding on an Indexer.

### 3.12 Emphasis and strong emphasis

```markdown
*emphasis*   _emphasis_   **strong**   __strong__   ***both***
```

`_` does not open or close emphasis inside a word, so `snake_case_name` is one word. `*` does, so `un*frigging*believable` works. The full flanking rules are CommonMark's; the working rule for a Writer is to use `*` and `**` and never the underscores.

Marked text, `==highlight==`, is not emphasis and not CommonMark. It is §7.5.

### 3.13 Links

Inline, with an optional title:

```markdown
[the text](https://example.org/page)
[the text](https://example.org/page "a title")
[the text](</a destination with spaces>)
```

Reference, in three forms — full `[text][label]`, collapsed `[label][]`, shortcut `[label]` — resolved against a definition (§3.8).

A destination may be bare, in which case its parentheses must balance, or wrapped in `<>`, in which case they need not. A title goes in `"`, `'` or `()`.

Whether a link becomes an edge is decided in §5.2, by the destination and by nothing else. The text of a link never takes part in resolution.

### 3.14 Images

An image is a link with `!` in front of it.

```markdown
![alt text](image.png "a title")
```

The alt text is the description of the image and a Reader MUST NOT drop it. A `!` in front of a **wikilink** is a different thing entirely: `![[target]]` is the embed of §5.7.

### 3.15 Autolinks

An absolute URI or an email address between angle brackets.

```markdown
<https://example.org/page>   <someone@example.org>
```

GFM extends this to bare URLs and addresses written without brackets (§4.4). Neither form is ever an edge (§5.2).

### 3.16 Raw inline HTML

An HTML tag written inline is a tag to CommonMark: `<abbr title="Recovery Time Objective">RTO</abbr>`. Everything in §3.9 applies to it, §7.9 included — a Reader shows it as text.

### 3.17 Line breaks

A line ending inside a paragraph is a **soft break**, which a Reader may render as a space or as a newline. Two or more trailing spaces, or a trailing backslash, is a **hard break** and MUST be rendered as a line break.

```markdown
first line\
second line
```

A Writer SHOULD use the backslash. Trailing spaces do not survive an editor that trims them, and a line break that disappears on save is worse than one that was never written.

### 3.18 Tabs

A tab advances to the next multiple of four columns wherever indentation is being measured, and is never expanded inside content. A Writer SHOULD indent with spaces: the same file indented with tabs nests differently in editors that disagree about tab width.

---

## 4. Tables, task lists and further inlines

Five more forms, established by [GFM 0.29-gfm](https://github.github.com/gfm/), which is where their parsing detail lives (§2.1). An implementation MUST support all five.

### 4.1 Tables

A header row, a delimiter row, and zero or more body rows. Colons in the delimiter row set the alignment of a column: left, centre, right.

```markdown
| Key | Shape | Indexed |
|---|:---:|---:|
| `tags` | list | yes |
| `created` | date | yes |
```

The header row fixes the number of columns: a body row with fewer cells is padded, one with more is truncated. A cell holds inlines and never blocks — no lists, no fenced code, no paragraphs — and a literal pipe inside a cell is written `\|`. The table ends at the first blank line, or at the first line that is not a row.

A table is display. A wikilink written inside a cell is a link like any other (§5): a cell is a place text lives, not a boundary an Indexer stops at. The pipe is the one character to watch, because it is also what separates a wikilink from its alias: inside a cell, `[[Target|alias]]` has to be written `[[Target\|alias]]`, or the cell ends where the alias begins.

### 4.2 Task list items

A list item whose text begins with `[ ]` or `[x]` — case-insensitive — followed by a space is a task list item.

```markdown
- [ ] Read the act
- [x] Summarise article 75
```

The brackets MUST be the first thing in the item. In every other respect it is an ordinary list item, and §7.10 governs what a Reader may do when it lets somebody toggle one.

### 4.3 Strikethrough

One or two tildes around the text: `~struck~`, `~~struck~~`. Three or more strike nothing.

### 4.4 Autolinks, extended

GFM recognises a link with no angle brackets around it: `www.example.org`, `http://example.org`, `https://example.org/page`, and a bare email address.

Trailing punctuation is left out of the link, so a URL at the end of a sentence does not swallow the full stop, and a closing parenthesis is included only when the parentheses balance.

Bracketed or bare, an autolink is external and never an edge (§5.2).

### 4.5 Disallowed raw HTML

GFM neutralises nine tags — `<title>`, `<textarea>`, `<style>`, `<xmp>`, `<iframe>`, `<noembed>`, `<noframes>`, `<script>`, `<plaintext>` — by escaping the opening `<`, so that they appear as text instead of taking effect.

In this profile the question does not arise, because §7.9 renders no raw HTML at all. The GFM rule is stated here for completeness and because it marks the distance: that list is a compatibility floor for a platform that does render HTML, and this profile does not need a list of exceptions to a thing it does not do.

---

## 5. Links between notes

A **link** is a reference from one note to another note of the same vault. Links are what turn a folder of files into a graph, and they are the first of the two places an Indexer is allowed to read.

This is where §3.13 stops being about rendering. A link is one of the forms below, and what decides whether it becomes an edge is its **destination** — never its text, never the syntax it was written in, and never where in the note it appears.

The `[[…]]` form is older than any vault editor and was established for vaults by Obsidian (§2), along with the alias, anchor, embed and block forms below. What is specified here is not its syntax but its **resolution**, which is where implementations diverge.

### 5.1 Forms

| Form | Syntax | Becomes an edge |
|---|---|---|
| Wikilink | `[[Target note]]` | Yes |
| Wikilink with alias | `[[Target note\|what the reader sees]]` | Yes |
| Wikilink with anchor | `[[Target note#Section]]` | Yes |
| Embed | `![[Target note]]`, `![[Target note#Section]]` | Yes |
| Relative Markdown link | `[what the reader sees](target-note.md)` | Yes |
| External link | `[text](https://example.org/page)` | **No** |

### 5.2 Resolution

An Indexer MUST resolve every form above by the following rule, and by no other:

1. If the target carries a **scheme** (`https:`, `mailto:`, any `[a-z][a-z0-9+.-]*:`) or begins with `//`, it is **external**. It refers to the world and not to the vault: it renders as a link, it MUST NOT become an edge, and it MUST NOT be resolved against any note. Use external links freely as sources; a connection is not one of the things they make.
2. The target is split at the first `#`. What precedes it is the path; what follows is the **anchor**.
3. Path segments MUST be discarded: the basename is taken. `../decisions/lei-14133.md` and `lei-14133` resolve to the same target. An edge is between notes, never between folders, and honouring the path would break the link the moment a note changed folder.
4. A trailing `.md` or `.mdx` extension MUST be removed.
5. The result is reduced to a **slug** by the rule in §5.3, and resolved **by slug, within the same vault**. Resolution MUST NOT cross vault boundaries.
6. The anchor MUST be preserved for display and MUST NOT take part in resolution. Two links to two sections of the same note are two links to the same note.

### 5.3 Slug

The slug is produced deterministically:

1. Normalise to Unicode NFD.
2. A `.` or `,` **between two digits** is removed, so `Lei 14.133` becomes `lei-14133` and not `lei-14-133`.
3. Remove combining marks (accents are folded, `ç` becomes `c`).
4. Lowercase.
5. Replace every run of characters that is neither `a-z` nor `0-9` with a single `-`.
6. Trim leading and trailing `-`, truncate to 80 characters, and trim any `-` the truncation left at the end.

The same title MUST always produce the same slug.

### 5.4 Deduplication

Several links to the same target in one note are **one** edge. An embed and a plain link to the same target are also one edge: the graph does not distinguish transclusion from reference, not even by counting.

### 5.5 A target that does not exist

A link whose target has no note is **not an error and MUST NOT be discarded**. It is a *pending link*: it is kept, it is reported as pending, and it resolves on its own if a note with that slug is later created. Discarding it would make the graph lie precisely while a vault is being written, which is when it is consulted most.

### 5.6 Code

A link inside a code span or a fenced code block is an example, not a reference. An Indexer MUST NOT extract it.

### 5.7 Embeds

`![[target]]` is the embed form. For an Indexer it is identical to `[[target]]` in every respect. For a Reader, see §7.3.

---

## 6. Frontmatter

Frontmatter is a block at the top of the file delimited by `---`, written in a YAML subset. The form is Jekyll's, adopted since by every vault editor. It is part of neither CommonMark nor GFM; this profile specifies it because it is the **only** place a vault declares attributes about a note, and the second and last place an Indexer is allowed to read.

### 6.1 The block

The block MUST begin on the first line of the document with `---` and end at the next line consisting of `---`. Everything between the delimiters is frontmatter; everything after them is the body.

The frontmatter MUST NOT take part in the searchable text of the body. Keeping it there would make every note match its own metadata.

### 6.2 What an Indexer reads

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

### 6.3 The shape of the value decides indexing

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

The 40-character ceiling is where an attribute stops being a category. A summary written into the frontmatter is read and discarded, and it belongs in the body, where it is searchable, rather than in an attribute that would become a category of one.

An implementation SHOULD additionally stop indexing an attribute whose distinct values grow past a cardinality ceiling of its choosing, and MUST document the ceiling if it does. An attribute whose value is unique per note is prose that happens to be short, and it gives itself away through use rather than through a name.

### 6.4 The reserved vocabulary

The profile reserves **four** attribute names. They are always written in en-US; an implementation MAY translate the *label* it shows and MUST NOT translate the bytes in the file. Every other attribute keeps the name whoever wrote the note gave it, in whatever language they wrote it.

| Key | Shape | Effect |
|---|---|---|
| `aliases` | list of short values | Alternative spellings of this note. They MUST join the search index as spellings of the note. They MUST NOT resolve wikilinks (§5.2 resolves by title slug only) |

`aliases` join the search index and stop there, and the reason is worth stating so the
question does not return without new evidence. Resolution is **behaviour**: it decides an
edge, a backlink, a pending link and a navigation. Letting an attribute of the content
govern it would put the frontmatter in charge of the graph, which §1.4 keeps it out of. And
while a title collision cannot happen, an alias collision can — and it is created from
outside, by editing a third note that is neither end of the link, which would move an
existing edge with nothing on screen saying so. A link that does not resolve is at least
visible: it renders as pending (§5.5).
| `tags` | list of short values | Subjects of this note, filterable and countable like any other list attribute |
| `created` | ISO 8601 date | The date the author states the note was created. See §6.6 |
| `updated` | ISO 8601 date | The date the author states the content was last revised. See §6.6 |

A reserved key whose value does not have the expected shape **MUST NOT be an error**. It degrades to an ordinary attribute and is classified by §6.3 like any other. This profile never validates content.

### 6.5 `title` is not reserved

The title of a note is structural: it is what the note is called, and what §5 resolves against. A `title` key in the frontmatter is an ordinary attribute; it MUST NOT rename the note and MUST NOT take part in resolution. In practice it is prose that is unique per note, and the cardinality ceiling of §6.3 stops indexing it on its own.

### 6.6 Dates are the author's statement, not the file's history

`created` and `updated` are what the **author** says about the content. An implementation that also knows the real history of the file — a revision log, an audit trail, a version control system — MUST treat that history as authoritative for the file, and MUST NOT present a frontmatter date in its place. The two answer different questions, and showing one as the other produces a product that disagrees with itself in front of the reader.

### 6.7 Date granularity in a query

Dates are canonicalised to `YYYY-MM-DD`, which is ordered lexicographically. A query over a `date` attribute MUST match by **prefix**:

```
created:2026            the whole year
created:2026-09         the whole month
created:2026-09-03      the day
```

Prefix, not substring: `created:09` MUST NOT match `2026-09-03`.

### 6.8 Date intervals in a query

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

An operand keeps the prefix granularity of §6.7. `created:>=2026-02` is the first instant
matching `2026-02` and `created:<=2026-02` is the last, so a month is a legal end of an
interval and not only a point. That falls out of lexicographic comparison over canonicalised
ISO 8601 rather than being a rule of its own, which is why ISO 8601 was chosen.

Two things MUST be errors rather than empty results, because an empty result reads as "there
is nothing" and both of these mean "you asked something that has no answer":

- a comparison or a range over an attribute that is not of kind `date`;
- a range whose ends are inverted.

Relative and named dates (`last-7-days` and friends) are **not** part of this profile.

---

## 7. The reading surface

A **Reader** renders a note for a person. Everything in this section is display: none of it produces an edge, an attribute or an index entry, and none of it changes the bytes of the note.

Every form here is built out of the blocks and inlines of §3 and §4, and stays legible as ordinary Markdown in an editor that does not know the convention: a callout is a block quote, a diagram is a fenced block, an embed is an image whose target happens to be a note. That is deliberate. A note is a plain file first, and a profile that made its files unreadable elsewhere would have taken more than it gave.

Callouts, marked text, comments and block identifiers were established by Obsidian, and math and diagrams by the wider convention both it and GitHub follow (§2). None of them is invented here; what is specified is the effect each one has. §7.9 is the one place the profile narrows a source rather than following it, and it says why.

### 7.1 Callouts

```markdown
> [!warning] What can go wrong
> The body of the notice.
```

A blockquote whose first line begins with `[!type]` is a **callout**. The type is the word between `[!` and `]`, case-insensitive; the rest of that line, if any, is its title. A Reader MUST render it as a callout rather than as a quotation with a marker in front of it, and MUST NOT render the marker as text.

An optional `+` or `-` immediately after `]` marks the callout as foldable, expanded or collapsed respectively. A Reader MAY honour it.

This form has two lineages that arrived at the same characters: GitHub's alerts, which admit five fixed types, and Obsidian's callouts, which admit any word and a title. This profile follows the second, which is the more general — so a note written for either renders here.

The type vocabulary is open. The five types of GitHub alerts — `note`, `tip`, `important`, `warning`, `caution` — MUST be recognised; a Reader SHOULD render an unknown type as a generic callout rather than as plain text.

A `[!type]` inside a code fence is not a callout. A conforming Reader therefore has to recognise callouts on the parsed document, not on the raw string.

### 7.2 Diagrams

A fenced code block whose info string is `mermaid` is a diagram. A Reader SHOULD render it. A Reader that cannot MUST fall back to showing the source as a code block, never to hiding it.

### 7.3 Transclusion

`![[target]]` and `![[target#section]]` are embeds. A Reader SHOULD render the content of the target in place: the whole note for the plain form, the named section for the anchored form.

Expansion MUST be limited to **one level**: an embed found inside embedded content is rendered as a link to its target. Without that limit, two notes that embed each other hang the page.

A Reader SHOULD impose a ceiling on how many embeds one page expands, and MUST render the ones past the ceiling as links rather than dropping them.

An embed MUST NOT be expanded anywhere but on the reading surface. What an interface renders is display; what a tool returns is the note. A reader of the raw note gets the `![[...]]` that was written.

### 7.4 Wikilinks

A Reader MUST render a wikilink as a navigation to the resolved note, using the alias as the visible text when one is present. A wikilink whose target does not exist yet MUST be visibly distinguished from a resolved one, and MUST NOT be rendered as a broken link or hidden.

### 7.5 Marked text

`==highlight==` marks a run of text. A Reader SHOULD render it as marked and MUST NOT render
the `==` as characters. It carries no meaning beyond emphasis: no edge, no attribute, no
index entry.

### 7.6 Comments

`%%comment%%` is text the author does not want read on the page. A Reader MUST NOT render it,
inline or as a block.

**The bytes are untouched, and the asymmetry is the decision.** The comment stays in the
file: a tool that returns the note returns it, an export writes it, and a search MAY find
it. So an agent reading the note sees what a person reading the page does not. That is
deliberate — text the author does not want *on the page* is still text the author wrote, and
deleting bytes to make a page tidier is not something this profile asks of anyone — but it
MUST be declared to whoever writes one, or it is a surprise instead of a feature.

### 7.7 Block identifiers

```markdown
The rule is stated once, here. ^article-75

![[Lei 14.133#^article-75]]
```

A `^identifier` at the **end of a block** names that block. The identifier is `[A-Za-z0-9-]+`
and is unique within the note. A Reader MUST NOT render it as text.

`![[target#^identifier]]` embeds the named block rather than the whole note or a section.
Resolution of the *note* is unchanged (§5.2), and the edge it produces is **exactly the edge
`[[target]]` produces** (§5.7): the graph does not tell an embed from a reference apart, and
it does not tell a block embed from either.

A `^identifier` that names nothing, or an embed of an identifier that does not exist, MUST be
reported the way a pending link is (§5.5) and MUST NOT be an error.

### 7.8 Math

`$inline$` and `$$block$$` are mathematics. A Reader SHOULD render them, and one that cannot
MUST show the source rather than hide it.

A `$` that is not opening or closing a formula MUST NOT become one: a price, a shell variable
and a lone currency symbol are text. In practice a Reader MUST NOT treat `$` as an opening
delimiter when it is followed by whitespace, nor as a closing one when preceded by it.

### 7.9 Raw HTML

A Reader MUST NOT render raw HTML found in a note. It is stored and returned as written, and
displayed as text.

This is a **security boundary and not a rendering preference**, which is why it is stated
rather than left to each implementation. A vault is written by several people and by agents,
and a reading surface that renders arbitrary HTML out of it is a script injection whose
trigger is written by whoever wrote the note. CommonMark admits raw HTML; this profile does
not, and an implementation MUST NOT claim conformance while rendering it.

### 7.10 Task lists

GFM task list items MAY be interactive. A Reader that lets a person toggle one MUST write back exactly the one character that changed, and MUST NOT rewrite, reformat or re-serialise the rest of the note.

---

## 8. Notation not described here

§3 to §7 are the whole of the notation this profile accepts. **Anything not described
there is not part of the profile**, with three consequences that are easy to run together
and mean different things:

- An implementation **MAY render it** however it likes. This document not describing a
  form is not this document forbidding it, and rendering is where an implementation is
  free.
- An implementation **MUST NOT derive meaning from it**: no edge, no attribute, no index
  entry. §1.4 gives an Indexer two readers of content and no others.
- An implementation **MUST NOT claim conformance on account of it**. Conformance is the
  suite passing, and a form outside the suite is outside the claim.

That is the whole rule, and it is deliberately the only one of its kind. A list of the
forms this profile declines would need an entry for every form of every other dialect, it
would grow with each one that ships, and it could never be finished — so it would be
sampled rather than maintained, which is worse than not having it. One rule, stated once,
is complete on the day it is written.

An author who wrote something and got nothing is in the right section. The answer is that
the form is not in §3 to §7, and what to write instead is whatever §3 to §7 does
describe: `tags:` in the frontmatter to group notes by subject, `[[subject]]` to connect a
note to one that deserves a note of its own.

---

## 9. The machine-readable profile

[`profile.json`](profile.json) carries every notation of §3 to §7 as data: an identifier, which reader decides it, the syntax, a worked example and the observable effect. It is validated by [`schema/profile.schema.json`](schema/profile.schema.json).

It exists so that a specification and an implementation cannot drift apart in prose. An implementation SHOULD build its own documentation, and anything it teaches an agent, from this file rather than from a copy of it.

## 10. The conformance suite

[`tests/conformance.json`](tests/conformance.json) is the executable half of this document: each case is a Markdown input and the links and attributes a conforming Indexer produces from it. A case whose expectation is *nothing* — a link inside a code fence, an external destination — is as normative as any other.

An implementation claiming the Indexer role SHOULD run the suite in its own continuous integration. See [`tests/README.md`](tests/README.md) for the format.

The forms of §3 and §4 carry no cases here, and need none: CommonMark and GFM each ship a suite of their own, and an implementation demonstrates those forms by passing it. What this suite covers is the part nobody else tests, which is the same reason §5 to §7 exist.

## 11. Versioning

This profile carries a version of its own, independent of any implementation. It follows [Semantic Versioning](https://semver.org): a notation added is a minor version, a notation removed or an effect changed is a major version, and while the version is `0.x` a breaking change may arrive in a minor one.

Each released version is published at a stable URL under <https://md.memorysmith.app>, and the unversioned root always serves the latest.

## 12. Media type

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

## Appendix B. Notation at a glance

Every form this document declares, in one table. The last column is the section that governs it; the third says what it does **beyond being rendered**, which for most of §3 is nothing at all.

| Notation | Written | Beyond rendering | § |
|---|---|---|---|
| Paragraph | text, blank line, text | Names a block when it ends in `^id` | 3.1 |
| Backslash escape | `\*literal\*` | The way to write this profile's own notation as text | 3.2 |
| Character reference | `&amp;`, `&#35;` | — | 3.2 |
| ATX heading | `## Title` | Anchor target of a wikilink | 3.3 |
| Setext heading | `Title` over `===` | Anchor target of a wikilink | 3.3 |
| Thematic break | `---`, `***`, `___` | On line 1, opens frontmatter instead | 3.4 |
| Block quote | `> text` | A callout when it opens with `[!type]` | 3.5 |
| Bullet list | `- item` | — | 3.6 |
| Ordered list | `1. item` | — | 3.6 |
| Fenced code block | ` ```lang ` | Suppresses every notation inside | 3.7 |
| Indented code block | four spaces | Suppresses every notation inside | 3.7 |
| Link reference definition | `[label]: /url` | — | 3.8 |
| HTML block | `<div>…</div>` | Kept in the bytes, shown as text | 3.9, 7.10 |
| Code span | `` `code` `` | Suppresses every notation inside | 3.11 |
| Emphasis, strong | `*a*`, `**a**` | — | 3.12 |
| Inline link | `[text](url)` | An edge when the target is internal | 3.13, 5.2 |
| Reference link | `[text][label]` | An edge when the target is internal | 3.13, 5.2 |
| Image | `![alt](image.png)` | — | 3.14 |
| Autolink | `<https://example.org>` | Never an edge | 3.15, 5.2 |
| Raw inline HTML | `<abbr>…</abbr>` | Kept in the bytes, shown as text | 3.16, 7.10 |
| Hard line break | trailing `\` | — | 3.17 |
| Table | `\| a \| b \|` | Cells hold links like any other text | 4.1 |
| Task list item | `- [ ]`, `- [x]` | A toggle writes back one character | 4.2, 7.10 |
| Strikethrough | `~~struck~~` | — | 4.3 |
| Extended autolink | `www.example.org` | Never an edge | 4.4, 5.2 |
| Disallowed raw HTML | `<script>` | Moot here: no raw HTML is rendered | 4.5, 7.10 |
| Wikilink | `[[Target note]]` | An edge, a backlink, pending when unresolved | 5.1 |
| Wikilink with alias | `[[Target\|text]]` | The same edge; the alias is display | 5.1 |
| Wikilink with anchor | `[[Target#Section]]` | The same edge; the anchor is display | 5.2 |
| Embed | `![[Target note]]` | The same edge, plus transclusion | 5.7, 7.3 |
| Relative Markdown link | `[text](target.md)` | An edge, by basename and slug | 5.2 |
| Frontmatter block | `---` on line 1 | The only source of attributes | 6.1 |
| Short value | `key: value` | An `enum` attribute | 6.3 |
| List value | `key: [a, b]` | A `list` attribute, each value on its own | 6.3 |
| Boolean value | `key: true` | A `boolean` attribute | 6.3 |
| Date value | `key: 2026-09-03` | A `date` attribute, queried by prefix and interval | 6.3, 6.7, 6.8 |
| Reserved keys | `aliases`, `tags`, `created`, `updated` | Search spellings, subjects, the author's dates | 6.4 |
| Callout | `> [!warning] Title` | Drawn as a callout, not as a quotation | 7.1 |
| Mermaid diagram | ` ```mermaid ` | Drawn as a diagram, or shown as source | 7.2 |
| Marked text | `==highlight==` | Nothing beyond emphasis | 7.5 |
| Comment | `%%comment%%` | Off the page, kept in the bytes | 7.6 |
| Block identifier | `^article-75` | Names a block; not rendered | 7.7 |
| Block embed | `![[note#^id]]` | The same edge as a plain wikilink | 7.7 |
| Math | `$x$`, `$$x$$` | Drawn as mathematics, or shown as source | 7.8 |
| External link | `[text](https://…)` | Renders as a link; never an edge | 5.2 |
| Prose in frontmatter | over 40 characters | Read and discarded | 6.3 |
| `title:` | in the frontmatter | Indexed as an ordinary attribute | 6.5 |
| Raw HTML | `<div>`, `<abbr>` | Shown as text, never rendered. A security boundary | 7.9 |
