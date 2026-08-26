import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTemplate } from '../../shared/api/client';
import { splitFrontmatter } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';
import type { FolderNode } from '../../shared/types/api';
import { templateAnchor } from './StructureOutline';
import { VaultBreadcrumb } from './VaultBreadcrumb';
import type { VaultOutletContext } from './VaultLayout';

interface TemplatedFolder {
  folder: FolderNode;
  path: string[];
}

function collectTemplated(folders: FolderNode[], trail: string[] = []): TemplatedFolder[] {
  return folders.flatMap((folder) => {
    const path = [...trail, folder.name];
    const own = folder.hasTemplate ? [{ folder, path }] : [];
    return [...own, ...collectTemplated(folder.children, path)];
  });
}

// Every Template of the vault, one per folder that declares one, in folder
// order. The template is the folder's suggested note layout; the server never
// validates against it.
export function TemplatesPage() {
  const { t } = useTranslation();
  const { vaultSlug = '' } = useParams();
  const { hash } = useLocation();
  const { structure } = useOutletContext<VaultOutletContext>();
  const templated = collectTemplated(structure.folders);

  const queries = useQueries({
    queries: templated.map(({ folder }) => ({
      queryKey: ['template', vaultSlug, folder.id],
      queryFn: () => getTemplate(vaultSlug, folder.id),
    })),
  });
  const allLoaded = queries.every((q) => !q.isPending);

  useEffect(() => {
    if (!hash || !allLoaded) return;
    const target = document.getElementById(hash.slice(1));
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: 'start' });
  }, [hash, allLoaded]);

  return (
    <article className="content-pane">
      <VaultBreadcrumb items={[{ label: t('structure.templates') }]} />
      <p className="content-kicker">{t('structure.templates')}</p>
      <h1>{structure.vault.name}</h1>
      <p className="hint">{t('folder.templateHint')}</p>

      {templated.length === 0 && <p>{t('structure.noTemplates')}</p>}
      {templated.map(({ folder, path }, index) => {
        const template = queries[index]?.data;
        const anchor = templateAnchor(folder);
        return (
          <details
            key={folder.id}
            id={anchor}
            className="template-box"
            open={hash === `#${anchor}`}
          >
            <summary>
              {path.join(' / ')}
              <Link
                to={`/vaults/${vaultSlug}/root/${folder.slugPath}`}
                className="template-folder-link"
              >
                {t('structure.openFolder')}
              </Link>
            </summary>
            {template ? (
              <Markdown>{splitFrontmatter(template.body).body}</Markdown>
            ) : (
              <p className="status">{t('common.loading')}</p>
            )}
          </details>
        );
      })}
    </article>
  );
}
