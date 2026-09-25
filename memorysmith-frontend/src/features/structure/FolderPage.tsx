import { useQuery } from '@tanstack/react-query';
import { useLiveInterval } from '../../shared/api/live';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, deleteTemplate, getTemplate, putTemplate } from '../../shared/api/source';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { folderAddress, identifierOf, noteAddress } from '../../shared/api/note-address';
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

  return (
    <>
      <NotebookBar
        crumbs={[...folderCrumbs(notebookId, chain.slice(0, -1)), { label: folder.name }]}
      />
      <article className="content-pane">
        <p className="folder-description">{folder.description}</p>

        {folder.hasTemplate && template && (
          <details className="template-box">
            <summary>{t('folder.template')}</summary>
            <p className="hint">{t('folder.templateHint')}</p>
            <WritableContent
              raw={template.body}
              notebookId={notebookId}
              baseRevision={template.revision}
              writable={canWrite(structure.effectiveRole)}
              write={({ raw, baseRevision, keepalive }) =>
                putTemplate(notebookId, folder.id, raw, baseRevision, {
                  keepalive: keepalive ?? false,
                })
              }
              invalidates={queryKeys.template(notebookId, folder.id)}
            />
            {canWrite(structure.effectiveRole) && (
              <DeleteContentSlot
                confirmation={t('folder.deleteTemplateConfirm')}
                remove={() => deleteTemplate(notebookId, folder.id)}
                // The tree carries which folders have a Template, so the
                // structure is read again and not only this Template.
                invalidates={queryKeys.notebookStructure(notebookId)}
              />
            )}
          </details>
        )}

        <h2>{t('folder.notesHeading')}</h2>
        {folder.notes.length === 0 && folder.children.length === 0 && <p>{t('folder.empty')}</p>}
        <ul className="note-list">
          {folder.children.map((child) => (
            <li key={child.id}>
              <Link to={folderAddress(notebookId, child.id)} className="note-list-folder">
                {child.name}/
              </Link>
              <span className="note-list-desc">{child.description}</span>
            </li>
          ))}
          {folder.notes.map((note) => (
            <li key={note.id}>
              <Link to={noteAddress(notebookId, note.id)}>{note.name ?? t('note.unnamed')}</Link>
            </li>
          ))}
        </ul>
      </article>
    </>
  );
}
