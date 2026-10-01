import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveInterval } from '../../shared/api/live';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  canWrite,
  deleteTemplate,
  getTemplate,
  putTemplate,
  setNoteOrder,
} from '../../shared/api/source';
import { Segmented } from '../../shared/components/Segmented';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { identifierOf, noteAddress } from '../../shared/api/note-address';
import { ChevronRightIcon } from '../../shared/components/icons';
import { TemplateSkeleton } from '../../shared/components/skeletons';
import { FolderRows } from './FolderRows';
import { WritableContent } from '../../shared/components/WritableContent';
import { useDocumentTitle } from '../../shared/components/document-title';
import type { NotebookOutletContext } from './NotebookLayout';
import { folderTrailOf } from './trail';
import { NotebookBar, folderCrumbs } from './NotebookBreadcrumb';
import { useNotebookId } from './route-ids';
import { queryKeys } from '../../shared/api/query-keys';

/**
 * A folder, addressed by its identifier alone (RN-DSC-045). Renaming it or
 * moving it changes nothing about reaching it, and an address that once
 * named a folder that was deleted names nothing, even if another folder took
 * its name since (RN-DSC-057).
 */
export function FolderPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { folderId: segment } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const folderId = identifierOf(segment);
  const chain = folderId ? folderTrailOf(structure.folders, folderId) : [];
  const folder = chain[chain.length - 1] ?? null;

  useDocumentTitle(folder?.name, structure.notebook.name);

  /**
   * How the notes of this folder are ordered (RN-KNW-056). The order is the
   * server's, so after a change the structure is read again rather than the
   * notes sorted here: the tree, this page and the agent see one order.
   */
  const client = useQueryClient();
  const ordering = useMutation({
    mutationFn: (noteOrder: 'manual' | 'alphabetical') =>
      setNoteOrder(notebookId, folder?.id ?? '', noteOrder),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) }),
  });

  const { data: template } = useQuery({
    queryKey: queryKeys.template(notebookId, folder?.id),
    refetchInterval: useLiveInterval(),
    queryFn: () => getTemplate(notebookId, folder?.id ?? ''),
    enabled: Boolean(folder?.hasTemplate),
  });

  if (!folder) return <p className="status">{t('common.notFound')}</p>;

  const writable = canWrite(structure.effectiveRole);
  const empty = folder.notes.length === 0 && folder.children.length === 0;

  // The folder is named by the trail, and never again under it (#225): the
  // page is what it keeps — the description, its Template, and its subfolders
  // and notes as two groups (#231).
  return (
    <>
      <NotebookBar
        crumbs={[...folderCrumbs(notebookId, chain.slice(0, -1)), { label: folder.name }]}
      />
      <article className="content-pane folder-page">
        <p className="folder-description">{folder.description}</p>

        {folder.hasTemplate && (
          <details className="template-card">
            <summary>
              <ChevronRightIcon className="template-card-chevron" />
              <span className="template-card-title is-inline">{t('folder.template')}</span>
              <span className="template-card-hint">{t('folder.templateCardHint')}</span>
            </summary>
            <div className="template-card-body">
              {template ? (
                <>
                  <WritableContent
                    raw={template.body}
                    notebookId={notebookId}
                    baseRevision={template.revision}
                    writable={writable}
                    write={({ raw, baseRevision, keepalive }) =>
                      putTemplate(notebookId, folder.id, raw, baseRevision, {
                        keepalive: keepalive ?? false,
                      })
                    }
                    invalidates={queryKeys.template(notebookId, folder.id)}
                  />
                  {writable && (
                    <DeleteContentSlot
                      label={t('folder.deleteTemplate')}
                      confirmation={t('folder.deleteTemplateConfirm')}
                      remove={() => deleteTemplate(notebookId, folder.id)}
                      // The tree carries which folders have a Template, so the
                      // structure is read again and not only this Template.
                      invalidates={queryKeys.notebookStructure(notebookId)}
                    />
                  )}
                </>
              ) : (
                <TemplateSkeleton />
              )}
            </div>
          </details>
        )}

        {empty && <p className="folder-empty">{t('folder.empty')}</p>}

        {folder.children.length > 0 && (
          <section className="folder-group" aria-labelledby="folder-subfolders">
            <div className="folder-group-head">
              <h2 id="folder-subfolders">{t('folder.subfolders')}</h2>
              <span>{folder.children.length}</span>
            </div>
            <FolderRows notebookId={notebookId} folders={folder.children} nested={false} />
          </section>
        )}

        {folder.notes.length > 0 && (
          <section className="folder-group" aria-labelledby="folder-notes">
            <div className="folder-group-head">
              <h2 id="folder-notes">{t('folder.notesHeading')}</h2>
              <span>{folder.notes.length}</span>
              {writable ? (
                <span className="folder-note-order">
                  <Segmented
                    label={t('folder.noteOrder')}
                    value={
                      ordering.isPending
                        ? (ordering.variables ?? folder.noteOrder)
                        : folder.noteOrder
                    }
                    onChange={(next) => {
                      if (next !== folder.noteOrder) ordering.mutate(next);
                    }}
                    options={[
                      { value: 'manual', label: t('folder.noteOrderManual') },
                      { value: 'alphabetical', label: t('folder.noteOrderAlphabetical') },
                    ]}
                  />
                </span>
              ) : folder.noteOrder === 'alphabetical' ? (
                <span className="folder-note-order is-said">{t('folder.notesByName')}</span>
              ) : null}
            </div>
            {ordering.isError && (
              <p className="folder-note-order-error" role="alert">
                {t('folder.noteOrderFailed')}
              </p>
            )}
            <ul className="row-card">
              {folder.notes.map((note) => (
                <li key={note.id}>
                  <Link to={noteAddress(notebookId, note.id)} className="note-row">
                    {note.name ?? t('note.unnamed')}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
