/**
 * The skill registry: method, not operation.
 *
 * The product rests on a premise, that a notebook carries its own instructions
 * and an agent that reads them writes like the owner would. There is exactly
 * one task where the premise cannot hold: CREATING the notebook, because the
 * guidance is what is being produced. That is where the only quality lever the
 * product has is absent, and it is where it would pay off most.
 *
 * What is missing there is not an operation. `create_notebook`, `set_guidance`,
 * `create_folder` and `set_template` already exist and are enough. What is
 * missing is METHOD: the practices a good notebook is built with — short notes,
 * folders that say what they hold, properties and tags, maps of content,
 * templates, the formatting that fits the material — in what order, and when
 * to stop proposing and start writing.
 *
 * The index of these skills is served by `whoami` and DERIVED FROM THIS
 * REGISTRY, never written beside it (RN-AGT-018): a hand-kept list drifts on
 * the first rename, and an index pointing at a skill nobody wrote sends the
 * agent down a path that fails. It is the same discipline RN-AGT-013 imposes
 * on the help itself.
 */

import {
  DECLARED_SILENCE,
  MARKDOWN_SPEC_NAME,
  MARKDOWN_SPEC_SOURCES,
  MARKDOWN_SPEC_URL,
  RECOGNISED_NOTATION,
  type RecognisedNotation,
} from '@memorysmith/contracts';

export interface Skill {
  /** Stable identifier, and the argument `get_skill` takes. */
  readonly name: string;
  /** The task, phrased as the agent would want it, not as a feature. */
  readonly task: string;
  /** The method, in Markdown, served verbatim. */
  readonly body: string;
}

/**
 * When a notebook reaches for each form the reading surface draws, written by
 * hand and keyed by the identifier of the entry in the specification.
 *
 * The forms themselves are never listed here: the table the skill serves takes
 * their syntax from the specification (RN-AGT-022). What a person writes by hand
 * is only when a notebook uses a form, and a test holds this map and the set
 * below against the specification, so a form the specification adds or removes
 * fails the build instead of going stale in the skill (RN-AGT-017).
 */
export const FORMATTING_USES: Readonly<Record<string, string>> = {
  'heading-atx':
    'The sections of a note, in the order they are read. A template shows them, and a link points at one',
  'list-ordered': 'Steps that happen in order',
  'list-bullet': 'Items with no order among them',
  'task-list': 'What is still to be done, which a person can tick on the page',
  table: 'A comparison, or the same few fields across several items',
  callout: 'A rule, a warning or a decision a reader must not miss',
  'block-quote': 'A passage quoted from a source, word for word',
  mermaid: 'A flow, a sequence or how the parts of something relate, drawn instead of described',
  'math-inline': 'A formula inside a sentence',
  'math-block': 'A formula on a line of its own',
  transclusion: 'A passage kept in one note and shown where it is needed, instead of copied',
  'block-id': 'A paragraph other notes embed on its own',
  highlight: 'The few words of a passage that matter most',
  strikethrough: 'What stopped holding, kept in sight because the change matters',
  comment:
    'A remark for whoever writes next that the page does not show; an agent reading the note still sees it',
  'code-fenced':
    'A command, a query or a configuration, with its language named so it is highlighted',
  'code-span': 'An identifier, a file name, a value to type, or notation written as an example',
  'link-inline': 'A source outside the notebook, cited where it is used',
  footnote: 'A source a text of prose cites without breaking the sentence, listed at the end',
  image: 'A figure the text refers to, with a description of what it shows',
  'image-dimensions': 'A figure that has to fit: its width, or its width and height',
};

/**
 * The forms the reading surface draws that this skill leaves to `write-notes`:
 * the ordinary grammar of Markdown, and the forms a notebook is not designed
 * around — raw HTML is shown as text, this product stores no attachment, and a
 * pending link is how a link looks while its note is not written yet.
 */
export const FORMATTING_LEFT_TO_WRITE_NOTES: ReadonlySet<string> = new Set([
  'paragraph',
  'backslash-escape',
  'character-reference',
  'heading-setext',
  'thematic-break',
  'code-indented',
  'link-reference-definition',
  'emphasis',
  'strong',
  'strong-emphasis',
  'link-reference',
  'autolink',
  'hard-line-break',
  'autolink-extended',
  'raw-html',
  'attachment',
  'pending-link-display',
]);

