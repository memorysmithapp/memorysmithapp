import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { OutgoingShareDto } from '@memorysmith/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { listNotebookShares, revokeShare, shareNotebook } from '../../shared/api/source';
import { Modal } from '../../shared/components/Modal';
import { Segmented } from '../../shared/components/Segmented';
import { sharesChanged } from './shares';

/**
 * Sharing a notebook with a person who holds another subscription (#256,
 * RN-ACC-024): the e-mail of their account and the kind of share, and below
 * them who it is already shared with, where each one stands, and the way to
 * take it back.
 *
 * Read and write is shown and cannot be chosen: it is the direction, and no
 * share grants it yet. After sharing the dialog says the same thing whatever
 * the e-mail was, because the product does (RN-ACC-025).
 */
export function ShareDialog({
  notebook,
  open,
  onClose,
}: {
  notebook: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const shares = useQuery({
    queryKey: queryKeys.notebookShares(notebook.id),
    queryFn: () => listNotebookShares(notebook.id),
    enabled: open,
  });

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setFailure(null);
    try {
      await shareNotebook(notebook.id, address);
      setSent(address);
      setEmail('');
      await sharesChanged(client);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(share: OutgoingShareDto): Promise<void> {
    setFailure(null);
    try {
      await revokeShare(notebook.id, share.granteeUserId);
      await sharesChanged(client);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    }
  }

  const listed = shares.data ?? [];

  return (
    <Modal
      open={open}
      title={t('sharing.dialog.title')}
      subtitle={notebook.name}
      onClose={onClose}
      className="share-dialog"
    >
      <form className="share-form" onSubmit={(event) => void submit(event)}>
        <label className="field">
          <span className="field-label">{t('sharing.dialog.email')}</span>
          <input
            type="email"
            value={email}
            autoComplete="off"
            placeholder={t('sharing.dialog.emailPlaceholder')}
            onChange={(event) => {
              setEmail(event.target.value);
              setSent(null);
            }}
          />
        </label>
        <div className="field">
          <span className="field-label">{t('sharing.dialog.access')}</span>
          <Segmented
            label={t('sharing.dialog.access')}
            value="read"
            onChange={() => undefined}
            options={[
              { value: 'read', label: t('sharing.access.read') },
              { value: 'read-write', label: t('sharing.access.readWrite'), disabled: true },
            ]}
          />
          <span className="field-hint">{t('sharing.dialog.readWriteLater')}</span>
        </div>
        <div className="share-form-actions">
          <button type="submit" className="button is-primary" disabled={busy || !email.trim()}>
            {busy ? t('sharing.dialog.sharing') : t('sharing.dialog.share')}
          </button>
        </div>
        {sent ? (
          <p className="share-sent" role="status">
            {t('sharing.dialog.sent', { email: sent })}
          </p>
        ) : null}
        {failure ? (
          <p className="share-failure" role="alert">
            {failure}
          </p>
        ) : null}
      </form>

      <section className="share-people" aria-labelledby="share-people-heading">
        <h3 id="share-people-heading">{t('sharing.dialog.people')}</h3>
        {shares.isPending ? (
          <p className="hint">{t('common.loading')}</p>
        ) : listed.length === 0 ? (
          <p className="hint">{t('sharing.dialog.nobody')}</p>
        ) : (
          <ul>
            {listed.map((share) => (
              <li key={share.granteeUserId} className="share-person">
                <span className="share-person-email">{share.granteeEmail}</span>
                <span className="state-chip" data-state={stateOf(share.state)}>
                  {t(`sharing.state.${share.state}`)}
                </span>
                <button
                  type="button"
                  className="button is-quiet is-small"
                  onClick={() => void revoke(share)}
                >
                  {share.state === 'pending' || share.state === 'accepted'
                    ? t('sharing.dialog.revoke')
                    : t('sharing.dialog.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}

/** The colour of the dot of each state, in the vocabulary the chips already speak. */
function stateOf(state: OutgoingShareDto['state']): string {
  switch (state) {
    case 'accepted':
      return 'ready';
    case 'pending':
      return 'waiting';
    case 'rejected':
      return 'failed';
    case 'left':
      return 'cancelled';
  }
}
