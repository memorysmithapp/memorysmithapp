import { useQueryClient } from '@tanstack/react-query';
import type { InterfaceQueryKey } from '../../shared/api/query-keys';
import type { NoteEditing } from '../../shared/components/NoteContent';
import { useEditSession } from '../note/edit-session';

/**
 * Editing the Guidance of a notebook or the Template of a folder in place
 * (#301), with the editor of the note page and its saves (#300, RN-KNW-034).
 *
 * The two are Content Slots like a note: written whole, on the revision the
 * write was based on, and a write on a revision that is no longer the latest
 * is a conflict the save offers to resolve, as on a note. What they lack is a
 * name a link reaches, so a save never says it renamed anything. They are
 * written by the roles that write a note, the same ones that tick their boxes
 * and delete them on these pages.
 *
 * A slot that does not exist yet is edited from an empty text, and its first
 * save creates it, on no revision.
 */
export function useSlotEditing({
  notebookId,
  id,
  raw,
  revision,
  purpose,
  writable,
  write,
  reload,
  invalidates,
}: {
  notebookId: string;
  /** What the session belongs to: the Guidance, or the folder of the Template. */
  id: string;
  raw: string;
  revision: string | null;
  /** What a file attached from the editor says it was attached to. */
  purpose: string;
  writable: boolean;
  write: (content: string, baseRevision: string | null, keepalive: boolean) => Promise<string>;
  reload: () => Promise<{ raw: string; revision: string }>;
  /** What the page reads again once a save lands and once the session ends. */
  invalidates: readonly InterfaceQueryKey[];
}): NoteEditing | undefined {
  const client = useQueryClient();
  const again = () => {
    for (const queryKey of invalidates) void client.invalidateQueries({ queryKey });
  };
  const { editing } = useEditSession({
    notebookId,
    document: writable ? { id, raw, revision, purpose } : undefined,
    target: {
      write: ({ content, baseRevision, keepalive }) => write(content, baseRevision, keepalive),
      reload,
      written: again,
      closed: again,
    },
  });
  return editing;
}
