import { useQuery } from '@tanstack/react-query';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTemplate, resolveNoteUrl } from '../../shared/api/client';
import { splitFrontmatter } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';
import type { FolderNode } from '../../shared/types/api';
import type { VaultOutletContext } from './VaultLayout';

function findFolder(folders: FolderNode[], slugPath: string): FolderNode | null {
  for (const folder of folders) {
    if (folder.slugPath === slugPath) return folder;
    const nested = findFolder(folder.children, slugPath);
    if (nested) return nested;
  }
  return null;
}

export function FolderPage() {
  const { t } = useTranslation();
  const { vaultSlug = '', '*': slugPath = '' } = useParams();
  const { structure } = useOutletContext<VaultOutletContext>();
  const folder = findFolder(structure.folders, slugPath);

  const { data: template } = useQuery({
    queryKey: ['template', vaultSlug, folder?.id],
    queryFn: () => getTemplate(vaultSlug, folder?.id ?? ''),
    enabled: Boolean(folder?.hasTemplate),
  });

  if (!folder) return <p className="status">{t('common.notFound')}</p>;

  return (
    <article className="content-pane">
      <h1>{folder.name}</h1>
      <p className="folder-description">{folder.description}</p>

      {folder.hasTemplate && template && (
        <details className="template-box">
          <summary>{t('folder.template')}</summary>
          <p className="hint">{t('folder.templateHint')}</p>
          <Markdown>{splitFrontmatter(template.body).body}</Markdown>
        </details>
      )}

      <h2>{t('folder.notesHeading')}</h2>
      {folder.notes.length === 0 && folder.children.length === 0 && <p>{t('folder.empty')}</p>}
      <ul className="note-list">
        {folder.children.map((child) => (
          <li key={child.id}>
            <Link to={`/vaults/${vaultSlug}/folders/${child.slugPath}`} className="note-list-folder">
              {child.name}/
            </Link>
            <span className="note-list-desc">{child.description}</span>
          </li>
        ))}
        {folder.notes.map((note) => (
          <li key={note.id}>
            <Link to={resolveNoteUrl(vaultSlug, note.slug) ?? '#'}>{note.title}</Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
