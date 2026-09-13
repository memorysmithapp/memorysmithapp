import { useTranslation } from 'react-i18next';
import { loadedRuntimeConfig, type RuntimeConfig } from '../config/runtime-config';

/** What the banner declares, or null in production, where nothing is declared. */
export function environmentDeclared(
  config: Pick<RuntimeConfig, 'environment' | 'version'> | null,
): { environment: RuntimeConfig['environment']; version: string } | null {
  if (!config || config.environment === 'production') return null;
  return { environment: config.environment, version: config.version };
}

/**
 * The environment and the version, outside production, on every page
 * (architecture-guide.md, 23.3).
 *
 * Fixed and never dismissable: staging looks exactly like production, and a
 * person who forgets which of the two they are in writes, in the one that is
 * rebuilt, something they meant to keep.
 */
export function EnvironmentBanner() {
  const { t } = useTranslation();
  const declared = environmentDeclared(loadedRuntimeConfig());
  if (!declared) return null;

  return (
    <div className="environment-banner" role="note" title={t('environment.disposable')}>
      <span className="environment-banner-name">{t(`environment.${declared.environment}`)}</span>
      <span aria-hidden="true"> · </span>
      <span>{declared.version}</span>
    </div>
  );
}