/** A code span that holds any text, backticks included, inside a table cell. */
function cellCode(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const padded = text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text;
  return `${fence}${padded}${fence}`.replace(/\|/g, '\\|');
}

/** The formatting a notebook is designed with, its syntax read from the specification. */
function formattingTable(): string {
  const syntaxOf = new Map(RECOGNISED_NOTATION.map((entry) => [entry.id, entry.syntax]));
  return [
    '| Use it for | Write |',
    '| --- | --- |',
    ...Object.entries(FORMATTING_USES).map(
      ([id, use]) => `| ${use} | ${cellCode(syntaxOf.get(id) ?? id)} |`,
    ),
  ].join('\n');
}

const DESIGN_NOTEBOOK = `# Designing a notebook

A notebook is a guidance, a tree of folders that each say what they hold, a
template for each folder that receives notes, and the notes themselves. This
skill is how to build one that the next agent writes in correctly and a person
can read and curate.

**Start from what the notebook is for.** Material the person already has — a
note they keep, a document, the record of a piece of work — shapes a notebook
best, so use it when it is in the conversation. When there is none, propose a
small structure from what they said they need, built with the practices below,
and confirm it before creating anything. One proposal the person can accept or
adjust is worth more than a questionnaire.

## The order of the work

1. **What the notebook is, and what it leaves out.** A paragraph each. The
   second saves work later: a notebook that never says what it excludes
   accumulates everything.
2. **The kinds of note, and the folders that hold them.**
3. **The properties and tags** that classify the notes.
4. **The maps of content** that gather a context.
5. **A template for every folder that receives notes.**
6. **Create it, in this order:** the notebook, its guidance, and the folders
   that receive notes now, in reading order, each with its template and one real
   note that follows it. A subfolder the structure names is created when its
   first note arrives.
7. **Read it back** with \`get_notebook_context\`, as the next agent will.

## The guidance

The guidance is what the next agent reads before writing. Write it for that
reader, and state each convention once.

- **Open with the paragraph that says what the notebook is.** The Notebook
  Context prints the name of the notebook as a heading right above it.
- **Say what belongs, and where the rest goes.**
- **Name the vocabulary.** If the owner says "finding" and not "issue", write it
  down: the words of the notebook become the words of its search.
- **State the naming convention** of its notes — what a name looks like here —
  with one good example and one bad one.
- **Declare every property** with the values it accepts, and say where the maps
  of content live.
- **Keep to the conventions of this notebook.** How the product reads a note is
  explained in \`write-notes\`; the guidance says what this notebook chose.

## Short notes, one concept each

- **One idea per note.** A note that answers two questions is two notes, linked
  to each other. A short note is what a link can point at precisely, and what an
  agent can read without filling its context with everything around it.
- **Name each note** in \`name:\`, by the convention of the guidance, and put its
  other spellings and translations in \`aliases\`.
- **A name says what the note holds; the folder says what kind of note it is.**
  \`note-name.ts reads only the name key\` in a folder of code evidence reads
  well in every link. \`Code: note-name.ts · reads only the name key\` repeats the
  folder in every link that cites it, and reading a note already answers which
  folder it lives in.
- **Number the records that multiply** — evidence, findings, minutes,
  decisions — instead of describing them in the name. \`next_number\` issues the
  next number of a folder, once and never again, so agents writing at the same
  time never collide; the guidance states the form, such as \`EV-00042\`, and a
  link carries the description in its text: \`[[EV-00042|reads only the name key]]\`.
  A number never has a reason to change, and a descriptive name does: renaming a
  note leaves every link to its old name pending.
- **Weigh a kind of note that multiplies before choosing it**, such as one note
  per excerpt of a source. Every such note is one more to read, list and keep
  in the maps; when the source has an address of its own, a link to it where it
  is used carries the same evidence, and \`write-notes\` says when a source is a
  link and when it earns a note.
- **Link whenever a note mentions another concept**, with \`[[Name]]\`. A link to
  a note not written yet is a pending link, and a notebook being built carries
  them on purpose: they are the list of what is still to write.
- **Embed instead of copying.** \`![[Name]]\` shows a note, or one of its
  sections, where it is needed, and the text stays in one place.

## Folders and subfolders

- **One folder per kind of material or per context**, and a subfolder when a
  folder holds more than one kind, or a context that splits on its own — by
  year, by client, by stage.
- **Every folder has a description in three parts:** the question its notes
  answer, the content they typically carry, and where what looks like it
  belongs goes instead. "Norms" is a name. This is a description: "Which rule
  applies, and since when? One note per norm, with the text of the version in
  force, its article and its dates. A reading of how a rule was applied goes to
  Findings." Up to 500 characters. Agents that never talked to each other write
  alike in a folder described this way, because each one answers the same
  question with the same material.
- **Create a subfolder when its first note arrives.** The structure you propose
  may name more; what you create is what will be filled. An empty subfolder,
  template and all, reads as a notebook that broke off, not as one being built.
- **The order of folders is content**, and it is kept as data: the Notebook
  Context numbers the folders by it, so a folder name needs no number. Create the
  folders in reading order, or place one with \`after\`, and change the order
  later with \`reorder_folder\`. Notes are ordered the same way, with
  \`reorder_note\`.
- **A folder is where a note lives, and not part of what identifies it**:
  moving a note keeps every link to it.
- **The limits:** six levels deep and 200 folders in a notebook. There is no
  limit of notes: what bounds a notebook is the storage of its subscription.

## Properties and tags

The frontmatter is where a note is classified, and every key in it becomes a
filter of the search, \`key:value\`, and a count on the curation panel.

- **Declare what someone will filter or count.** An explanation, a source or a
  path is prose, and prose belongs in the body, where the search reads it: the
  search reads the body, and a frontmatter value longer than forty characters is
  not indexed.
- **Put the subjects of a note in \`tags\`**, as a list: \`tags: [contracts, procurement]\`.
- **Write a list in brackets even when it holds one value.** The written form
  decides what an attribute is, and one key written both ways becomes two
  attributes that never add up.
- **Give the notebook a state property**, such as \`status\` with the values the
  guidance declares, so that "what is still a draft" has an answer.
- **Write dates as \`2026-09-14\`**: a date is searched by year, month or day, and
  by interval.
- **\`name\`, \`aliases\` and \`tags\` mean the same thing in every notebook**, and
  every other key belongs to this one. Who wrote a note and when is kept by its
  history, so a key for it earns its place when the note states something the
  history cannot know, like the author of a work it cites.
- **Classify in the frontmatter rather than with \`#subject\` in the text**, which
  the product keeps as plain text. A notebook that arrives with inline tags has a
  skill of its own, \`convert-inline-tags\`.

## Maps of content

A map of content (MoC) is a note whose body is the map of a context: its links,
one line each, in the order they are best read, with a sentence on what each one
holds.

- **Decide where the maps live, and write it in the guidance:** the first note of
  each folder, or a folder of maps for the contexts that cross folders.
- **It is an ordinary note.** Its links are what make it a map, and the
  backlinks and \`related_notes\` walk the rest of the graph from it.
- **Embed a short section** when the map reads better with it in place. The page
  shows an embed one level deep, and \`read_note\` returns what was written, so an
  agent reads the embedded note itself.
- **Add the line of a map with the note it points at**, in the same session and
  by whoever writes the note, and say so in the guidance. A map deferred to the
  end is a map that does not exist when the writing stops.

## Templates

- **Every folder that receives notes has its own template**, a subfolder too: a
  template belongs to one folder.
- **Open the template with the frontmatter block**, the lines between the two
  \`---\` at the top, carrying \`name:\` and the properties the guidance declares.
- **Show the body with headings from \`#\`**, in the order a note of this folder is
  read.
- **Show the formatting the material calls for** — the table of a comparison, the
  callout of a rule — so that the tenth note looks like the first.
- **Make every placeholder look like one**, and say what to remove when a part
  does not apply.
- **The server validates nothing** against a template: its whole value is that
  the next agent follows it.

## Formatting that earns its place

The page draws these forms, and only the frontmatter and the links carry meaning
a query reads, so choose each form for how the note reads. The syntax and the
behaviour of each one are in \`write-notes\`.

${formattingTable()}

## Before you say it is done

1. The guidance opens with the paragraph that says what the notebook is.
2. Every folder that receives notes, subfolders included, has its own template.
3. Every folder description says the question its notes answer, what they
   carry and where the rest goes.
4. The folders are in reading order, and their names carry no numbers.
5. No folder is empty: every subfolder holds the note it was created for.
6. No note name repeats its folder, and the records that multiply are numbered.
7. Every note written has its line in the map of its context.
8. Each folder with a template holds one real note that follows it, links to the
   notes it mentions and states its properties. When the template cannot be
   filled from real material, the template is what changes.
9. The maps of content the guidance declares exist.
10. \`get_notebook_context\` reads the way the next agent needs it to.

## When to stop asking

When you can propose the whole structure in one message — the guidance in a
paragraph, the folders with their descriptions, the properties, the maps and the
templates — and the person can accept it or adjust it. Then build it.
`;

