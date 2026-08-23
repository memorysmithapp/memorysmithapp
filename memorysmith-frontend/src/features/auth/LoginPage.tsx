import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../../shared/store/session';

// Mock sign-in: credentials and the 2FA code are pre-filled and accepted as
// typed. The two-step shape mirrors the future Cognito flow.
const DEMO_EMAIL = 'heitor.rapcinski@gmail.com';
const DEMO_NAME = 'Heitor Rapcinski';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signIn = useSession((s) => s.signIn);

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
        <img src="/symbol.svg" alt="" className="login-symbol" />
        <h1 className="brand-word">
          MemorySmith<span className="brand-suffix">.app</span>
        </h1>
        <p className="login-tagline">{t('app.tagline')}</p>

        {step === 'credentials' ? (
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
            <button type="submit" className="button-primary">{t('auth.continue')}</button>
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
            <button type="submit" className="button-primary">{t('auth.signIn')}</button>
            <button type="button" className="button-ghost" onClick={() => setStep('credentials')}>
              {t('auth.back')}
            </button>
          </form>
        )}

        <p className="login-demo-note">{t('auth.demoNote')}</p>
      </div>
    </div>
  );
}
