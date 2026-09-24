import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { CopyButton } from '../../shared/components/CopyButton';
import { Tabs } from '../../shared/components/Tabs';
import { useDocumentTitle } from '../../shared/components/document-title';
import { connectorEndpoint, loadedRuntimeConfig } from '../../shared/config/runtime-config';
import { recordWelcomeSeen } from '../../shared/api/backend';
import { useLiveSession } from '../../shared/auth/session';

/**
 * The dashboard, unless this person has never been welcomed (#167).
 *
 * It is a redirect and not an effect on purpose: an effect would paint the
 * dashboard first and replace it, and the first thing somebody sees of a
 * product should not be a screen that flinches. Only the dashboard is guarded,
 * because an address somebody was handed is not a first arrival, and bouncing
 * it would cost them the thing they came to read.
 */
export function WelcomeGate({ children }: { children: ReactNode }) {
  const welcomed = useLiveSession((s) => s.session?.welcomeSeen ?? true);
  if (!welcomed) return <Navigate to="/about" replace />;
  return <>{children}</>;
}

/**
 * The steps of adding the connector in each client, in the words the client's
 * own screens use. Those screens move under us: they were reread in both
 * clients for 0.6.1, when the Claude entry had moved to Customize and ChatGPT
 * had renamed connectors to plugins behind a developer mode (#182).
 */
const STEPS = ['one', 'two', 'three', 'four', 'five'] as const;

/** The two clients whose steps the page gives, one at a time (#216). */
const CLIENTS = ['claude', 'chatgpt'] as const;
type Client = (typeof CLIENTS)[number];

/**
 * What this product is, said once, to whoever just arrived (#167, RN-ACC-019).
 *
 * It opens by itself on the first sign-in of an account and never again, and
 * from then on it is the "About MemorySmith.app" entry of the user menu. The
 * flag lives on the account and not in this browser, because a person signs in
 * from more than one and being welcomed happened to them, not to a device.
 *
 * The address of the connector is the reason this surface exists at all: an
 * agent writing in the notebooks is what the product IS, and nothing else in
 * the interface ever said where to point one. It is derived from the runtime
 * configuration, so each environment publishes its own, and it is the endpoint
 * and not the host: a client pointed at the host finds no server (#180).
 */
export function AboutPage() {
  const { t } = useTranslation();
  const config = loadedRuntimeConfig();
  const connector = config ? connectorEndpoint(config) : '';
  const welcomed = useLiveSession((s) => s.session?.welcomeSeen ?? true);
  const markWelcomeSeen = useLiveSession((s) => s.markWelcomeSeen);
  const [client, setClient] = useState<Client>('claude');

  useDocumentTitle(t('about.title'), null);

  /**
   * Seeing it is what records it, and only the first time: opening this page
   * from the user menu, when the account already carries the date, writes
   * nothing. The screen is already drawn, so a failure to record changes
   * nothing on it — it only means the surface opens once more.
   */
  useEffect(() => {
    if (welcomed) return;
    markWelcomeSeen();
    void recordWelcomeSeen().catch(() => undefined);
  }, [welcomed, markWelcomeSeen]);

  return (
    <article className="about">
      {/* A reading column, the sections set apart by a hairline (#216). */}
      <header className="about-hero">
        <img className="about-symbol symbol-light" src="/symbol.svg" alt="" />
        <img className="about-symbol symbol-dark" src="/symbol-dark.svg" alt="" />
        <h1>{t('about.heading')}</h1>
        <p className="about-lead">{t('about.lead')}</p>
      </header>

      <section className="about-section">
        <h2>{t('about.what.heading')}</h2>
        <p>{t('about.what.body')}</p>
        <p>{t('about.what.guidance')}</p>
      </section>

      <section className="about-section">
        <h2>{t('about.interface.heading')}</h2>
        <p>{t('about.interface.body')}</p>
        {/* Term and definition in one card, a row each: the term is what the
            eye scans for, so it carries the weight and the definition none. */}
        <dl className="about-list">
          {(['notebooks', 'folders', 'guidance', 'graph', 'search', 'transfers'] as const).map(
            (key) => (
              <div key={key}>
                <dt>{t(`about.interface.${key}.term`)}</dt>
                <dd>{t(`about.interface.${key}.definition`)}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <section className="about-section">
        <h2>{t('about.connector.heading')}</h2>
        <p>{t('about.connector.body')}</p>

        {/* The address, as a block of code of the reading surface with the
            verb inside it. Nothing here asks the person to read it. */}
        <div className="about-connector">
          <code>{connector}</code>
          <CopyButton text={() => connector} disabled={!connector} />
        </div>

        {/* One client at a time: the steps of the other are a tab away. */}
        <Tabs
          id="about-clients"
          label={t('about.connector.heading')}
          className="about-clients"
          tabs={CLIENTS.map((key) => ({ key, label: t(`about.connector.${key}.heading`) }))}
          active={client}
          onSelect={setClient}
        />
        <ol
          className="about-steps"
          id="about-clients-panel"
          role="tabpanel"
          aria-labelledby={`about-clients-tab-${client}`}
        >
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="about-step-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <Trans
                  i18nKey={`about.connector.${client}.${step}`}
                  components={{ b: <strong /> }}
                />
              </span>
            </li>
          ))}
        </ol>
        <p className="about-note">{t('about.connector.sameAccount')}</p>
      </section>

      <section className="about-section">
        <h2>{t('about.agent.heading')}</h2>
        <p>{t('about.agent.body')}</p>
        <ul className="about-asks">
          {(['one', 'two', 'three'] as const).map((ask) => (
            <li key={ask}>{t(`about.agent.${ask}`)}</li>
          ))}
        </ul>
        <p>{t('about.agent.skills')}</p>
      </section>

      <footer className="about-footer">
        <span className="about-version">
          {t('app.version', { version: config?.version ?? '' })}
        </span>
        <Link className="button is-primary" to="/">
          {t('about.start')}
        </Link>
      </footer>
    </article>
  );
}
