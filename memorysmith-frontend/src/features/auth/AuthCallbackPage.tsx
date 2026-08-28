// Where the identity provider comes back to. It exchanges the code once and
// then gets out of the way.

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { completeSignIn } from '../../shared/auth/oauth';
import { clearHandover } from './LoginPage';
import { authConfig, useLiveSession } from '../../shared/auth/session';

export function AuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const load = useLiveSession((state) => state.load);
  const [failure, setFailure] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    // StrictMode mounts twice in development, and an authorization code is
    // single use: exchanging it twice fails the second time.
    if (exchanged.current) return;
    exchanged.current = true;

    const code = params.get('code');
    const error = params.get('error_description') ?? params.get('error');
    if (error) {
      setFailure(error);
      return;
    }
    if (!code) {
      void navigate('/login', { replace: true });
      return;
    }

    completeSignIn(authConfig(), code)
      .then(async () => {
        // The handover worked, so the loop guard has nothing left to guard.
        clearHandover();
        await load();
        void navigate('/', { replace: true });
      })
      .catch((reason: unknown) => {
        setFailure(reason instanceof Error ? reason.message : String(reason));
      });
  }, [load, navigate, params]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1 className="brand-word">
          MemorySmith<span className="brand-suffix">.app</span>
        </h1>
        <p className="login-note">{failure ?? t('auth.completing')}</p>
        {failure ? (
          <button type="button" className="primary" onClick={() => void navigate('/login')}>
            {t('auth.tryAgain')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
