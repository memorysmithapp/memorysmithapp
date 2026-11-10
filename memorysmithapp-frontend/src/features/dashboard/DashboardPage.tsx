import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../shared/components/PageHeading';
import { ContinueReading } from './ContinueReading';
import { SubscriptionSpace } from './SubscriptionSpace';

/**
 * Home (#418): the way back to what the person was reading (#424), then the
 * consumption of the subscription, what fills its space and how much is left. The notebooks are a page of their own, in the menu, and so
 * are the models and the community.
 */
export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <section className="page home">
      <PageHeading title={t('nav.home')} />
      {/* The way back to what the person was reading, first (#424). */}
      <ContinueReading />
      <SubscriptionSpace />
    </section>
  );
}
