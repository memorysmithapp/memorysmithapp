import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNote, resolveNoteUrl } from '../../shared/api/client';
import { resolveWikilinks } from '../../shared/api/markdown';
import { Markdown } from '../../shared/components/Markdown';

export function NotePage() {
  const { t } = useTranslation();
  const { vaultSlug = '', noteSlug = '' } = useParams();
  const { data, isPending, isError } = useQuery({
    queryKey: ['note', vaultSlug, noteSlug],
    queryFn: () => getNote(vaultSlug, noteSlug),
  });

  if (isPending) return <p className="status">{t('common.loading')}</p>;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  const body = resolveWikilinks(data.body, (slug) => resolveNoteUrl(vaultSlug, slug));
  const properties = Object.entries(data.frontmatter).filter(([, value]) => value !== '');

  return (
    <article className="content-pane">
      <p className="breadcrumb">{data.folderNames.join(' / ')}</p>
      <h1>{data.title}</h1>

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
