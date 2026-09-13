import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GuidanceIcon, TemplateIcon } from '../../shared/components/icons';
import type { FolderNode } from '../../shared/types/api';
import { StructureOutline } from './StructureOutline';
import { NotebookBreadcrumb } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';

function countTemplates(folders: FolderNode[]): number {
  return folders.reduce(
    (total, folder) => total + (folder.hasTemplate ? 1 : 0) + countTemplates(folder.children),
    0,
  );
}

// The Notebook Context, in its navigable form: the same object get_notebook_context
// returns as Markdown, with the Guidance and the Templates as entry points
// instead of inline, and the folder tree with the description of every folder.
export function NotebookContextPage() {
  const { t } = useTranslation();
  const { notebookSlug = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const templateCount = countTemplates(structure.folders);

  return (
    <article className="content-pane">
      <NotebookBreadcrumb items={[]} />
      <p className="content-kicker">{t('structure.heading')}</p>
      <h1>{structure.notebook.name}</h1>
      <p className="hint">{t('structure.intro')}</p>

      <div className="structure-actions">
        <Link to={`/notebooks/${notebookSlug}/guidance`} className="structure-action">
          <GuidanceIcon />
          <span>
            <strong>{t('structure.guidance')}</strong>
            <small>{t('structure.guidanceHint')}</small>
          </span>
        </Link>
        <Link to={`/notebooks/${notebookSlug}/templates`} className="structure-action">
          <TemplateIcon />
          <span>
            <strong>{t('structure.templates')}</strong>
            <small>{t('structure.templatesHint', { count: templateCount })}</small>
          </span>
        </Link>
      </div>

      <h2>{t('structure.folders')}</h2>
      <p className="hint">{t('structure.outlineHint')}</p>
      <StructureOutline notebookSlug={notebookSlug} folders={structure.folders} />
    </article>
  );
}
