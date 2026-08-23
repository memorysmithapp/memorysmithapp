import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNote, resolveNoteUrl } from '../../shared/api/client';
import { resolveWikilinks } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';

export function NotePage() {
  const { t } = useTranslation();
  const { vaultSlug = '', noteSlug = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ['note', vaultSlug, noteSlug],
    queryFn: () => getNote(vaultSlug, noteSlug),
  });

  async function copyNote() {
    if (!data) return;
    // The async clipboard API can stay pending forever in embedded or
    // automated contexts, so race it against a short timeout and fall back
    // to the legacy path when it does not settle.
    const viaApi = navigator.clipboard
      ?.writeText(data.raw)
      .then(() => true)
      .catch(() => false);
    const done = await Promise.race([
      viaApi ?? Promise.resolve(false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 350)),
    ]);
    if (!done) {
      const scratch = document.createElement('textarea');
      scratch.value = data.raw;
      scratch.style.position = 'fixed';
      scratch.style.opacity = '0';
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand('copy');
      scratch.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isPending) return <p className="status">{t('common.loading')}</p>;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  const body = resolveWikilinks(data.body, (slug) => resolveNoteUrl(vaultSlug, slug));
  const properties = Object.entries(data.frontmatter).filter(([, value]) => value !== '');

  return (
    <article className="content-pane">
      <div className="note-header">
        <div>
          <p className="breadcrumb">{data.folderNames.join(' / ')}</p>
          <h1>{data.title}</h1>
        </div>
        <button
          type="button"
          className={`copy-button${copied ? ' copied' : ''}`}
          onClick={() => void copyNote()}
          title={t('note.copyHint')}
        >
          {copied ? `✓ ${t('note.copied')}` : t('note.copy')}
        </button>
      </div>

      {properties.length > 0 && (
        <details className="properties-box">
          <summary>{t('note.properties')}</summary>
          <table>
            <tbody>
              {properties.map(([key, value]) => (
                <tr key={key}>
                  <th>{key}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <Markdown>{body}</Markdown>
    </article>
  );
}
