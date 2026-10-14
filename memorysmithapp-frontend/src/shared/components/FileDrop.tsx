import { useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Where a person gives a file (#253, RN-KNW-055), in any of the three ways a
 * file is at hand: **chosen** from the disk, **dragged** onto the area, or
 * **pasted** from the clipboard — a screenshot, most often, which has no file
 * on the disk to choose.
 *
 * Pasting reaches the area while it has the focus, which the button inside it
 * gives, so a paste elsewhere on the page never gives a file by surprise.
 */
export function FileDrop({
  onFile,
  disabled = false,
  accept,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  /** The type the file should be, which the picker offers first. */
  accept?: string | undefined;
}) {
  const { t } = useTranslation();
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const give = (files: FileList | null | undefined): boolean => {
    const file = files?.[0];
    if (!file || disabled) return false;
    onFile(file);
    return true;
  };

  return (
    <div
      className={`file-drop${over ? ' is-over' : ''}${disabled ? ' is-disabled' : ''}`}
      role="group"
      aria-label={t('fileDrop.label')}
      tabIndex={disabled ? -1 : 0}
      onDragOver={(event: DragEvent) => {
        if (disabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event: DragEvent) => {
        setOver(false);
        if (give(event.dataTransfer.files)) event.preventDefault();
      }}
      onPaste={(event: ClipboardEvent) => {
        if (give(event.clipboardData.files)) event.preventDefault();
      }}
    >
      <p className="file-drop-hint">{t('fileDrop.hint')}</p>
      <button
        type="button"
        className="button is-primary is-small"
        disabled={disabled}
        onClick={() => picker.current?.click()}
      >
        {t('fileDrop.choose')}
      </button>
      <input
        ref={picker}
        type="file"
        hidden
        {...(accept ? { accept } : {})}
        onChange={(event) => {
          const files = event.target.files;
          give(files);
          event.target.value = '';
        }}
      />
    </div>
  );
}
