import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, putGuidance } from '../../shared/api/source';
import { WritableContent } from '../../shared/components/WritableContent';
import { NotebookBreadcrumb } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';

export function GuidancePanel() {
  const { t } = useTranslation();
  const { notebookSlug = '' } = useParams();
  const { structure } = useOutletContext<NotebookOutletContext>();

  return (
    <article className="content-pane">
      <NotebookBreadcrumb items={[{ label: t('structure.guidance') }]} />
      <p className="content-kicker">{t('structure.guidance')}</p>
      {structure.guidance ? (
        <WritableContent
          raw={structure.guidance}
          notebookSlug={notebookSlug}
          baseRevision={structure.guidanceRevision}
          writable={canWrite(structure.effectiveRole)}
          write={({ raw, baseRevision, keepalive }) =>
            putGuidance(notebookSlug, raw, baseRevision, { keepalive: keepalive ?? false })
          }
          invalidates={['notebook-structure', notebookSlug]}
        />
      ) : (
        <p className="status">{t('common.notFound')}</p>
      )}
    </article>
  );
}
