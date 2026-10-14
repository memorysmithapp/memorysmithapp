import { useState, type FormEvent, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { updateFolder } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { Modal } from '../../shared/components/Modal';
import { Sheet } from '../../shared/components/Sheet';
import { useSheetLayout } from '../../shared/components/Menu';
import type { NotebookStructure } from '../../shared/types/api';
import {
  FOLDER_DESCRIPTION_MAX,
  FOLDER_NAME_MAX,
  folderChange,
  folderChanged,
  folderRefusal,
} from './edit-folder';

/**
 * The name and the description of a folder (#278, RN-KNW-058), from the bar
 * of the folder and only for whoever writes in the notebook.
 *
 * The description is what directs the next agent that writes here
 * (RN-KNW-006), and the dialog says so; its limit is counted while it is
 * typed, so it is said before it is hit. A name a sibling folder holds is
 * refused in place, and the dialog stays.
 */
export function EditFolderForm({
  folder,
  busy,
  refusal,
  onSubmit,
  onCancel,
}: {
  folder: { name: string; description: string };
  busy: boolean;
  refusal: string | null;
  onSubmit: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(folder.name);
  const [description, setDescription] = useState(folder.description);
  const used = description.trim().length;
  const tooLong = used > FOLDER_DESCRIPTION_MAX;
  const empty = name.trim().length === 0 || used === 0;
  const unchanged = Object.keys(folderChange(folder, name, description)).length === 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!empty && !tooLong && !unchanged) onSubmit(name, description);
  }

  return (
    <form className="move-form folder-edit-form" onSubmit={submit}>
      <div className="transfer-field">
        <label htmlFor="folder-edit-name">{t('folderEdit.name')}</label>
        <input
          id="folder-edit-name"
          value={name}
          maxLength={FOLDER_NAME_MAX}
          aria-invalid={refusal ? true : undefined}
          aria-describedby={refusal ? 'folder-edit-refusal' : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="transfer-field">
        <label htmlFor="folder-edit-description">{t('folderEdit.description')}</label>
        <textarea
          id="folder-edit-description"
          value={description}
          rows={5}
          aria-invalid={tooLong ? true : undefined}
          aria-describedby="folder-edit-description-hint"
          onChange={(event) => setDescription(event.target.value)}
        />
        <p id="folder-edit-description-hint" className="field-hint folder-edit-hint">
          <span>{t('folderEdit.descriptionHint')}</span>
          <span className={tooLong ? 'folder-edit-count is-over' : 'folder-edit-count'}>
            {t('folderEdit.count', { used, max: FOLDER_DESCRIPTION_MAX })}
          </span>
        </p>
      </div>
      <p className="hint">{t('folderEdit.explain')}</p>
      {refusal ? (
        <p id="folder-edit-refusal" className="move-refusal" role="alert">
          {refusal}
        </p>
      ) : null}
      <div className="ask-dialog-foot">
        <button type="button" className="button is-quiet" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="button is-primary"
          disabled={busy || empty || tooLong || unchanged}
        >
          {busy ? t('folderEdit.saving') : t('folderEdit.save')}
        </button>
      </div>
    </form>
  );
}

/**
 * Where the folder is edited: a modal on a computer, named after the folder,
 * and a sheet on a phone, as moving a note is.
 */
export function EditFolderDialog({
  open,
  onClose,
  notebookId,
  folder,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  notebookId: string;
  folder: { id: string; name: string; description: string };
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const sheet = useSheetLayout();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  if (!open) return null;

  function close() {
    setRefusal(null);
    onClose();
  }

  async function save(name: string, description: string) {
    const change = folderChange(folder, name, description);
    setBusy(true);
    setRefusal(null);
    try {
      await updateFolder(notebookId, folder.id, change);
      // The tree, the trail and this page show it at once; the read confirms.
      client.setQueryData<NotebookStructure>(queryKeys.notebookStructure(notebookId), (current) =>
        current ? folderChanged(current, folder.id, change) : current,
      );
      void client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
      close();
    } catch (error) {
      setRefusal(folderRefusal(error, t, change.name ?? folder.name));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <EditFolderForm
      folder={folder}
      busy={busy}
      refusal={refusal}
      onSubmit={(name, description) => void save(name, description)}
      onCancel={close}
    />
  );

  return sheet ? (
    <Sheet
      open
      onClose={close}
      label={t('folderEdit.title')}
      title={t('folderEdit.title')}
      className="move-sheet"
      returnFocus={returnFocus}
    >
      {form}
    </Sheet>
  ) : (
    <Modal
      open
      title={t('folderEdit.title')}
      subtitle={folder.name}
      onClose={close}
      className="move-dialog"
    >
      {form}
    </Modal>
  );
}
