import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteTemplate, getTemplate, putTemplate } from '../../shared/api/source';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { NoteContent } from '../../shared/components/NoteContent';
import { queryKeys } from '../../shared/api/query-keys';
import type { TemplateDetail } from '../../shared/types/api';
import { useSlotEditing } from './slot-editing';

/**
 * The Template of a folder, read and written in place (#301). Two screens draw
 * it, the folder and the page of the Templates, and both write it the same
 * way: the pencil at its top right edits it with the editor of a note, and its
 * deletion asks in the page (RN-KNW-045). A folder with no Template is offered
 * an empty one to whoever may write, which its first save creates.
 */
export function TemplateBody({
  notebookId,
  folder,
  template,
  writable,
}: {
  notebookId: string;
  folder: { id: string; name: string };
  /** `null` when the folder declares none. */
  template: TemplateDetail | null;
  writable: boolean;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  // Which folders have a Template is part of the tree, so a first save and a
  // deletion read the structure again as well as the Template.
  const invalidates = [
    queryKeys.template(notebookId, folder.id),
    queryKeys.notebookStructure(notebookId),
  ] as const;
  const editing = useSlotEditing({
    notebookId,
    id: `template:${folder.id}`,
    raw: template?.body ?? '',
    revision: template?.revision ?? null,
    purpose: t('editor.attachPurposeTemplate', { folder: folder.name }),
    writable,
    write: async (content, baseRevision, keepalive) => {
      const revision = await putTemplate(notebookId, folder.id, content, baseRevision, {
        keepalive,
      });
      /**
       * The Template as it now is, before the tree is read again: the first
       * save of a folder's Template turns the folder into one that has one,
       * and a page that then waited to read it drew a placeholder in place of
       * the editor, which ended the session under the person typing.
       */
      client.setQueryData<TemplateDetail>(queryKeys.template(notebookId, folder.id), {
        folderId: folder.id,
        body: content,
        revision,
      });
      return revision;
    },
    reload: async () => {
      const fresh = await getTemplate(notebookId, folder.id);
      return { raw: fresh?.body ?? '', revision: fresh?.revision ?? '' };
    },
    invalidates,
  });
  const editingNow = editing?.mode === 'edit';

  return (
    <>
      {!template && !editingNow ? (
        <p className="page-intro">{t('folder.noTemplateWrite')}</p>
      ) : null}
      <NoteContent
        raw={template?.body ?? ''}
        notebookId={notebookId}
        baseRevision={template?.revision ?? null}
        writable={writable}
        write={({ raw, baseRevision, keepalive }) =>
          putTemplate(notebookId, folder.id, raw, baseRevision, { keepalive: keepalive ?? false })
        }
        invalidates={queryKeys.template(notebookId, folder.id)}
        {...(editing ? { editing } : {})}
      />
      {writable && template && !editingNow ? (
        <DeleteContentSlot
          label={t('folder.deleteTemplate')}
          confirmation={t('folder.deleteTemplateConfirm')}
          remove={() => deleteTemplate(notebookId, folder.id)}
          // The tree carries which folders have a Template, so the structure
          // is read again and not only this Template.
          invalidates={queryKeys.notebookStructure(notebookId)}
        />
      ) : null}
    </>
  );
}
