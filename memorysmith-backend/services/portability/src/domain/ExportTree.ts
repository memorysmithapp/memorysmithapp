/**
 * The materialized tree of an export (software-vision.md, section 12).
 *
 * THIS IS WHERE FILE NAMES COME BACK INTO EXISTENCE. Inside the system there
 * are opaque identifiers and roles; here the guidance becomes README.md, the
 * template becomes TEMPLATE.md and the slug of a note becomes a file name.
 *
 * The order is encoded as a numeric prefix, which is the only way a file
 * system can carry it, since it has no order of its own (RN-PRT-002). The
 * description of each folder is materialized as its README.md (RN-PRT-003).
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

const RESERVED = new Set(['readme', 'template']);

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

  // The guidance of the vault, as its README.
  files.push({
    path: `${root}/README.md`,
    content: input.guidance ?? `# ${input.vaultName}\n`,
  });

  /**
   * A note whose slug is exactly `readme` or `template` gets a suffix, and
   * every link to it is rewritten along with it (RN-PRT-005). It is the only
   * concession of the export, and it belongs to the edge, not to the model.
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

  const walk = (parentFolderId: string | null, prefix: string): void => {
    const siblings = byParent.get(parentFolderId) ?? [];
    siblings.forEach((folder, index) => {
      const path = `${prefix}/${pad(index)} ${safeSegment(folder.name)}`;

      // The description of the folder, materialized (RN-PRT-003).
      files.push({ path: `${path}/README.md`, content: `${folder.description}\n` });
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
