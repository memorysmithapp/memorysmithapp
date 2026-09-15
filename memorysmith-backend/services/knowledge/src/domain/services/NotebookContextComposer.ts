/**
 * NotebookContextComposer builds the Notebook Context: the guidance in full plus the
 * annotated tree, in one document (software-vision.md, section 9.2).
 *
 * It lives in the DOMAIN because the shape of this document IS the product,
 * not a presentation detail: it is the exact equivalent of what an agent gets
 * today by reading the guidance and running `ls -R` on a local folder,
 * in a single call.
 *
 * Four decisions are visible in the format:
 *  - the description of each folder comes along, because it is what steers
 *    where the agent writes, and that is why it is mandatory (RN-KNW-006);
 *  - the order is the DEFINED order, numbered, because it is signal (PP9);
 *  - the note count comes along, so the agent knows where the mass is before
 *    asking for any listing;
 *  - the IDENTIFIER of each folder comes along (RN-AGT-020), because it is the
 *    argument every folder tool takes and the only stable address a folder
 *    has. The numbering is derived from the current position among siblings,
 *    so reordering changes it and it can never serve as an address. Without
 *    the identifier here it is returned exactly once, by `create_folder`, and
 *    a session that created nothing can read this notebook and not write in it;
 *  - and the RESERVED VOCABULARY comes along (RN-AGT-025), because an agent
 *    landing in a notebook has no other way to tell an attribute name that means
 *    something everywhere from one that belongs to this notebook alone.
 *
 * The vocabulary arrives as an argument and is never read here: the domain
 * knows no specification, and the list reaches this function from the
 * composition root, which is the one layer allowed to read the specification.
 *
 * The labels are en-US because the MCP surface is the public contract and the
 * canonical locale is en_US (CLAUDE.md, language policy). The notebook content
 * itself is whatever language its authors write in.
 */

import type { FolderId } from '@memorysmith/kernel';
import type { Notebook } from '../notebook/Notebook.js';
import type { Folder } from '../notebook/Folder.js';
import { NOTEBOOK_LIMITS } from '../values.js';

export interface NotebookContextInput {
  readonly notebook: Notebook;
  /** The guidance Markdown, already read from the ContentStore by the use case. */
  readonly guidance: string | null;
  /**
   * The attribute names the specification reserves, in the order it declares
   * them, read from the specification by whoever wired this up.
   */
  readonly reservedVocabulary: readonly string[];
}

export function composeNotebookContext(input: NotebookContextInput): string {
  const { notebook, guidance, reservedVocabulary } = input;
  const lines: string[] = [`# Notebook: ${notebook.name.value}`];

  if (guidance && guidance.trim().length > 0) {
    lines.push('', guidance.trim());
  } else {
    lines.push(
      '',
      '_This notebook has no guidance yet. Ask the notebook owner to write one before ' +
        'creating notes, since it is what declares the conventions of this notebook._',
    );
  }

  lines.push(...reservedSection(reservedVocabulary));
  lines.push('', '## Structure');

  const folders = notebook.folders;
  if (folders.size === 0) {
    lines.push('', '_This notebook has no folders yet._');
    return lines.join('\n') + '\n';
  }

  let rendered = 0;
  let truncated = false;

  const render = (parentId: FolderId | null, prefix: string): void => {
    if (truncated) return;
    const children = folders.childrenOf(parentId);
    children.forEach((folder, index) => {
      if (truncated) return;
      if (rendered >= NOTEBOOK_LIMITS.maxFolders) {
        truncated = true;
        return;
      }
      rendered += 1;
      const numbering = prefix ? `${prefix}${index + 1}` : `${index + 1}`;
      lines.push(
        `${indentFor(numbering)}${numbering}. ${describe(folder, notebook, folders.childrenOf(folder.id).length > 0)}`,
      );
      render(folder.id, `${numbering}.`);
    });
  };

  render(null, '');

  if (truncated) {
    // Above the folder ceiling the context is truncated WITH AN EXPLICIT
    // WARNING rather than silently (RN-KNW-010).
    lines.push(
      '',
      `_Truncated: this notebook holds more than ${NOTEBOOK_LIMITS.maxFolders} folders, ` +
        'so the tree above is incomplete._',
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * What the frontmatter reserves, and where the question it does not reserve is
 * answered.
 *
 * Who wrote a note and when is recorded by the audit trail of every write, with
 * the person and the connector, and nobody types it (non-negotiable rule 7).
 * Teaching a frontmatter value for it put the e-mail of the connected account
 * into notes other people produced, so the section teaches none: it says where
 * the answer already is (RN-AGT-025).
 */
function reservedSection(vocabulary: readonly string[]): string[] {
  if (vocabulary.length === 0) return [];
  return [
    '',
    '## Reserved attributes',
    '',
    'These attribute names mean the same thing in every notebook, in every ' +
      'language, and are always written in en-US: ' +
      vocabulary.map((key) => `\`${key}\``).join(', ') +
      '. Every other attribute belongs to this notebook, and its name is whatever ' +
      'the Guidance says it is.',
    '',
    'Reserving a name is a guarantee, not a prohibition: a notebook may keep ' +
      'writing `etiquetas:` and it stays indexed like any other attribute. What ' +
      'the reserved name buys is that a tool reading two notebooks can offer one ' +
      'column over both.',
    '',
    '`name` is what a note is called: it is what every link resolves against, and ' +
      'nothing else names a note — not a heading, not its first line. A note written ' +
      'without `name:` has no name, and no link can reach it.',
    '',
    'Who wrote a note and when is answered by its history: `note_history` records ' +
      'every write with the person and the connector, and this product never writes ' +
      'an attribute into the body of a note. Any other attribute, a date or an ' +
      'author included, is this notebook’s own, and its Guidance says whether it ' +
      'is written.',
  ];
}

/** One level of the numbering is one level of indentation. */
function indentFor(numbering: string): string {
  const depth = numbering.split('.').filter((part) => part.length > 0).length;
  return '   '.repeat(Math.max(0, depth - 1));
}

function describe(folder: Folder, notebook: Notebook, hasChildren: boolean): string {
  const name = hasChildren ? `${folder.name.value}/` : folder.name.value;
  const notes = notebook.noteCountOf(folder.id);
  const annotations = [`${notes} ${notes === 1 ? 'note' : 'notes'}`];
  if (folder.hasTemplate) annotations.push('has TEMPLATE.md');
  // The identifier is fenced as code so that reading it and copying it into
  // the next call are the same gesture (RN-AGT-020).
  return `**${name}** \`${folder.id.value}\`: ${folder.description.value} (${annotations.join(', ')})`;
}