/**
 * Built from RECOGNISED_NOTATION, never written beside it (RN-AGT-017). The
 * prose around the table is the part a person wrote; the table itself is the
 * declaration that Discovery tests against its own extractors, so a notation
 * that stops being read stops being taught in the same commit.
 *
 * **The whole declaration, the forms inherited from CommonMark included, and
 * that is a decision.** Specification v0.3.0 restated CommonMark and GFM inside
 * `spec.json`, taking the table from 31 rows to 54, and the first reading
 * was that twenty of them tell an agent that a paragraph is a paragraph. They
 * do not. Each inherited entry states where THIS profile changes what the form
 * means — that a link inside a code span is not extracted, that `![[x]]` is an
 * embed and not an image, that a wikilink in a table cell is an edge like any
 * other, that `_` does not emphasise inside a word. Those crossings are
 * invisible from CommonMark alone and are exactly what an agent gets wrong, so
 * the reader who most needs them is the one reading this table. The guard
 * scoped the other way — the reading-surface expectations — was scoped for a
 * reason that does not apply here.
 *
 * The `Read?` column left with specification v0.4.0, and it left because the answer
 * stopped being a field: the profile no longer lists what it declines, so what
 * a form does is now the whole of what an entry says. The forms this product
 * is silent about are served below the table instead, from `DECLARED_SILENCE`.
 */
