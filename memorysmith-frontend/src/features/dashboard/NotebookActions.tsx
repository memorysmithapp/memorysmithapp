import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { deleteNotebook } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { Menu, MenuDivider, MenuItem } from '../../shared/components/Menu';
import { MoreIcon } from '../../shared/components/icons';
import type { NotebookSummary } from '../../shared/types/api';
import { NotebookCard } from './NotebookCard';

type Phase = 'idle' | 'confirming' | 'deleting' | 'failed';

/**
 * A notebook card with what can be done to the notebook from it (#199): export
 * it, and — for its owner — delete it. Both sit behind a `⋯` in the corner, so
 * the card still says only "Abrir caderno".
 *
 * Deleting is definitive (RN-KNW-033), and it asks on the card itself, in the
 * pattern the product already uses for Guidance, Templates and exports: the
 * sentence of the consequence, "Manter" and "Apagar de vez", no browser dialog
 * and no name to type. Who sees the item is the role the API answered for
 * that notebook; the API refuses anybody else whatever a screen shows.
 */
export function NotebookActions({
  notebook,
  strip,
  onExport,
}: {
  notebook: NotebookSummary;
  strip: 'blue' | 'orange';
  onExport: (notebookId: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [messageKey, setMessageKey] = useState('errors.unexpected');
  const owner = notebook.effectiveRole === 'OWNER';

  function exportIt() {
    setOpen(false);
    onExport(notebook.id);
  }

  async function confirmed(): Promise<void> {
    setPhase('deleting');
    try {
      await deleteNotebook(notebook.id);
      // The card leaves the row, and the space says what is still held until
      // the purge ends: both read again.
      await client.invalidateQueries({ queryKey: queryKeys.notebooks() });
      void client.invalidateQueries({ queryKey: queryKeys.subscriptionUsage() });
    } catch (error) {
      setMessageKey(messageKeyOf(error));
      setPhase('failed');
    }
  }

  const asking = phase !== 'idle';

  return (
    <NotebookCard
      notebook={notebook}
      strip={asking ? 'danger' : strip}
      corner={
        asking ? null : (
          <div className="notebook-card-corner">
            <button
              ref={trigger}
              type="button"
              className="icon-button is-bare notebook-card-more"
              aria-label={t('dashboard.card.more')}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <MoreIcon />
            </button>
            <Menu
              open={open}
              onClose={() => setOpen(false)}
              trigger={trigger}
              label={t('dashboard.card.more')}
              title={notebook.name}
              className="notebook-card-menu"
            >
              <MenuItem onSelect={exportIt}>{t('dashboard.card.export')}</MenuItem>
              {owner ? (
                <>
                  <MenuDivider />
                  <MenuItem
                    danger
                    onSelect={() => {
                      setOpen(false);
                      setPhase('confirming');
                    }}
                  >
                    {t('dashboard.card.delete')}
                  </MenuItem>
                </>
              ) : null}
            </Menu>
          </div>
        )
      }
    >
      {asking ? (
        <div
          className="notebook-card-confirm"
          role="group"
          aria-labelledby={`delete-${notebook.id}`}
        >
          <h2 id={`delete-${notebook.id}`}>
            {t('dashboard.card.confirmTitle', { name: notebook.name })}
          </h2>
          <p>
            {phase === 'failed' ? (
              t(messageKey)
            ) : (
              <Trans
                i18nKey="dashboard.card.confirmBody"
                components={{
                  b: <strong />,
                  export: <button type="button" className="link-button" onClick={exportIt} />,
                }}
              />
            )}
          </p>
          <div className="notebook-card-confirm-actions">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={phase === 'deleting'}
              onClick={() => setPhase('idle')}
            >
              {t('dashboard.card.keep')}
            </button>
            <button
              type="button"
              className="button is-danger is-filled is-small"
              disabled={phase === 'deleting'}
              onClick={() => void confirmed()}
            >
              {phase === 'deleting'
                ? t('dashboard.card.deleting')
                : t('dashboard.card.deleteForGood')}
            </button>
          </div>
        </div>
      ) : undefined}
    </NotebookCard>
  );
}
