import { useQuery } from '@tanstack/react-query';
import { useLiveInterval } from '../../shared/api/live';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, deleteTemplate, getTemplate, putTemplate } from '../../shared/api/source';
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
            </div>
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
