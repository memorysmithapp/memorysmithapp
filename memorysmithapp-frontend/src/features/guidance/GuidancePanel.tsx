import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deleteGuidance, getNotebookStructure, putGuidance } from '../../shared/api/source';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { NoteContent } from '../../shared/components/NoteContent';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar, contextCrumbs } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useSlotEditing } from '../structure/slot-editing';
import { queryKeys } from '../../shared/api/query-keys';

export function GuidancePanel() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const writable = structure.permissions.maintain;

  useDocumentTitle(t('structure.guidance'), structure.notebook.name);

  /**
   * The Guidance is written in place by whoever may write in the notebook
   * (#301), with the editor of a note; one that does not exist yet is written
   * from an empty page, and its first save creates it.
   */
  const editing = useSlotEditing({
    notebookId,
    id: `guidance:${notebookId}`,
    raw: structure.guidance ?? '',
    revision: structure.guidanceRevision,
    purpose: t('editor.attachPurposeGuidance'),
    writable,
    write: (content, baseRevision, keepalive) =>
      putGuidance(notebookId, content, baseRevision, { keepalive }),
    reload: async () => {
      const fresh = await getNotebookStructure(notebookId);
      return { raw: fresh.guidance ?? '', revision: fresh.guidanceRevision ?? '' };
    },
    invalidates: [queryKeys.notebookStructure(notebookId)],
  });
  const editingNow = editing?.mode === 'edit';

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('structure.guidance'))} />
      <article className="content-pane">
        {structure.guidance || writable ? (
          <>
            {!structure.guidance && !editingNow ? (
              <p className="page-intro">{t('structure.noGuidanceWrite')}</p>
            ) : null}
            <NoteContent
              raw={structure.guidance ?? ''}
              notebookId={notebookId}
              baseRevision={structure.guidanceRevision}
              writable={writable}
              write={({ raw, baseRevision, keepalive }) =>
                putGuidance(notebookId, raw, baseRevision, { keepalive: keepalive ?? false })
              }
              invalidates={queryKeys.notebookStructure(notebookId)}
              {...(editing ? { editing } : {})}
            />
            {writable && structure.guidance && !editingNow ? (
              <DeleteContentSlot
                label={t('structure.deleteGuidance')}
                confirmation={t('structure.deleteGuidanceConfirm')}
                remove={() => deleteGuidance(notebookId)}
                invalidates={queryKeys.notebookStructure(notebookId)}
              />
            ) : null}
          </>
        ) : (
          <p className="status">{t('common.notFound')}</p>
        )}
      </article>
    </>
  );
}