function notationTable(): string {
  const row = (entry: RecognisedNotation): string => `| \`${entry.syntax}\` | ${entry.effect} |`;

  return ['| Form | What happens |', '| --- | --- |', ...RECOGNISED_NOTATION.map(row)].join('\n');
}

/**
 * What is NOT in the table, which is the question the table cannot answer.
 *
 * §8 of the profile is one rule about every form it does not describe, and it
 * is the single most useful sentence an agent can be given about writing here,
 * because it answers "I wrote something and got nothing" once instead of per
 * form. Beside it go the two forms this product is asked about most, which are
 * the two the profile carried as entries until v0.4.0 and now does not
 * (RN-DSC-033).
 */
function silence(): string {
  const row = (entry: (typeof DECLARED_SILENCE)[number]): string =>
    `| \`${entry.syntax}\` | ${entry.effect} |`;

  return [
    'A form that is not in the table above is not part of the notation. It may',
    'still be drawn on the page, it never carries meaning — no edge, no',
    'attribute, no index entry — and writing it is how you get a note that looks',
    'right and answers nothing.',
    '',
    'Two of them are worth naming, because whoever arrives from another editor',
    'arrives with both:',
    '',
    '| Form | What happens |',
    '| --- | --- |',
    ...DECLARED_SILENCE.map(row),
  ].join('\n');
}

/**
 * Where the notation comes from: the specification this product reads, and the
 * sources it credits each form to.
 *
 * It comes first in the skill, because "which Markdown is this" is the question
 * underneath every other one an agent has about writing here, and answering it
 * with a specification is a different answer from a list of forms (RN-AGT-022).
 * The specification is named without a version, because it has none apart from
 * the product's. It is generated from the specification, and a source without
 * a version prints without one, because Obsidian publishes documentation rather
 * than a versioned specification.
 *
 * **The precedence is stated because it is not uniform.** The profile defers to
 * CommonMark and GFM and governs over Obsidian, which is the opposite
 * direction, and an agent that assumes one rule for all three will be wrong
 * about the half of the notation it is most confident in.
 */
