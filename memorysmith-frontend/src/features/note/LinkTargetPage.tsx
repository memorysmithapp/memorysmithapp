import { NotebookBar } from '../structure/NotebookBreadcrumb';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { resolveLinkTarget } from '../../shared/api/source';
import { noteAddress } from '../../shared/api/note-address';
import { useDocumentTitle } from '../../shared/components/document-title';
import {
  LinkChoiceContent,
  type LinkChoiceOption,
} from '../../shared/components/LinkChoiceContent';
import { folderTrailForNote } from '../structure/trail';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { queryKeys } from '../../shared/api/query-keys';

/**
 * The address of a **link target**, which is a wikilink concept and not a note
 * (RN-DSC-046).
 *
 * A URL is an address and names one note; a wikilink is a name and may match
 * several — deliberately, because nothing in a notebook is unique (RN-KNW-037).
 * When a target answers with exactly one note the link goes straight there and
 * never reaches this page. When it answers with none or with several, the
 * target itself gets an address, and this is where the encoding of a name
 * legitimately lives: a route reached by clicking, never by typing.
 *
 * It is **notebook-wide**, because resolution is: binding the choice to a folder
 * trail was always slightly wrong.
 *
 * **One content, two places.** What it explains and what it offers is the same
 * component the dialog of a wikilink renders (#144): a person who pasted the
 * address and a person who clicked the link are answering the same question,
 * and two copies of that answer drift apart.
 */
export function LinkTargetPage() {
  const navigate = useNavigate();
  const notebookId = useNotebookId();
  const { target = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const decoded = decodeURIComponent(target).normalize('NFC');

  useDocumentTitle(decoded, structure.notebook.name);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.linkTarget(notebookId, decoded),
    queryFn: () => resolveLinkTarget(notebookId, decoded),
    enabled: decoded !== '',
  });

  const candidates: LinkChoiceOption[] = (data?.notes ?? []).map((note) => {
    const trail = folderTrailForNote(structure.folders, note.noteId);
    return {
      noteId: note.noteId,
      name: note.name,
      trail: trail.map((each) => each.name),
      // What the folder holding it is for, which is what tells two notes of
      // one name apart without opening either.
      folderDescription: trail[trail.length - 1]?.description ?? '',
      address: noteAddress(notebookId, note.noteId),
    };
  });

  // One note answers: this page is a step nobody asked for, so it steps aside
  // and the address in the bar becomes the address of the note.
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only) return <Navigate to={only.address} replace />;

  return (
    <>
      <NotebookBar crumbs={[]} />
      <article className="content-pane link-target">
        <h1>{decoded}</h1>
        <LinkChoiceContent
          target={decoded}
          by={data?.by ?? null}
          options={candidates}
          state={isPending ? 'loading' : isError || !data ? 'error' : 'ready'}
          onPick={(address) => void navigate(address)}
        />
      </article>
    </>
  );
}
