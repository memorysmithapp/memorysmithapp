import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { deleteFolder } from '../../shared/api/source';
import { Modal } from '../../shared/components/Modal';
import type { FolderNode } from '../../shared/types/api';

/** How many notes and folders a folder holds, at every depth. */
export function contentsOf(folder: FolderNode): { notes: number; folders: number } {
  return folder.children.reduce(
    (total, child) => {
      const inside = contentsOf(child);
      return { notes: total.notes + inside.notes, folders: total.folders + 1 + inside.folders };
    },
    { notes: folder.notes.length, folders: 0 },
  );
}

/**
 * Deleting a folder (#350, RN-KNW-007, RN-KNW-046), for whoever may maintain
 * the notebook, a notebook editor of a share included.
 *
 * Deleting is one write that takes the folder and everything under it out of
 * reach at once, and nothing brings it back; what was inside is destroyed in
 * the background. So a folder that holds anything says what, and what follows,
 * and is deleted only once the person ticks that they understood: the
 * confirmation is explicit, never a second click on the same place.
 */
export function DeleteFolderDialog({
  open,
  onClose,
  notebookId,
  folder,
  parentAddress,
}: {
  open: boolean;
  onClose: () => void;
  notebookId: string;
  folder: FolderNode;
  /** Where the page goes once the folder is gone. */
  parentAddress: string;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!open) return null;

  const inside = contentsOf(folder);
  const populated = inside.notes > 0 || inside.folders > 0;

  async function remove(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await deleteFolder(notebookId, folder.id);
      await client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
      navigate(parentAddress);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t('folderDelete.title')}
      subtitle={folder.name}
      onClose={onClose}
      className="move-dialog folder-delete-dialog"
    >
      <div className="folder-delete">
        {populated ? (
          <>
            <p>
              {t('folderDelete.holds', {
                notes: t('folderDelete.notes', { count: inside.notes }),
                folders: t('folderDelete.folders', { count: inside.folders }),
              })}
            </p>
            <p>{t('folderDelete.consequences')}</p>
            <label className="folder-delete-understood">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              <span>{t('folderDelete.understood')}</span>
            </label>
          </>
        ) : (
          <p>{t('folderDelete.empty')}</p>
        )}
        {failure ? (
          <p className="move-refusal" role="alert">
            {failure}
          </p>
        ) : null}
        <div className="ask-dialog-foot">
          <button type="button" className="button is-quiet" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button is-danger is-filled"
            disabled={busy || (populated && !understood)}
            onClick={() => void remove()}
          >
            {busy ? t('folderDelete.deleting') : t('folderDelete.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
