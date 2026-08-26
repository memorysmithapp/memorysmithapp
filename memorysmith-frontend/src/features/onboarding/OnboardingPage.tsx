// Onboarding and the waiting state (software-vision.md, section 13.1).
//
// Signing up creates only the account. Asking for a subscription is a separate,
// explicit act, and until a platform admin approves it nobody has operational
// access, not even the person who asked.
//
// A subscription outside trial or active takes the user to THIS screen and not
// to an empty content screen: the difference between "there is nothing here"
// and "your access is suspended" is the difference between an apparent bug and
// a piece of information.

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { requestSubscription } from '../../shared/api/backend';
import { useLiveSession } from '../../shared/auth/session';
import { ApiError } from '../../shared/api/error-mapper';

export function OnboardingPage() {
  const { t } = useTranslation();
  const session = useLiveSession((state) => state.session);
  const reload = useLiveSession((state) => state.load);

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (name.trim().length === 0) return;
    setSubmitting(true);
    setFailure(null);
    try {
      await requestSubscription(name.trim());
      await reload();
    } catch (error) {
      setFailure(
        error instanceof ApiError && error.code === 'CONFLICT'
          ? t('onboarding.alreadyRequested')
          : t('errors.unexpected'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const state = session?.subscriptionState ?? 'none';

  if (state === 'pending') {
    return (
      <section className="onboarding">
        <h1>{t('onboarding.pendingTitle')}</h1>
        <p>{t('onboarding.pendingBody')}</p>
      </section>
    );
  }

  if (state === 'blocked') {
    return (
      <section className="onboarding">
        <h1>{t('onboarding.blockedTitle')}</h1>
        <p>{t('onboarding.blockedBody')}</p>
      </section>
    );
  }

  return (
    <section className="onboarding">
      <h1>{t('onboarding.title')}</h1>
      <p>{t('onboarding.body')}</p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="subscription-name">{t('onboarding.nameLabel')}</label>
        <input
          id="subscription-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('onboarding.namePlaceholder')}
          autoFocus
        />
        <button type="submit" className="primary" disabled={submitting || name.trim().length === 0}>
          {submitting ? t('onboarding.submitting') : t('onboarding.submit')}
        </button>
      </form>
      {failure ? <p className="form-error">{failure}</p> : null}
    </section>
  );
}
