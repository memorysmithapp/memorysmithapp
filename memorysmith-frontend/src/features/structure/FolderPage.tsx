import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, getTemplate, putTemplate } from '../../shared/api/source';
import { noteAddress } from '../../shared/api/note-address';
import { WritableContent } from '../../shared/components/WritableContent';
import type { NotebookOutletContext } from './NotebookLayout';
import { folderTrail } from './trail';
import { NotebookBreadcrumb, folderCrumbs } from './NotebookBreadcrumb';

export function FolderPage() {
  const { t } = useTranslation();
  const { notebookSlug = '', '*': slugPath = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const chain = folderTrail(structure.folders, slugPath);
  const folder = chain[chain.length - 1] ?? null;

  const { data: template } = useQuery({
    queryKey: ['template', notebookSlug, folder?.id],
    queryFn: () => getTemplate(notebookSlug, folder?.id ?? ''),
    enabled: Boolean(folder?.hasTemplate),
  });

  if (!folder) return <p className="status">{t('common.notFound')}</p>;

  return (
    <article className="content-pane">
      <NotebookBreadcrumb
        items={[
          { label: t('structure.root'), to: `/notebooks/${notebookSlug}/root` },
          ...folderCrumbs(notebookSlug, chain),
        ]}
      />
      <h1>{folder.name}</h1>
      <p className="folder-description">{folder.description}</p>

      {folder.hasTemplate && template && (
        <details className="template-box">
          <summary>{t('folder.template')}</summary>
          <p className="hint">{t('folder.templateHint')}</p>
          <WritableContent
            raw={template.body}
            notebookSlug={notebookSlug}
            baseRevision={template.revision}
            writable={canWrite(structure.effectiveRole)}
            write={({ raw, baseRevision, keepalive }) =>
              putTemplate(notebookSlug, folder.id, raw, baseRevision, {
                keepalive: keepalive ?? false,
              })
            }
            invalidates={['template', notebookSlug, folder.id]}
          />
        </details>
      )}

      <h2>{t('folder.notesHeading')}</h2>
      {folder.notes.length === 0 && folder.children.length === 0 && <p>{t('folder.empty')}</p>}
      <ul className="note-list">
        {folder.children.map((child) => (
          <li key={child.id}>
            <Link
              to={`/notebooks/${notebookSlug}/root/${child.slugPath}`}
              className="note-list-folder"
            >
              {child.name}/
            </Link>
            <span className="note-list-desc">{child.description}</span>
          </li>
        ))}
        {folder.notes.map((note) => (
          <li key={note.id}>
            <Link to={noteAddress(notebookSlug, folder.slugPath, note.name, note.id)}>
              {note.name ?? t('note.unnamed')}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
