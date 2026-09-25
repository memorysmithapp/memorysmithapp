import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, deleteGuidance, putGuidance } from '../../shared/api/source';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { WritableContent } from '../../shared/components/WritableContent';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar, contextCrumbs } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { queryKeys } from '../../shared/api/query-keys';

export function GuidancePanel() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();

  useDocumentTitle(t('structure.guidance'), structure.notebook.name);

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('structure.guidance'))} />
      <article className="content-pane">
        {structure.guidance ? (
          <>
            <WritableContent
              raw={structure.guidance}
              notebookId={notebookId}
              baseRevision={structure.guidanceRevision}
              writable={canWrite(structure.effectiveRole)}
              write={({ raw, baseRevision, keepalive }) =>
                putGuidance(notebookId, raw, baseRevision, { keepalive: keepalive ?? false })
              }
              invalidates={queryKeys.notebookStructure(notebookId)}
            />
            {canWrite(structure.effectiveRole) && (
              <DeleteContentSlot
                confirmation={t('structure.deleteGuidanceConfirm')}
                remove={() => deleteGuidance(notebookId)}
                invalidates={queryKeys.notebookStructure(notebookId)}
              />
            )}
          </>
        ) : (
          <p className="status">{t('common.notFound')}</p>
        )}
      </article>
    </>
  );
}
