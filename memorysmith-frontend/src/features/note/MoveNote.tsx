import { useState, type FormEvent, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { moveNote } from '../../shared/api/source';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { Modal } from '../../shared/components/Modal';
import { Sheet } from '../../shared/components/Sheet';
import { useSheetLayout } from '../../shared/components/Menu';
import type { NotebookStructure } from '../../shared/types/api';
import { folderChoices, moveRefusal, movedInto, type FolderChoice } from './move';

/**
 * The note to another folder of its notebook (#265, RN-KNW-057), from the bar
 * of the note and only for whoever writes in it.
 *
 * It says what a person would fear before they choose: the history goes with
 * the note, and the links keep working, because a link finds a note by its
 * name. The destination is any other folder of the notebook; where in it is
 * asked only of a folder kept by hand that holds notes, since a folder
 * ordered by name places the note by its name. A name the destination already
 * holds is refused there, naming the note that holds it, and the dialog stays.
 */
export function MoveNoteForm({
  notebookId,
  note,
  folders,
  busy,
  refusal,
  onSubmit,
  onCancel,
}: {
  notebookId: string;
  note: { id: string; folderId: string };
  folders: readonly FolderChoice[];
  busy: boolean;
  refusal: { message: string; holder: string | null } | null;
  onSubmit: (destination: FolderChoice, afterNoteId: string | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const others = folders.filter((folder) => folder.id !== note.folderId);
  const [folderId, setFolderId] = useState(others[0]?.id ?? '');
  const [after, setAfter] = useState('');
  const destination = others.find((folder) => folder.id === folderId) ?? null;
  const anchors =
    destination?.noteOrder === 'manual'
      ? destination.notes.filter((each) => each.id !== note.id)
      : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (destination) onSubmit(destination, after || null);
  }

  return (
    <form className="move-form" onSubmit={submit}>
      <p className="move-explain">{t('move.explain')}</p>
      {others.length === 0 ? (
        <p className="hint">{t('move.noOther')}</p>
      ) : (
        <div className="transfer-field">
          <label htmlFor="move-note-folder">{t('move.folder')}</label>
          <select
            id="move-note-folder"
            value={folderId}
            onChange={(event) => {
              setFolderId(event.target.value);
              setAfter('');
            }}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id} disabled={folder.id === note.folderId}>
                {folder.id === note.folderId
                  ? t('move.current', { folder: folder.label })
                  : folder.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {destination?.noteOrder === 'alphabetical' ? (
        <p className="hint">{t('move.byName')}</p>
      ) : anchors.length > 0 ? (
        <div className="transfer-field">
          <label htmlFor="move-note-after">{t('move.where')}</label>
          <select id="move-note-after" value={after} onChange={(e) => setAfter(e.target.value)}>
            <option value="">{t('move.atEnd')}</option>
            {anchors.map((each) => (
              <option key={each.id} value={each.id}>
                {t('move.after', { name: each.name ?? t('note.unnamed') })}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {refusal ? (
        <p className="move-refusal" role="alert">
          {refusal.message}{' '}
          {refusal.holder ? (
            <Link to={noteAddress(notebookId, refusal.holder)} onClick={onCancel}>
              {t('move.openHolder')}
            </Link>
          ) : null}
        </p>
      ) : null}
      <div className="ask-dialog-foot">
        <button type="button" className="button is-quiet" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="button is-primary" disabled={busy || !destination}>
          {busy ? t('move.moving') : t('move.move')}
        </button>
      </div>
    </form>
  );
}

/**
 * Where the move is chosen: the modal of the Controles on a computer, named
 * after the note, and a sheet on a phone, as the history is (#226).
 */
export function MoveNoteDialog({
  open,
  onClose,
  onMoved,
  notebookId,
  note,
  structure,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  /** Told the trail of the folder the note now lives in. */
  onMoved: (folder: string) => void;
  notebookId: string;
  note: { id: string; name: string; folderId: string };
  structure: NotebookStructure;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const sheet = useSheetLayout();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{ message: string; holder: string | null } | null>(null);

  if (!open) return null;

  function close() {
    setRefusal(null);
    onClose();
  }

  async function move(destination: FolderChoice, afterNoteId: string | null) {
    setBusy(true);
    setRefusal(null);
    try {
      await moveNote(notebookId, note.id, destination.id, afterNoteId);
      // The tree shows it where it went at once; the reads after it confirm.
      client.setQueryData<NotebookStructure>(queryKeys.notebookStructure(notebookId), (current) =>
        current ? movedInto(current, note.id, destination.id, afterNoteId) : current,
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.note(notebookId, note.id) }),
        client.invalidateQueries({ queryKey: queryKeys.noteHistory(notebookId, note.id) }),
      ]);
      onMoved(destination.label);
      close();
    } catch (error) {
      setRefusal(moveRefusal(error, t, destination.label));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <MoveNoteForm
      notebookId={notebookId}
      note={note}
      folders={folderChoices(structure.folders)}
      busy={busy}
      refusal={refusal}
      onSubmit={(destination, after) => void move(destination, after)}
      onCancel={close}
    />
  );

  return sheet ? (
    <Sheet
      open
      onClose={close}
      label={t('move.title')}
      title={t('move.title')}
      className="move-sheet"
      returnFocus={returnFocus}
    >
      {form}
    </Sheet>
  ) : (
    <Modal
      open
      title={t('move.title')}
      subtitle={note.name}
      onClose={close}
      className="move-dialog"
    >
      {form}
    </Modal>
  );
}
