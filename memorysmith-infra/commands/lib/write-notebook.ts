/**
 * Writes a notebook tree through the product API, in the order its structure
 * gives: the notebook, its Guidance, then every folder with its Template and its
 * notes (architecture-guide.md, section 20.2).
 *
 * The onboarding command writes the first notebook of an account with it, and
 * the agent evaluation seeds the notebooks its cases write into. Everything goes
 * through the API, so a notebook written here has the revisions, the domain
 * events and the audit trail a person's would.
 */

import type { NotebookTree, TreeFolder } from './notebook-tree.js';
import type { ProductApi } from './product-api.js';

export interface WrittenNotebook {
  readonly notebookId: string;
  readonly folders: number;
  readonly notes: number;
}

export async function writeNotebookTree(input: {
  readonly api: ProductApi;
  readonly token: string;
  readonly tree: NotebookTree;
  /** The name of the notebook; the name of the tree when none is given. */
  readonly name?: string;
  /** Writes the Guidance, the folders and the Templates, and no notes. */
  readonly structureOnly?: boolean;
  /** Stops after this many notes; zero writes them all. */
  readonly maxNotes?: number;
  readonly progress?: (written: { readonly folders: number; readonly notes: number }) => void;
}): Promise<WrittenNotebook> {
  const { api, token, tree } = input;
  const maxNotes = input.maxNotes ?? 0;
  const notebook = await api.call<{ notebookId: string }>('POST', '/knowledge/notebooks', token, {
    name: input.name ?? tree.name,
    description: '',
  });
  if (tree.guidance) {
    await api.call('PUT', `/knowledge/notebooks/${notebook.notebookId}/guidance`, token, {
      content: tree.guidance,
      baseRevision: null,
    });
  }

  let written = { folders: 0, notes: 0 };
  const writeFolders = async (
    folders: readonly TreeFolder[],
    parentFolderId: string | null,
  ): Promise<void> => {
    for (const folder of folders) {
      const created = await api.call<{ folderId: string }>(
        'POST',
        `/knowledge/notebooks/${notebook.notebookId}/folders`,
        token,
        { parentFolderId, name: folder.title, description: folder.description },
      );
      written = { ...written, folders: written.folders + 1 };
      if (folder.template) {
        await api.call(
          'PUT',
          `/knowledge/notebooks/${notebook.notebookId}/folders/${created.folderId}/template`,
          token,
          { content: folder.template, baseRevision: null },
        );
      }
      if (!input.structureOnly) {
        for (const note of folder.notes) {
          if (maxNotes > 0 && written.notes >= maxNotes) break;
          // The content exactly as the tree carries it: nothing is derived from
          // a file name, and a note written without name: has no name.
          await api.call('POST', `/knowledge/notebooks/${notebook.notebookId}/notes`, token, {
            folderId: created.folderId,
            content: note.content,
          });
          written = { ...written, notes: written.notes + 1 };
          input.progress?.(written);
        }
      }
      await writeFolders(folder.children, created.folderId);
    }
  };
  await writeFolders(tree.folders, null);
  return { notebookId: notebook.notebookId, ...written };
}
