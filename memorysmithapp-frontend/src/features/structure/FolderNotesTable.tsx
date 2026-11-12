import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../i18n/intl-locale';
import { useLiveInterval } from '../../shared/api/live';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getFacetsById, getNoteFacets } from '../../shared/api/source';
import { useLiveSession } from '../../shared/auth/session';
import type { NoteSummary } from '../../shared/types/api';
import { formatDay } from '../dashboard/NotebookCard';
import { nextSort, sortNotes, type Sort, type SortKey } from './folder-notes';
import { authorLabel, byAgent } from './note-author';

/** How many notes a page of the table holds. */
export const PAGE_SIZE = 50;

const PROPERTY_KEY = 'memorysmith.folderProperty.';

/** The property this browser showed last in the folders of a notebook. */
function remembered(notebookId: string): string | null {
  try {
    return window.localStorage.getItem(PROPERTY_KEY + notebookId);
  } catch {
    return null;
  }
}

function remember(notebookId: string, property: string | null): void {
  try {
    if (property) window.localStorage.setItem(PROPERTY_KEY + notebookId, property);
    else window.localStorage.removeItem(PROPERTY_KEY + notebookId);
  } catch {
    /* the choice lasts while the page does */
  }
}

/**
 * The notes of a folder as a table (#416): the name, a property the notes
 * declare in their frontmatter, when each changed and who changed it, sorted
 * by any column and back to the folder's own order, fifty to a page. Which
 * property is the person's choice among the ones the notebook declares, the
 * one called `status` when there is one: no notation of the specification is
 * a status, so the code never decides what one is (INV-05).
 */
export function FolderNotesTable({
  notebookId,
  notes,
  staleChip,
}: {
  notebookId: string;
  notes: readonly NoteSummary[];
  /** The mark of a note written against a context that had changed. */
  staleChip: (note: NoteSummary) => ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const me = useLiveSession((s) => s.session?.userId ?? '');
  const live = useLiveInterval();

  const facets = useQuery({
    queryKey: queryKeys.notebookFacets(notebookId),
    queryFn: () => getFacetsById(notebookId),
    refetchInterval: live,
  });
  const portraits = useQuery({
    queryKey: queryKeys.noteFacets(notebookId),
    queryFn: () => getNoteFacets(notebookId),
    refetchInterval: live,
  });

  const declared = useMemo(
    () =>
      (facets.data?.facets ?? [])
        .filter((facet) => !facet.discarded)
        .map((facet) => facet.facet)
        .sort((a, b) => a.localeCompare(b, locale)),
    [facets.data, locale],
  );
  const [chosen, setChosen] = useState<string | null>(() => remembered(notebookId));
  const property =
    chosen !== null && declared.includes(chosen)
      ? chosen
      : declared.includes('status')
        ? 'status'
        : null;

  const [sort, setSort] = useState<Sort>({ key: 'order', direction: 'asc' });
  const [page, setPage] = useState(1);

  const values = (note: NoteSummary): string[] =>
    property ? (portraits.data?.get(note.id)?.[property] ?? []) : [];
  const author = (note: NoteSummary): string => authorLabel(note.updatedBy, me, t);
  const sorted = sortNotes(notes, sort, values, author, locale);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const press = (key: Exclude<SortKey, 'order'>) => {
    setSort((was) => nextSort(was, key));
    setPage(1);
  };
  const header = (key: Exclude<SortKey, 'order'>, label: string) => {
    const way = sort.key === key ? sort.direction : null;
    return (
      <th
        scope="col"
        aria-sort={way === 'asc' ? 'ascending' : way === 'desc' ? 'descending' : 'none'}
      >
        <button type="button" className="tables-grid-sort" onClick={() => press(key)}>
          {label}
          <span className="tables-grid-arrow" aria-hidden="true">
            {way === 'asc' ? '↑' : way === 'desc' ? '↓' : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="folder-notes">
      <div className="folder-notes-controls">
        {declared.length > 0 ? (
          <label className="folder-notes-property">
            <span>{t('folderTable.property')}</span>
            <select
              value={property ?? ''}
              onChange={(event) => {
                const next = event.target.value || null;
                setChosen(next);
                remember(notebookId, next);
                if (sort.key === 'property') setSort({ key: 'order', direction: 'asc' });
              }}
            >
              <option value="">{t('folderTable.noProperty')}</option>
              {declared.map((facet) => (
                <option key={facet} value={facet}>
                  {facet}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {sort.key !== 'order' ? (
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => setSort({ key: 'order', direction: 'asc' })}
          >
            {t('folderTable.folderOrder')}
          </button>
        ) : null}
      </div>
      <div className="tables-grid-scroll">
        <table className="tables-grid folder-notes-table">
          <thead>
            <tr>
              {header('name', t('folderTable.name'))}
              {property ? header('property', property) : null}
              {header('updated', t('folderTable.updated'))}
              {header('author', t('folderTable.author'))}
            </tr>
          </thead>
          <tbody>
            {shown.map((note) => (
              <tr key={note.id}>
                <td className="folder-notes-name">
                  <Link to={noteAddress(notebookId, note.id)} className="note-row">
                    {note.name ?? t('note.unnamed')}
                    {staleChip(note)}
                  </Link>
                </td>
                {property ? (
                  <td className="folder-notes-property-cell" data-label={property}>
                    {values(note).map((value) => (
                      <span key={value} className="property-chip">
                        {value}
                      </span>
                    ))}
                  </td>
                ) : null}
                <td data-label={t('folderTable.updated')}>{formatDay(note.updatedAt, locale)}</td>
                <td
                  data-label={t('folderTable.author')}
                  className={byAgent(note.updatedBy) ? 'is-agent' : undefined}
                >
                  {author(note)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="tables-grid-pages" aria-label={t('tables.pages')}>
          <span>
            {t('tables.showing', {
              first: (current - 1) * PAGE_SIZE + 1,
              last: Math.min(current * PAGE_SIZE, sorted.length),
              total: sorted.length,
            })}
          </span>
          <span className="tables-grid-page-buttons">
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              {t('tables.previous')}
            </button>
            <button
              type="button"
              className="button is-quiet is-small"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              {t('tables.next')}
            </button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}
