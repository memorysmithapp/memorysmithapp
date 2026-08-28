/**
 * The materialized tree of an export (software-vision.md, section 12).
 *
 * THIS IS WHERE FILE NAMES COME BACK INTO EXISTENCE. Inside the system there
 * are opaque identifiers and roles; here the guidance becomes GUIDANCE.md, the
 * template becomes TEMPLATE.md and the slug of a note becomes a file name.
 *
 * The order is encoded as a numeric prefix, which is the only way a file
 * system can carry it, since it has no order of its own (RN-PRT-002).
 *
 * The description of a folder is an attribute of the folder item, not a
 * document: it never was a Content Slot and it never reached the object
 * store. So it is not materialized one file per folder either. The whole
 * annotated tree is written ONCE, as STRUCTURE.md at the root (RN-PRT-003).
 * Together with GUIDANCE.md next to it, the two files are exactly the two
 * halves of the Vault Context (software-vision.md, 9.2): the half a human
 * writes and the half the product derives.
 *
 * Zero lock-in is a requirement, not a courtesy: only .md files, no
 * proprietary component, and no index needed in order to read it.
 */

export interface ExportFolder {
  readonly folderId: string;
  readonly parentFolderId: string | null;
  readonly name: string;
  readonly description: string;
  readonly position: string;
  readonly templateContent: string | null;
}

export interface ExportNote {
  readonly noteId: string;
  readonly folderId: string;
  readonly title: string;
  readonly slug: string;
  readonly position: string;
  readonly content: string;
}

export interface ExportInput {
  readonly vaultName: string;
  readonly guidance: string | null;
  readonly folders: ExportFolder[];
  readonly notes: ExportNote[];
}

export interface ExportFile {
  readonly path: string;
  readonly content: string;
}

const RESERVED = new Set(['guidance', 'structure', 'template']);

function pad(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Keeps a path segment usable on every file system without renaming a note. */
function safeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').trim();
}

export function buildExportTree(input: ExportInput): ExportFile[] {
  const root = safeSegment(input.vaultName) || 'vault';
  const files: ExportFile[] = [];

  // The guidance of the vault, verbatim, as the half a human wrote.
  files.push({
    path: `${root}/GUIDANCE.md`,
    content: input.guidance ?? `# ${input.vaultName}\n`,
  });

  /**
   * A note whose slug is exactly `guidance`, `structure` or `template` gets a
   * suffix, and every link to it is rewritten along with it (RN-PRT-005). It
   * is the only concession of the export, and it belongs to the edge, not to
   * the model.
   */
  const renamed = new Map<string, string>();
  for (const note of input.notes) {
    if (RESERVED.has(note.slug)) renamed.set(note.slug, `${note.slug}-note`);
  }

  const rewriteLinks = (markdown: string): string => {
    let output = markdown;
    for (const [from, to] of renamed) {
      output = output
        .replace(new RegExp(`\\[\\[${from}(\\|[^\\]]*)?\\]\\]`, 'gi'), `[[${to}$1]]`)
        .replace(new RegExp(`\\(${from}\\.md\\)`, 'gi'), `(${to}.md)`);
    }
    return output;
  };

  const byParent = new Map<string | null, ExportFolder[]>();
  for (const folder of input.folders) {
    const siblings = byParent.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    byParent.set(folder.parentFolderId, siblings);
  }
  for (const siblings of byParent.values()) {
    siblings.sort((left, right) =>
      left.position === right.position
        ? left.folderId.localeCompare(right.folderId)
        : left.position < right.position
          ? -1
          : 1,
    );
  }

  const noteCountOf = (folderId: string): number =>
    input.notes.filter((note) => note.folderId === folderId).length;

  files.push({
    path: `${root}/STRUCTURE.md`,
    content: buildStructureDocument(input.vaultName, byParent, noteCountOf),
  });

  const walk = (parentFolderId: string | null, prefix: string): void => {
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.forEach((folder, index) => {
      const path = `${prefix}/${pad(index)} ${safeSegment(folder.name)}`;

      if (folder.templateContent !== null) {
        files.push({ path: `${path}/TEMPLATE.md`, content: folder.templateContent });
      }

      const notes = input.notes
        .filter((note) => note.folderId === folder.folderId)
        .sort((left, right) =>
          left.position === right.position
            ? left.noteId.localeCompare(right.noteId)
            : left.position < right.position
              ? -1
              : 1,
        );

      notes.forEach((note, noteIndex) => {
        const slug = renamed.get(note.slug) ?? note.slug;
        files.push({
          path: `${path}/${pad(noteIndex)} ${slug}.md`,
          // Links come out intact in the text of the notes (RN-PRT-004),
          // except for the rewriting the reserved names force.
          content: rewriteLinks(note.content),
        });
      });

      walk(folder.folderId, path);
    });
  };

  walk(null, root);
  return files;
}

/**
 * The annotated tree, in the exact line format of the `## Structure` section
 * of the Vault Context (software-vision.md, 9.2). The format is declared
 * there, not here: this service cannot import the composer of svc-knowledge,
 * and the document is what keeps the two ends honest. Changing one without
 * the other breaks the promise that an export reads like what the agent gets.
 *
 * The numbering is what makes the file machine-readable without an index: a
 * line numbered `2.1.` is the folder reached by the first child of the second
 * folder, whose directories carry the matching `02 ` and `01 ` prefixes.
 */
function buildStructureDocument(
  vaultName: string,
  byParent: Map<string | null, ExportFolder[]>,
  noteCountOf: (folderId: string) => number,
): string {
  const lines: string[] = [`# Structure: ${vaultName}`, ''];

  if ((byParent.get(null) ?? []).length === 0) {
    lines.push('_This vault has no folders yet._');
    return lines.join('\n') + '\n';
  }

  const render = (parentFolderId: string | null, prefix: string): void => {
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.forEach((folder, index) => {
      const numbering = prefix ? `${prefix}${index + 1}` : `${index + 1}`;
      const hasChildren = (byParent.get(folder.folderId) ?? []).length > 0;
      const name = hasChildren ? `${folder.name}/` : folder.name;
      const notes = noteCountOf(folder.folderId);
      const annotations = [`${notes} ${notes === 1 ? 'note' : 'notes'}`];
      if (folder.templateContent !== null) annotations.push('has TEMPLATE.md');
      lines.push(
        `${indentFor(numbering)}${numbering}. **${name}**: ${folder.description} ` +
          `(${annotations.join(', ')})`,
      );
      render(folder.folderId, `${numbering}.`);
    });
  };

  render(null, '');
  return lines.join('\n') + '\n';
}

/** One level of the numbering is one level of indentation. */
function indentFor(numbering: string): string {
  const depth = numbering.split('.').filter((part) => part.length > 0).length;
  return '   '.repeat(Math.max(0, depth - 1));
}
