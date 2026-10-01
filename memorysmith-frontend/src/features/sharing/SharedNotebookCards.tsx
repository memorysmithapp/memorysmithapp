import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { IncomingShareDto } from '@memorysmith/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { answerShare, leaveShare } from '../../shared/api/source';
import { Menu, MenuDivider, MenuItem } from '../../shared/components/Menu';
import { MoreIcon } from '../../shared/components/icons';
import type { NotebookSummary } from '../../shared/types/api';
import { CardGraphDrawing } from '../dashboard/card-graphs';
import { NotebookCard } from '../dashboard/NotebookCard';
import { OwnershipMark } from './OwnershipMark';
import { sharesChanged } from './shares';

/**
 * A notebook shared with me and accepted, as a card of Home (#256): what a
 * notebook of mine shows, plus whose it is. Behind its `⋯`, exporting it to my
 * own Transfers and leaving it (RN-ACC-027, RN-ACC-028).
 */
export function AcceptedShareCard({
  share,
  strip,
  onExport,
}: {
  share: IncomingShareDto;
  strip: 'blue' | 'orange';
  onExport: (notebookId: string) => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notifyOwner, setNotifyOwner] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const notebook: NotebookSummary = {
    id: share.notebookId,
    slug: '',
    name: share.name,
    description: share.description,
    noteCount: share.noteCount ?? 0,
    updatedAt: share.updatedAt ?? share.sharedAt,
    effectiveRole: 'VIEWER',
  };

  async function leave(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await leaveShare(share.notebookId, notifyOwner);
      await sharesChanged(client);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  return (
    <NotebookCard
      notebook={notebook}
      strip={leaving ? 'danger' : strip}
      byline={t('sharing.card.sharedBy', { owner: share.ownerEmail })}
      corner={
        leaving ? null : (
          <div className="notebook-card-corner">
            <OwnershipMark ownership="sharedWithMe" owner={share.ownerEmail} />
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
              title={share.name}
              className="notebook-card-menu"
            >
              <MenuItem
                onSelect={() => {
                  setOpen(false);
                  onExport(share.notebookId);
                }}
              >
                {t('dashboard.card.export')}
              </MenuItem>
              <MenuDivider />
              <MenuItem
                danger
                onSelect={() => {
                  setOpen(false);
                  setLeaving(true);
                }}
              >
                {t('sharing.card.leave')}
              </MenuItem>
            </Menu>
          </div>
        )
      }
    >
      {leaving ? (
        <div
          className="notebook-card-confirm"
          role="group"
          aria-labelledby={`leave-${share.notebookId}`}
        >
          <h2 id={`leave-${share.notebookId}`}>
            {t('sharing.card.leaveTitle', { name: share.name })}
          </h2>
          <p>{failure ?? t('sharing.card.leaveBody')}</p>
          <label className="share-notify">
            <input
              type="checkbox"
              checked={notifyOwner}
              onChange={(event) => setNotifyOwner(event.target.checked)}
            />
            <span>{t('sharing.card.notifyOwner', { owner: share.ownerEmail })}</span>
          </label>
          <div className="notebook-card-confirm-actions">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={busy}
              onClick={() => setLeaving(false)}
            >
              {t('sharing.card.stay')}
            </button>
            <button
              type="button"
              className="button is-danger is-filled is-small"
              disabled={busy}
              onClick={() => void leave()}
            >
              {t('sharing.card.leaveForGood')}
            </button>
          </div>
        </div>
      ) : undefined}
    </NotebookCard>
  );
}

/**
 * A notebook shared with me that waits for my answer (#256, RN-ACC-026):
 * disabled, its name and description and whose it is, and nothing opens it
 * until I accept.
 */
export function PendingShareCard({ share }: { share: IncomingShareDto }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function answer(accept: boolean): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await answerShare(share.notebookId, accept);
      await sharesChanged(client);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  return (
    <article
      className="notebook-card is-pending"
      data-strip="blue"
      aria-label={t('sharing.card.pendingLabel', { name: share.name })}
    >
      <div className="notebook-card-pending-body" aria-disabled="true">
        <CardGraphDrawing notebookId={share.notebookId} />
        <div className="notebook-card-text">
          <h2>{share.name}</h2>
          {share.description ? <p>{share.description}</p> : null}
          <p className="notebook-card-byline">
            {t('sharing.card.invitedBy', { owner: share.ownerEmail })}
          </p>
        </div>
      </div>
      <footer>
        <span className="notebook-card-meta">{failure ?? t('sharing.card.waiting')}</span>
        <span className="notebook-card-answer">
          <button
            type="button"
            className="button is-quiet is-small"
            disabled={busy}
            onClick={() => void answer(false)}
          >
            {t('sharing.reject')}
          </button>
          <button
            type="button"
            className="button is-primary is-small"
            disabled={busy}
            onClick={() => void answer(true)}
          >
            {t('sharing.accept')}
          </button>
        </span>
      </footer>
      <div className="notebook-card-corner">
        <OwnershipMark ownership="sharedWithMe" owner={share.ownerEmail} />
      </div>
    </article>
  );
}
