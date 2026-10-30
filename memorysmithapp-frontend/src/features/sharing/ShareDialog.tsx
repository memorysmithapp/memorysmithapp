import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { OutgoingShareDto, ShareProfileDto } from '@memorysmithapp/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import {
  changeShareProfile,
  getModel,
  listNotebookShares,
  revokeShare,
  shareNotebook,
} from '../../shared/api/source';
import { Modal } from '../../shared/components/Modal';
import { Segmented } from '../../shared/components/Segmented';
import { profileKey, profilesFor, sharesChanged } from './shares';

/**
 * Sharing a notebook with a person who holds another subscription (#256,
 * RN-ACC-031): the e-mail of their account and the profile of the share, and
 * below them who it is already shared with, where each one stands, what each
 * one may do, and the way to change it or take it back (RN-ACC-033).
 *
 * After sharing the dialog says the same thing whatever the e-mail was,
 * because the product does (RN-ACC-025).
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
  const [profile, setProfile] = useState<ShareProfileDto>('reader');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const shares = useQuery({
    queryKey: queryKeys.notebookShares(notebook.id),
    queryFn: () => listNotebookShares(notebook.id),
    enabled: open,
  });
  // A notebook declared as a model is also shared as a model reader, and
  // sharing it distributes it under CC0 1.0, accepted once (#355, #357).
  const model = useQuery({
    queryKey: queryKeys.model(notebook.id),
    queryFn: () => getModel(notebook.id),
    enabled: open,
  });
  const isModel = Boolean(model.data);
  const licenceNeeded = model.data?.licence === null;
  const [licenceAccepted, setLicenceAccepted] = useState(false);
  const profiles = profilesFor(isModel);
  const blocked = licenceNeeded && !licenceAccepted;
  async function changed(): Promise<void> {
    await sharesChanged(client);
    if (isModel) await client.invalidateQueries({ queryKey: queryKeys.model(notebook.id) });
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setFailure(null);
    try {
      await shareNotebook(notebook.id, address, profile, licenceAccepted);
      setSent(address);
      setEmail('');
      await changed();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  async function change(share: OutgoingShareDto, to: ShareProfileDto): Promise<void> {
    setFailure(null);
    try {
      await changeShareProfile(notebook.id, share.granteeUserId, to, licenceAccepted);
      await changed();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
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
            value={profile}
            onChange={setProfile}
            describedBy="share-profile-hint"
            options={profiles.map((each) => ({
              value: each,
              label: t(`sharing.profile.${profileKey(each)}`),
            }))}
          />
          <span id="share-profile-hint" className="field-hint">
            {t(`sharing.profileHint.${profileKey(profile)}`)}
          </span>
        </div>
        {isModel ? (
          <div className="share-licence">
            <p className="callout-warning">{t('sharing.dialog.licence')}</p>
            {licenceNeeded ? (
              <label className="parameter-required">
                <input
                  type="checkbox"
                  checked={licenceAccepted}
                  onChange={(event) => setLicenceAccepted(event.target.checked)}
                />
                {t('sharing.dialog.acceptLicence')}
              </label>
            ) : null}
          </div>
        ) : null}
        <div className="share-form-actions">
          <button
            type="submit"
            className="button is-primary"
            disabled={busy || !email.trim() || blocked}
          >
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
        <p className="hint">{t('sharing.dialog.changeExplained')}</p>
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
                {share.state === 'pending' || share.state === 'accepted' ? (
                  <select
                    className="share-person-profile"
                    aria-label={t('sharing.dialog.profileOf', { email: share.granteeEmail })}
                    value={share.pendingProfile ?? share.profile}
                    onChange={(event) => void change(share, event.target.value as ShareProfileDto)}
                  >
                    {profiles.map((each) => (
                      <option key={each} value={each}>
                        {t(`sharing.profile.${profileKey(each)}`)}
                      </option>
                    ))}
                  </select>
                ) : null}
                {share.pendingProfile ? (
                  <span className="share-person-pending">
                    {t('sharing.dialog.increasePending', {
                      profile: t(`sharing.profile.${profileKey(share.profile)}`),
                    })}
                  </span>
                ) : null}
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
