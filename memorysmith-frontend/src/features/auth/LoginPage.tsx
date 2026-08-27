import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../shared/store/session';
import { isLive } from '../../shared/api/source';
import { beginSignIn } from '../../shared/auth/oauth';
import { authConfig } from '../../shared/auth/session';

// Mock sign-in: credentials and the 2FA code are pre-filled and accepted as
// typed. The two-step shape mirrors the future Cognito flow.
const DEMO_EMAIL = 'heitor.rapcinski@gmail.com';
const DEMO_NAME = 'Heitor Rapcinski';

/**
 * Marks that this browser already handed itself over to the identity
 * provider. Without it, a sign-in that comes back without a session would
 * bounce between here and the provider forever, and the person would see a
 * flickering screen instead of a message. It lives in sessionStorage because
 * the question it answers is "in THIS visit", and it is cleared the moment a
 * session exists.
 */
const HANDOVER_KEY = 'memorysmith.signin.handover';

/**
 * Marks that the person asked to LEAVE. Handing the browser straight back to
 * the provider is right for someone who arrived without a session; doing it to
 * someone who just clicked "sign out" would undo the very thing they asked
 * for, and on a provider session that is still warm it would sign them back in
 * without a click.
 */
const SIGNED_OUT_KEY = 'memorysmith.signin.signedOut';

export function clearHandover(): void {
  try {
    sessionStorage.removeItem(HANDOVER_KEY);
  } catch {
    // A browser with storage disabled just loses the loop guard, not the flow.
  }
}

export function markSignedOut(): void {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, 'yes');
    sessionStorage.removeItem(HANDOVER_KEY);
  } catch {
    // Without storage the sign-out still happens; only the message is lost.
  }
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);
  const started = useRef(false);
  const [handedOver, setHandedOver] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  /**
   * There is nothing to decide here when the backend is live: the identity
   * provider owns the credentials, so a screen whose only content is one
   * button is a click asking for nothing. It hands over immediately, and only
   * shows the button if a previous handover in this visit came back without a
   * session.
   */
  useEffect(() => {
    if (!isLive || started.current) return;
    started.current = true;

    let already = false;
    let left = false;
    try {
      left = sessionStorage.getItem(SIGNED_OUT_KEY) === 'yes';
      sessionStorage.removeItem(SIGNED_OUT_KEY);
      already = sessionStorage.getItem(HANDOVER_KEY) === 'yes';
      if (!left) sessionStorage.setItem(HANDOVER_KEY, 'yes');
    } catch {
      // Storage refused: fall through and hand over anyway.
    }
    if (left) {
      setSignedOut(true);
      return;
    }
    if (already) {
      setHandedOver(true);
      return;
    }
    void beginSignIn(authConfig());
  }, []);

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState('memorysmith-demo');
  const [code, setCode] = useState('123456');

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    if (email && password) setStep('mfa');
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (code.trim().length < 6) return;
    signIn({ name: DEMO_NAME, email, role: 'OWNER', subscriptionName: 'MemorySmith' });
    void navigate('/');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/symbol.svg" alt="" className="login-symbol symbol-light" />
        <img src="/symbol-dark.svg" alt="" className="login-symbol symbol-dark" />
        <h1 className="brand-word">
          MemorySmith<span className="brand-suffix">.app</span>
        </h1>
        <p className="login-tagline">{t('app.tagline')}</p>

        {isLive ? (
          <div className="login-form">
            <p className="login-hint">
              {signedOut
                ? t('auth.signedOut')
                : handedOver
                  ? t('auth.handoverFailed')
                  : t('auth.handingOver')}
            </p>
            {signedOut || handedOver ? (
              <button
                type="button"
                className="button-primary"
                onClick={() => void beginSignIn(authConfig())}
              >
                {t('auth.signIn')}
              </button>
            ) : null}
          </div>
        ) : step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="login-form">
            <label>
              {t('auth.email')}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              {t('auth.password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button type="submit" className="button-primary">
              {t('auth.continue')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="login-form">
            <p className="login-hint">{t('auth.mfaHint')}</p>
            <label>
              {t('auth.mfaCode')}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className="mfa-input"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </label>
            <button type="submit" className="button-primary">
              {t('auth.signIn')}
            </button>
            <button type="button" className="button-ghost" onClick={() => setStep('credentials')}>
              {t('auth.back')}
            </button>
          </form>
        )}

        {isLive ? null : <p className="login-demo-note">{t('auth.demoNote')}</p>}
      </div>
    </div>
  );
}
