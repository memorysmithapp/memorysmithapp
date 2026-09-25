import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { messageKeyOf } from '../api/error-mapper';
import type { InterfaceQueryKey } from '../api/query-keys';

type Phase = 'idle' | 'confirming' | 'deleting' | 'failed';

/**
 * Deleting the Guidance of a notebook or the Template of a folder, which are
 * the two Content Slots that are not notes (RN-KNW-045).
 *
 * It asks before it does it, and it asks in the page rather than in a browser
 * dialog: what a person needs in order to answer is what SURVIVES the
 * deletion, and that sentence does not fit in a dialog title. Two surfaces
 * write each slot — the folder page and the page of Templates write the same
 * Template — so the button lives here once, as the reading surface does.
 *
 * There is no undo, and the copy does not promise one.
 */
export function DeleteContentSlot({
  label,
  confirmation,
  remove,
  invalidates,
}: {
  /** What the button deletes, named: *Apagar a Orientação*, *Apagar o Modelo* (#230). */
  label: string;
  /** The sentence that says what goes and what stays, in the active locale. */
  confirmation: string;
  remove: () => Promise<void>;
  /**
   * What to read again once this write lands. It is typed as a key this
   * interface actually HOLDS (#170): `unknown[]` accepted a key nobody
   * registered, and invalidating one of those is a silent no-op.
   */
  invalidates: InterfaceQueryKey;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [messageKey, setMessageKey] = useState('errors.unexpected');

  async function confirmed(): Promise<void> {
    setPhase('deleting');
    try {
      await remove();
      // What the screen holds is not what the server holds any more: read it
      // again, exactly as a write of the same slot does.
      void client.invalidateQueries({ queryKey: invalidates });
      setPhase('idle');
    } catch (error) {
      setMessageKey(messageKeyOf(error));
      setPhase('failed');
    }
  }

  if (phase === 'idle') {
    return (
      <div className="slot-delete">
        <button
          type="button"
          className="button is-quiet is-small slot-delete-button"
          onClick={() => setPhase('confirming')}
        >
          {label}
        </button>
      </div>
    );
  }

  // The question in bold, and what survives after it, as the card of Home asks
  // before deleting a notebook (#199).
  const sentence = phase === 'failed' ? t(messageKey) : confirmation;
  const cut = phase === 'failed' ? -1 : sentence.indexOf('?');
  return (
    <div className="slot-delete is-confirming" role="group" aria-label={label}>
      <p>
        {cut > 0 ? (
          <>
            <strong>{sentence.slice(0, cut + 1)}</strong>
            {sentence.slice(cut + 1)}
          </>
        ) : (
          sentence
        )}
      </p>
      <div className="slot-delete-actions">
        <button
          type="button"
          className="button is-quiet is-small"
          disabled={phase === 'deleting'}
          onClick={() => setPhase('idle')}
        >
          {t('slot.cancel')}
        </button>
        <button
          type="button"
          className="button is-danger is-filled is-small"
          onClick={() => void confirmed()}
          disabled={phase === 'deleting'}
        >
          {phase === 'deleting' ? t('slot.deleting') : t('slot.confirm')}
        </button>
      </div>
    </div>
  );
}
