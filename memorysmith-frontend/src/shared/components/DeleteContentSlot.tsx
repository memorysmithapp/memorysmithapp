import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { messageKeyOf } from '../api/error-mapper';

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
  confirmation,
  remove,
  invalidates,
}: {
  /** The sentence that says what goes and what stays, in the active locale. */
  confirmation: string;
  remove: () => Promise<void>;
  invalidates: unknown[];
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
      <button type="button" className="slot-delete" onClick={() => setPhase('confirming')}>
        {t('slot.delete')}
      </button>
    );
  }

  return (
    <div className="slot-delete-confirm">
      <p>{phase === 'failed' ? t(messageKey) : confirmation}</p>
      <button
        type="button"
        className="slot-delete"
        onClick={() => void confirmed()}
        disabled={phase === 'deleting'}
      >
        {phase === 'deleting' ? t('slot.deleting') : t('slot.confirm')}
      </button>
      <button type="button" className="slot-delete-cancel" onClick={() => setPhase('idle')}>
        {t('slot.cancel')}
      </button>
    </div>
  );
}
