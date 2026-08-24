import { Fragment } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FolderNode } from '../../shared/types/api';
import type { VaultOutletContext } from './VaultLayout';

export interface Crumb {
  label: string;
  to?: string;
}

interface VaultBreadcrumbProps {
  // Trail after the vault root; the last item is the current page.
  items: Crumb[];
  className?: string;
}

// Every page inside a vault starts its trail at the vault name (which links to
// the Structure page) and walks down: Guidance or Templates, the folder chain,
// the note. On the Structure page itself the trail is just the vault name.
export function VaultBreadcrumb({ items, className = '' }: VaultBreadcrumbProps) {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();
  const trail: Crumb[] = [{ label: structure.vault.name, to: `/vaults/${vaultSlug}` }, ...items];
  const last = trail.length - 1;

  return (
    <nav className={`breadcrumb vault-breadcrumb ${className}`.trim()} aria-label={t('structure.breadcrumb')}>
      {trail.map((crumb, index) => (
        <Fragment key={`${index}-${crumb.label}`}>
          {index > 0 && <span aria-hidden="true"> / </span>}
          {index < last && crumb.to ? (
            <Link to={crumb.to}>{crumb.label}</Link>
          ) : (
            <span aria-current={index === last ? 'page' : undefined}>{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

export function folderCrumbs(vaultSlug: string, chain: FolderNode[]): Crumb[] {
  return chain.map((folder) => ({
    label: folder.name,
    to: `/vaults/${vaultSlug}/folders/${folder.slugPath}`,
  }));
}
