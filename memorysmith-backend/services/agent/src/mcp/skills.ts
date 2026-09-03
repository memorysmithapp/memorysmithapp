/**
 * The skill registry: method, not operation.
 *
 * The product rests on a premise, that a vault carries its own instructions
 * and an agent that reads them writes like the owner would. There is exactly
 * one task where the premise cannot hold: CREATING the vault, because the
 * guidance is what is being produced. That is where the only quality lever the
 * product has is absent, and it is where it would pay off most.
 *
 * What is missing there is not an operation. `create_vault`, `set_guidance`,
 * `create_folder` and `set_template` already exist and are enough. What is
 * missing is METHOD: which questions to ask, in what order, what makes a
 * guidance good, and when to stop asking and start writing.
 *
 * The index of these skills is served by `whoami` and DERIVED FROM THIS
 * REGISTRY, never written beside it (RN-AGT-018): a hand-kept list drifts on
 * the first rename, and an index pointing at a skill nobody wrote sends the
 * agent down a path that fails. It is the same discipline RN-AGT-013 imposes
 * on the help itself.
 */

export interface Skill {
  /** Stable identifier, and the argument `get_skill` takes. */
  readonly name: string;
  /** The task, phrased as the agent would want it, not as a feature. */
  readonly task: string;
  /** The method, in Markdown, served verbatim. */
  readonly body: string;
}

const DESIGN_VAULT = `# Designing a vault from scratch

You are about to create a vault. This is the one moment where the vault cannot
tell you what it is, because you are the one deciding it. Everything written
here is what the product would have told you if it could.

## Start from samples, never from a questionnaire

Do not ask "what is this vault for?". An abstract question about purpose
produces a generic vault, and a generic vault produces vague folder
descriptions, which is what makes an agent guess where a note goes.

Ask instead:

> Show me three things you want to keep in here.

Real material, as it exists today: a norm, a meeting note, a paper, an incident
report, a contract clause. You usually already have them in the conversation or
in the work at hand. The shape of a vault is derived from the material that
will live in it.

From three samples you can already see what a folder is, what a note is, and
which fields repeat. From a paragraph about purpose you can see none of that.

## Then decide, in this order

1. **What this vault is, in one paragraph.** What belongs, and what
   deliberately does not. The second half is the one that saves work later: a
   vault that never says what it excludes accumulates everything.
2. **The kinds of note it recognises.** Two or three, no more, each with a name
   the owner would use out loud. If a kind cannot be told apart from another by
   its content, it is one kind.
3. **The folders.** One folder per kind of material, ordered so the reading
   order means something (order is signal, not decoration). Every folder needs
   a description that answers a single question: what goes in here, and what
   goes somewhere else instead.
4. **The template of each folder that receives notes.** It is the shape of the
   note, and it is the only thing that keeps the tenth note looking like the
   first.

## Writing the guidance

The guidance is the document the next agent reads before writing. Write it for
that reader, not for a human browsing a wiki.

- **Do not open with a title.** The Vault Context already emits a heading with
  the vault name above whatever you write, so a \`# My vault\` at the top shows
  up twice. Start with the paragraph that says what this vault is.
- **Name the vocabulary.** If the owner calls something a "finding" and not an
  "issue", write that down. The vocabulary of the vault becomes the query
  language of the search: any frontmatter attribute is a filter.
- **State the naming convention** for note titles, and give one example of a
  good title and one of a bad one.
- **Declare the frontmatter you expect**, field by field, with the accepted
  values. If you declare it, every folder that receives notes needs a template
  carrying it.
- **Say what NOT to do.** A guidance that only describes the happy shape gets
  followed halfway.

The server never validates a note against the guidance. Nothing you write here
is enforced: it is read, and followed, and that is exactly why it has to be
unambiguous.

## Before you say it is done

Check these four, in order. The first two are the mistakes that actually
happened when this was done without a method:

1. Does the guidance open with a heading that repeats the vault name? Remove it.
2. Does every folder that receives notes have a template? A guidance that
   declares mandatory frontmatter and a folder without a template is a
   contradiction the next agent will resolve by guessing.
3. Does every folder description answer where a note goes, or does it merely
   name the folder again? "Norms" is a name; "the reading record of each norm,
   tied to the text of that version" is a description.
4. Write ONE real note, from one of the three samples, following the template.
   If you cannot fill the template from real material, the template is wrong,
   and it is cheaper to find that out now than on the fortieth note.

## When to stop asking

When you can write the first note without asking anything else. That is the
test. Two or three questions usually get you there; a fourth is often you
avoiding the decision the owner already gave you.
`;

/**
 * One skill per task, and only tasks that fall OUTSIDE the common path. The
 * reading path that `whoami` already teaches covers almost every session and
 * stays inline: spending a round trip to learn it would be friction against
 * the very thesis of the connector.
 */
export const SKILLS: readonly Skill[] = [
  {
    name: 'design-vault',
    task: 'Design a vault from scratch: its guidance, its folders and their templates',
    body: DESIGN_VAULT,
  },
];

export function skillNamed(name: string): Skill | undefined {
  return SKILLS.find((skill) => skill.name === name);
}
