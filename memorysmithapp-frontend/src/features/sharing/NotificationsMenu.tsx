import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import type { NotificationDto } from '@memorysmithapp/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import {
  answerShare,
  answerShareIncrease,
  dismissRevokedShare,
  dismissShareAnswer,
} from '../../shared/api/source';
import { Menu } from '../../shared/components/Menu';
import { BellIcon, CheckIcon, CloseIcon } from '../../shared/components/icons';
import { sharesChanged, useNotifications } from './shares';
import { ActionWord } from '../../shared/components/ActionWord';
import { TransferNotice, useTransfersStatus } from '../portability/TransfersStatus';

/**
 * The notifications of the person, beside the user menu (#256, RN-ACC-029):
 * every change of a share, told to the side that did not make it, and that a
 * transfer is under way (#418). A share waiting for an answer is answered here
 * as on its card; every other notice of a share is read and dismissed, and the
 * notice of a transfer leaves once the panel was opened on it. The count on
 * the button is every notice; a ring says a transfer runs, as far as it got.
 */
export function NotificationsMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const notifications = useNotifications().data ?? [];
  const transfers = useTransfersStatus();
  const count = notifications.length + transfers.notices.length;
  // The notices of transfers stay while the panel shows them, and leave with it.
  const close = useCallback(() => {
    setOpen(false);
    transfers.read();
  }, [transfers]);

  return (
    <div className="notifications-menu">
      <button
        ref={trigger}
        type="button"
        className="icon-button notifications-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={
          count > 0
            ? `${t('notifications.heading')} · ${t('notifications.count', { count })}`
            : t('notifications.heading')
        }
      >
        <BellIcon />
        {count > 0 && (
          <span className="transfers-count" aria-hidden="true">
            {count}
          </span>
        )}
        {transfers.ring !== null && (
          <span
            className="transfers-ring"
            style={{ ['--progress' as string]: `${Math.round(transfers.ring * 100)}%` }}
          />
        )}
      </button>
      <Menu
        open={open}
        onClose={close}
        trigger={trigger}
        label={t('notifications.heading')}
        className="notifications-panel"
        closeLabel={t('common.close')}
      >
        <div className="transfers-panel-head">
          <h2>{t('notifications.heading')}</h2>
        </div>
        {notifications.length === 0 && transfers.notices.length === 0 ? (
          <p className="transfers-panel-empty">{t('notifications.empty')}</p>
        ) : (
          <ul className="notifications-list">
            {transfers.notices.map((transfer) => (
              <li key={transfer.transferId}>
                <TransferNotice transfer={transfer} onClose={close} />
              </li>
            ))}
            {notifications.map((notice) => (
              <li key={`${notice.kind}-${notice.notebookId}-${notice.granteeUserId ?? ''}`}>
                <Notice notice={notice} />
              </li>
            ))}
          </ul>
        )}
      </Menu>
    </div>
  );
}

function Notice({ notice }: { notice: NotificationDto }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const notebook = notice.notebookName ?? t('notifications.aNotebook');

  async function act(work: () => Promise<void>): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      await sharesChanged(client);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  // A share waiting for an answer, or an increase of one already accepted
  // (RN-ACC-033), is answered here as on its card.
  const answer = (accept: boolean): Promise<void> =>
    notice.kind === 'increase'
      ? answerShareIncrease(notice.notebookId, accept)
      : answerShare(notice.notebookId, accept);

  const dismiss = (): Promise<void> =>
    notice.kind === 'revoked'
      ? dismissRevokedShare(notice.notebookId)
      : dismissShareAnswer(notice.notebookId, notice.granteeUserId ?? '');

  return (
    <div className="notification" data-kind={notice.kind}>
      <p className="notification-what">
        <Trans
          i18nKey={`notifications.kind.${notice.kind}`}
          values={{ person: notice.person, notebook }}
          components={{ b: <strong /> }}
        />
      </p>
      {failure ? <p className="notification-failure">{failure}</p> : null}
      <div className="notification-actions">
        {notice.kind === 'shared' || notice.kind === 'increase' ? (
          <>
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={busy}
              onClick={() => void act(() => answer(false))}
            >
              <ActionWord icon={<CloseIcon />} word={t('sharing.reject')} />
            </button>
            <button
              type="button"
              className="button is-primary is-small"
              disabled={busy}
              onClick={() => void act(() => answer(true))}
            >
              <ActionWord icon={<CheckIcon />} word={t('sharing.accept')} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button is-quiet is-small"
            disabled={busy}
            onClick={() => void act(dismiss)}
          >
            <ActionWord icon={<CloseIcon />} word={t('notifications.dismiss')} />
          </button>
        )}
      </div>
    </div>
  );
}