function sources(): string {
  const cited = MARKDOWN_SPEC_SOURCES.map((source) =>
    source.version
      ? `- **${source.name} ${source.version}** — ${source.url}`
      : `- **${source.name}** — ${source.url}`,
  );

  return [
    `The notation this product reads is the **${MARKDOWN_SPEC_NAME}**:`,
    MARKDOWN_SPEC_URL,
    '',
    'It does not invent the notation. Each form is credited to where it was',
    'established:',
    '',
    ...cited,
    '',
    '**Which one wins is not the same in both directions.** Where the profile and',
    'CommonMark or GFM disagree, those specifications govern and the profile is',
    'the one that is wrong. Where the profile and a vault editor disagree, the',
    'profile governs — it is a lineage and never a promise that a note behaves',
    'identically somewhere else.',
    '',
    'The table below is generated from the profile itself: it cannot describe a',
    'notation this build does not implement.',
    '',
    '**Read the inherited rows too.** They are there because the profile says',
    'where it changes what they mean, and that is the part you cannot get from',
    'knowing Markdown: a link inside a code span is not read, `![[note]]` is an',
    'embed and not an image, a wikilink inside a table cell is an edge like any',
    'other, and `_` does not emphasise in the middle of a word.',
  ].join('\n');
}

const CONVERT_INLINE_TAGS = `# Bringing a notebook that used inline tags

A notebook written in an editor that reads \`#subject\` in the body as metadata
arrives here intact. Nothing breaks and no note is refused. But the curation
those tags carried is **lost**: here they are ordinary text, countable by
nobody, and the person who spent a year filing notes with them has a notebook that
looks the same and answers nothing.

That is the declared cost of a decision, and it is paid at the door by whoever
is arriving. This is how you offer to pay it for them.

## Why the product does not do this itself

You are reading a method and not calling a tool, and that is deliberate.

Reading \`#subject\` for meaning would make the server a third reader of the
content of a note, which is exactly what this product refuses: the frontmatter
and the link are the only two things it reads, and everything else in a note is
text it stores and never interprets. Adding a parser here to pay for a
notation the profile rejects would spend the guarantee to buy back the cost of
having made it.

**And \`#\` is treacherous.** In one survey of 1,562 notes, one of the three
inline matches was a hex colour. A false positive is cheap here **only because
a person reads your proposal before anything is written** — that is the whole
reason this is safe, so it is the one thing you may never skip.

## What is not a tag

Before you propose anything, rule these out. Every one of them is written by
somebody every day:

| Looks like a tag | Is | How to tell |
|---|---|---|
| \`# Heading\` | a heading | \`#\` at the start of a line, followed by a space |
| \`#ff0000\` | a colour | all hex digits, three or six of them |
| \`C#\`, \`F#\` | a language | the \`#\` is at the END of a word |
| \`#1\`, \`#42\` | an issue or a number | all digits |
| \`https://x.org/a#section\` | a URL fragment | the \`#\` is inside a link |
| \`#tag\` inside \`\\\`code\\\`\` or a fence | an example | it is code |

What is left is a \`#\` preceded by whitespace or line start, followed by a
letter, running to whitespace or punctuation. Nested forms like
\`#area/subject\` are one tag, not two.

## The method

1. **Find the candidates.** \`search_notes\` reads the body, so a query for the
   marker narrows the notebook to the notes worth reading. Read them with
   \`read_note\`.
2. **Read the guidance first.** The notebook may already say what its frontmatter
   vocabulary is. A tag that contradicts it is a question for the owner, not a
   write.
3. **Propose, per note, in full.** Show the note, the tags you found, and the
   \`tags:\` you would write. If the notebook already has a \`tags:\` on that note,
   show the MERGED list: you are adding to curation, never replacing it.
   List separately anything you rejected and why, because a rejection you got
   wrong is invisible unless you say it out loud.
4. **Wait.** Not "proceeding unless told otherwise". Acceptance is a person
   saying yes to what they read.
5. **Write one note at a time**, with \`update_note\`, carrying the
   \`baseRevision\` the read returned. Each note is an ordinary authored write:
   it lands in the history under the person who accepted it, with a revision of
   its own, and \`note_history\` shows it like any other. There is no migration
   mode and no silent pass.
6. **Leave the body alone.** The \`#subject\` stays exactly where it was
   written. You are adding the subject somewhere it counts, not editing
   somebody's prose, and leaving it makes the whole thing reversible by
   deleting one line of frontmatter.

## What to say when it is done

Say how many notes you wrote, how many you proposed and they declined, and what
you found and did not propose. A conversion nobody can audit afterwards is a
migration, which is the thing this is not.

## What not to do

- Do not run it over a notebook without being asked to.
- Do not write a note the person did not see.
- Do not "finish the rest the same way" after one acceptance. Each note is a
  note somebody wrote.
- Do not remove the inline tags. They are the author's bytes.
`;

