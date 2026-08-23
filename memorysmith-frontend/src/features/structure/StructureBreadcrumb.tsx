import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { VaultOutletContext } from './VaultLayout';

// Breadcrumb for the facets of the vault structure (Guidance, Templates):
// a way back to the Structure page, which the sidebar has no entry for.
export function StructureBreadcrumb({ current }: { current: string }) {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();
  return (
    <nav className="breadcrumb structure-breadcrumb" aria-label={t('structure.breadcrumb')}>
      <Link to={`/vaults/${vaultSlug}`}>{structure.vault.name}</Link>
      <span aria-hidden="true"> / </span>
      <Link to={`/vaults/${vaultSlug}`}>{t('structure.heading')}</Link>
      <span aria-hidden="true"> / </span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
