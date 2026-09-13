import { useQuery } from '@tanstack/react-query';
import { Navigate, Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resolveLinkTarget } from '../../shared/api/source';
import { noteAddress } from '../../shared/api/note-address';
import { NoteSkeleton } from '../../shared/components/skeletons';
import { useDocumentTitle } from '../../shared/components/document-title';
import { folderTrailForNote } from '../structure/trail';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';

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
 */
export function LinkTargetPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { target = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const decoded = decodeURIComponent(target).normalize('NFC');

  useDocumentTitle(decoded, structure.notebook.name);

  const { data, isPending, isError } = useQuery({
    queryKey: ['link-target', notebookId, decoded],
    queryFn: () => resolveLinkTarget(notebookId, decoded),
    enabled: decoded !== '',
  });

  if (isPending) return <NoteSkeleton />;
  if (isError || !data) return <p className="status">{t('common.loadFailed')}</p>;

  const candidates = data.notes.map((note) => {
    const trail = folderTrailForNote(structure.folders, note.noteId);
    return {
      noteId: note.noteId,
      name: note.name,
      folderPath: trail.map((each) => each.name).join(' / '),
      address: noteAddress(notebookId, note.noteId),
    };
  });

  // One note answers: this page is a step nobody asked for, so it steps aside
  // and the address in the bar becomes the address of the note.
  const only = candidates.length === 1 ? candidates[0] : undefined;
  if (only) return <Navigate to={only.address} replace />;

  return (
    <article className="content-pane link-target">
      <h1>{decoded}</h1>
      {candidates.length === 0 ? (
        <p className="status">{t('note.targetPending', { target: decoded })}</p>
      ) : (
        <>
          <p className="status">
            {t('note.targetAmbiguous', { count: candidates.length })}{' '}
            {/* A choice is about a name or about an alias and never about
                both, and the two are not equally durable: an edge held by an
                alias goes the day somebody writes a note under that name. */}
            {data.by === 'alias' ? t('note.targetByAlias') : t('note.targetByName')}
          </p>
          <ul className="note-list">
            {candidates.map((each) => (
              <li key={each.noteId}>
                <Link to={each.address}>{each.name || t('note.unnamed')}</Link>
                <span className="note-list-desc">{each.folderPath}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