const WRITE_NOTES = `# Writing a note this product can read

The body of a note is Markdown, and it is stored exactly as you send it. Almost
all of it is text the product never looks at, which is deliberate: what a
convention means belongs to the notebook, not to the server.

There are exactly two places where the product DOES read your content, and
this is the whole list: **the frontmatter and the links**. The name of a note is
one key of the frontmatter. Everything else you write is text, and nothing more.

## A note, from top to bottom

**Write the name of the note in \`name:\`, in the frontmatter that opens it.** It
is the title the page shows and what every link looks for. \`create_note\` takes
the content and no name, and changing \`name:\` with \`update_note\` is how a note
is renamed.

\`\`\`markdown
---
name: Lei 14.133
tags: [contracts]
---

# The general rule of direct contracting

## Article 75
\`\`\`

Below the frontmatter comes the body, and **its headings are the structure of
the note, starting at \`#\`**: \`# The general rule of direct contracting\` is its
first level and \`## Article 75\` its second. A heading is searchable text and it
is what a link anchor points at: \`[[Lei 14.133#Article 75]]\`.

A link finds a note by its name **exactly**, case for case after Unicode
normalisation: \`[[Lei 14.133]]\` finds the note named \`Lei 14.133\`, and
\`[[lei 14133]]\` is a link waiting for a note of that name.

**A folder holds one note of each name.** Another folder may hold a note of the
same name, and the folder is what tells the two apart for whoever reads, never
the link, which reaches every note of that name. A name the folder already holds
is refused, naming the note that holds it: read that note and change it with
\`update_note\`, or choose another name or another folder.

## Which Markdown this is

${sources()}

## The notation

${notationTable()}

## What is not in that table

${silence()}

## What none of this changes

- **The server never validates a note.** It does not check your frontmatter
  against the guidance, does not check the shape against the template, and does
  not refuse a note for any of it. The Markdown you send is the Markdown that
  gets stored.
- **The frontmatter is not searched.** It is what facets are built from, and
  keeping it in the searchable text would make every note match its own
  metadata. Write in the body what you want found by searching.
- **No key is special.** \`maturity\` and \`reviewed\` are attributes like any
  other: the vocabulary belongs to the guidance of the notebook you are writing in.
  Read it before inventing a field.

## What is read, and what is only drawn

The table has two kinds of row and they are easy to run together. Most forms
are **rendered and nothing else**: a heading, a callout, a struck word and a
diagram change how a note looks and carry no meaning any query can reach. Only
the frontmatter and the links are read.

- A heading is searchable text and gives a section name to a link anchor. It
  carries no other meaning, and a heading is not a tag.
- A block identifier, like \`^abc123\`, names a block so an embed can address
  it. It is drawn nowhere and it means nothing outside its own note.
- Anything the guidance of the notebook invented and the server was never told
  about. Conventions are for the humans and agents reading the notebook, and they
  work because everyone follows them, not because anything enforces them.

## Citing a source

A note that states something says where it comes from. Where the evidence lives
depends on whether the source has an address of its own.

**A source with an address of its own is cited where it is used**, with an
inline link — a file at a commit, a URL with an anchor, an article of a norm —
and the passage that matters goes in the note, as a quote or a code block. An
inline link points outside the notebook and is never an edge of the graph, so it
costs the notebook nothing.

\`\`\`markdown
The name is read from one key of the frontmatter, and from nothing else
([noteName.ts, lines 12–30](https://github.com/org/repo/blob/4f2a9c1/kernel/noteName.ts#L12-L30)):

> A note is named by the \`name:\` of its frontmatter, and by nothing else.
\`\`\`

**A text that reads as prose cites with footnotes**, when a link in the middle of
a sentence would break it: \`[^label]\` where the claim is, and \`[^label]: …\` on a
line of its own. The page gathers every definition at the **end of the note**,
numbered in the order they are first cited, whatever the label says — so give
each a word, \`[^rup]\`, not a number the page will not show, and do not write a
heading over them: it stays where you wrote it and ends up empty. A footnote is
never an edge; a \`[[wikilink]]\` inside one still is.

\`\`\`markdown
The phases ran in parallel, varying only in intensity[^rup].

[^rup]: Wikipedia. *Rational Unified Process*. <https://en.wikipedia.org/wiki/Rational_unified_process>
\`\`\`

**A source earns a note of its own** when it has no address — the output of a
command, an interview, a measurement — or when many notes cite the same passage.
The note keeps the source whole, and the notes that rely on it link to it.

\`\`\`markdown
---
name: Load test of 2026-09-15
---

# 50 parallel writes to one notebook

p95 of 180 ms, no write retried.
\`\`\`

**A passage many notes cite is embedded, not copied.** Give the paragraph a block
identifier in the note that keeps it, and embed it where it is needed; the text
stays in one place, and a correction reaches every note that shows it.

\`\`\`markdown
In the note Load test of 2026-09-15:

p95 of 180 ms, no write retried. ^p95

In every note that relies on it:

![[Load test of 2026-09-15#^p95]]
\`\`\`

## Searching what you wrote

\`search_notes\` reads the body, not the frontmatter, and its query language is
the other half of this: \`"exact phrase"\`, \`-exclusion\`, \`OR\`, parentheses,
and the fields \`name:\`, \`folder:\`, \`section:\` and \`content:\`. Any other
prefix is read as a frontmatter attribute, which is what makes
\`maturity:evergreen\` a valid filter without a line of code about it. The
vocabulary of the notebook becomes the query language of the notebook.
`;
/**
 * The skill a text names outside the registry, as a constant of it: a
 * description that cites a skill by a literal would still cite it the day it is
 * renamed, and send the agent to a `NOT_FOUND`.
 */
