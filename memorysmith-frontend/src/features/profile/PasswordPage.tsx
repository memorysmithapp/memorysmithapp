import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../shared/components/document-title';
import { changePassword } from '../../shared/api/backend';
import { ApiError } from '../../shared/api/error-mapper';

/**
 * Changing a password from inside a live session (#168, RN-ACC-023).
 *
 * It is a CHANGE and not a recovery, so it asks for the current password: that
 * proves the person in front of the screen, where a code sent to a mailbox
 * proves the mailbox — and the mailbox is probably open in the next tab. The
 * forgotten-password door stays where it is, on the sign-in screen, for
 * whoever does not know the current one.
 *
 * It is a screen of ours and not a page of the identity provider because
 * GIVING UP has to be free: `Cancel` goes back to where they were, and there
 * is no return journey through a callback to design. Managed login has no
 * change-password page for a signed-in person anyway — only the forced flows.
 */
export function PasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useDocumentTitle(t('password.heading'), null);

  const mismatched = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length > 0 && next === again && !working;

  async function submit() {
    setWorking(true);
    setFailure(null);
    try {
      await changePassword(current, next);
      setDone(true);
    } catch (error) {
      setFailure(error instanceof ApiError ? error.message : t('password.failed'));
    } finally {
      setWorking(false);
    }
  }

  /**
   * Afterwards the person stays where they are: the session in this browser
   * is the one that changed it and keeps working. It is every OTHER session
   * that ends at its next refresh, which is what the warning above said would
   * happen and what the product already knows how to do without pretending it
   * is a wait (RN-SUB-022).
   */
  if (done) {
    return (
      <article className="profile">
        <h1>{t('password.heading')}</h1>
        <p className="profile-done">{t('password.done')}</p>
        <div className="profile-actions">
          <button type="button" className="button is-primary" onClick={() => navigate('/profile')}>
            {t('password.back')}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="profile">
      <h1>{t('password.heading')}</h1>
      {/* Said before it happens, not after: it is what a person expects a
          password change to mean, and being surprised by it on another
          device reads as a defect. */}
      <p className="profile-note">{t('password.endsOtherSessions')}</p>

      <section className="profile-section">
        <label className="field">
          <span className="field-label">{t('password.current')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('password.next')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
          <span className="field-hint">{t('password.policy')}</span>
        </label>
        <label className="field">
          <span className="field-label">{t('password.again')}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
          {mismatched ? (
            <span className="field-hint is-wrong">{t('password.mismatch')}</span>
          ) : null}
        </label>
      </section>

      {failure ? <p className="profile-failure">{failure}</p> : null}

      <div className="profile-actions">
        <button
          type="button"
          className="button is-primary"
          disabled={!ready}
          onClick={() => void submit()}
        >
          {working ? t('password.working') : t('password.confirm')}
        </button>
        <button type="button" className="button" onClick={() => navigate('/profile')}>
          {t('password.cancel')}
        </button>
      </div>
    </article>
  );
}
