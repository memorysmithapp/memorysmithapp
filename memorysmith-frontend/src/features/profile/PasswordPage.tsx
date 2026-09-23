import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
 *
 * But it is DRAWN as the sign-in screen is (#214): the secret of the account
 * is typed in two places, and a different look in the second one reads as a
 * warning. So it stands outside the frame of the application, as the sign-in
 * does, in the card, the lockup, the fields and the buttons of the managed
 * login. Those are copied from `memorysmith-infra/branding/managed-login.json`
 * into `.password-screen` in styles.css, because the managed login is Cognito's
 * and nothing of it can be imported: a change to one has to reach the other.
 */
export function PasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  /**
   * Where the change was asked from: the user menu opens it over any page, and
   * giving up or finishing goes back there, never to a profile the person did
   * not open. An address typed by hand has no origin, and goes to the profile.
   */
  const origin = (useLocation().state as { from?: string } | null)?.from;
  const back = () => navigate(origin?.startsWith('/') ? origin : '/profile');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [shown, setShown] = useState(false);
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Whether a submit was tried: what is missing is said then, as the sign-in does. */
  const [tried, setTried] = useState(false);

  useDocumentTitle(t('password.heading'), null);

  const mismatched = again.length > 0 && next !== again;
  const ready = current.length > 0 && next.length > 0 && next === again;
  const missing = (value: string) => tried && value.length === 0;
  const type = shown ? 'text' : 'password';

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
      <PasswordScreen heading={t('password.heading')}>
        <p className="password-description">{t('password.done')}</p>
        <button type="button" className="password-primary" onClick={back}>
          {t('password.back')}
        </button>
      </PasswordScreen>
    );
  }

  return (
    <PasswordScreen heading={t('password.heading')}>
      {/* Said before it happens, not after: it is what a person expects a
          password change to mean, and being surprised by it on another
          device reads as a defect. */}
      <p className="password-description">{t('password.endsOtherSessions')}</p>

      {failure ? (
        <p className="password-alert" role="alert">
          {failure}
        </p>
      ) : null}

      <form
        className="password-form"
        onSubmit={(event) => {
          event.preventDefault();
          // The button is always the blue one of the sign-in, which says what
          // is missing when it is pressed rather than greying out until then.
          setTried(true);
          if (ready && !working) void submit();
        }}
      >
        <label className="password-field">
          <span className="password-label">{t('password.current')}</span>
          <input
            type={type}
            autoComplete="current-password"
            placeholder={t('password.currentPlaceholder')}
            value={current}
            aria-invalid={missing(current)}
            onChange={(event) => setCurrent(event.target.value)}
          />
          {missing(current) ? (
            <span className="password-hint is-wrong">{t('password.required')}</span>
          ) : null}
        </label>
        <label className="password-field">
          <span className="password-label">{t('password.next')}</span>
          <input
            type={type}
            autoComplete="new-password"
            placeholder={t('password.nextPlaceholder')}
            value={next}
            aria-invalid={missing(next)}
            onChange={(event) => setNext(event.target.value)}
          />
          {missing(next) ? (
            <span className="password-hint is-wrong">{t('password.required')}</span>
          ) : null}
          <span className="password-hint">{t('password.policy')}</span>
        </label>
        <label className="password-field">
          <span className="password-label">{t('password.again')}</span>
          <input
            type={type}
            autoComplete="new-password"
            placeholder={t('password.againPlaceholder')}
            value={again}
            aria-invalid={mismatched || missing(again)}
            onChange={(event) => setAgain(event.target.value)}
          />
          {mismatched ? (
            <span className="password-hint is-wrong">{t('password.mismatch')}</span>
          ) : missing(again) ? (
            <span className="password-hint is-wrong">{t('password.required')}</span>
          ) : null}
        </label>
        <label className="password-show">
          <input
            type="checkbox"
            checked={shown}
            onChange={(event) => setShown(event.target.checked)}
          />
          {t('password.show')}
        </label>

        <button type="submit" className="password-primary" disabled={working}>
          {working ? t('password.working') : t('password.confirm')}
        </button>
        {/* Giving up changes nothing, and what was typed goes with the page. */}
        <button type="button" className="password-secondary" onClick={back}>
          {t('password.cancel')}
        </button>
      </form>
    </PasswordScreen>
  );
}

/** The frame of the managed login: the page, the card and the lockup in it. */
function PasswordScreen({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <main className="password-screen">
      <article className="password-card">
        <img className="password-logo" src="/lockup-light.svg" alt="MemorySmith.app" />
        <h1 className="password-heading">{heading}</h1>
        {children}
      </article>
    </main>
  );
}
