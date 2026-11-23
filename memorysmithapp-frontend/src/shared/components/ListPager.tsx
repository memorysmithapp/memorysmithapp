import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

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
 * The one pager of the product (#438, #491): which rows of how many it shows
 * on the left, and Previous and Next on the right, each an arrow and its word,
 * the arrows alone on a phone. A folder's list, a history, the Tables page and
 * the `table` block of a note (drawn by the renderer in the same structure,
 * through the `--markdown-pager-*` properties) all read the same. Nothing at
 * all for a list of one page.
 */
export function ListPager({
  page,
  pages,
  total,
  size = LIST_PAGE,
  onPage,
  holdNext = false,
}: {
  page: number;
  pages: number;
  total: number;
  size?: number;
  onPage: (page: number) => void;
  /** Next waits, as while the next page of a search is still being read. */
  holdNext?: boolean;
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
        <Button
          variant="quiet"
          small
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('tables.previous')}
        >
          <span aria-hidden="true">‹</span>
          <span className="pager-word" aria-hidden="true">
            {t('tables.previous')}
          </span>
        </Button>
        <Button
          variant="quiet"
          small
          disabled={page >= pages || holdNext}
          onClick={() => onPage(page + 1)}
          aria-label={t('tables.next')}
        >
          <span className="pager-word" aria-hidden="true">
            {t('tables.next')}
          </span>
          <span aria-hidden="true">›</span>
        </Button>
      </span>
    </nav>
  );
}
