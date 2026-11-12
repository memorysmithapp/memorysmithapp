import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** How many rows a page of a list shows, as a folder's list does (#438, #446, #447). */
export const LIST_PAGE = 20;

/**
 * The page of a list the browser holds whole: the rows it shows and the page
 * it is on, which never runs past the last one when the list shrinks.
 */
export function useListPage<T>(
  items: readonly T[],
  size: number = LIST_PAGE,
): { rows: readonly T[]; page: number; pages: number; setPage: (page: number) => void } {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const shown = Math.min(page, pages);
  return { rows: items.slice((shown - 1) * size, shown * size), page: shown, pages, setPage };
}

/**
 * The pager of the list of a folder, word for word (#438): which rows of how
 * many it shows, and Previous and Next. Nothing at all for a list of one page.
 */
export function ListPager({
  page,
  pages,
  total,
  size = LIST_PAGE,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  size?: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <nav className="tables-grid-pages" aria-label={t('tables.pages')}>
      <span>
        {t('tables.showing', {
          first: (page - 1) * size + 1,
          last: Math.min(page * size, total),
          total,
        })}
      </span>
      <span className="tables-grid-page-buttons">
        <button
          type="button"
          className="button is-quiet is-small"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          {t('tables.previous')}
        </button>
        <button
          type="button"
          className="button is-quiet is-small"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          {t('tables.next')}
        </button>
      </span>
    </nav>
  );
}