export const DESIGN_NOTEBOOK_SKILL = 'design-notebook';

/**
 * One skill per task, and only tasks the reading path does not teach. The path
 * itself stays inline in `whoami`, because spending a round trip to learn it
 * would be friction against the very thesis of the connector. A skill is worth
 * something only when it is read before its task, which is why the index
 * travels in the handshake as well as in `whoami` (RN-AGT-028): an agent that
 * goes from the list of notebooks straight to a write never calls `whoami`.
 */
export const SKILLS: readonly Skill[] = [
  {
    name: DESIGN_NOTEBOOK_SKILL,
    task: 'Design a notebook from scratch: its guidance, its folders and their templates',
    body: DESIGN_NOTEBOOK,
  },
  {
    name: 'write-notes',
    task: 'Write a note this product can read: the notation it interprets, and the notation it does not',
    body: WRITE_NOTES,
  },
  {
    name: 'convert-inline-tags',
    task: 'Bring a notebook that used inline #tags: propose the equivalent frontmatter, note by note',
    body: CONVERT_INLINE_TAGS,
  },
];

export function skillNamed(name: string): Skill | undefined {
  return SKILLS.find((skill) => skill.name === name);
}

/**
 * The index, one line per skill, derived from the registry (RN-AGT-018). The
 * handshake and `whoami` print the same lines, so the two can never disagree
 * about which skills exist.
 */
export function skillIndex(): string[] {
  return SKILLS.map((skill) => `- \`${skill.name}\` — ${skill.task}`);
}
