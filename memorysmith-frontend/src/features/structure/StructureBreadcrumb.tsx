import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { VaultBreadcrumb } from './VaultBreadcrumb';

// Trail for the facets of the vault structure (Guidance, Templates).
export function StructureBreadcrumb({ current }: { current: string }) {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  return (
    <VaultBreadcrumb
      items={[{ label: t('structure.heading'), to: `/vaults/${vaultSlug}` }, { label: current }]}
    />
  );
}
