import { useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { NotebookTableDto, NoteRefDto } from '@memorysmithapp/contracts';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import { getTableUses } from '../../shared/api/backend';
import { listTables, queryTable } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { noteAddress, tablesAddress } from '../../shared/api/note-address';
import { useLiveInterval } from '../../shared/api/live';
import { formatBytes } from '../../shared/components/StorageBar';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { TableIcon } from '../../shared/components/icons';
import { ListPager } from '../../shared/components/ListPager';
import { TableRowDialog, type TableRowField } from '../../shared/components/TableRowDialog';
import { intlLocale } from '../../i18n/intl-locale';
import { columnsOf, formatCell, type ColumnView } from './cells';

const PAGE_SIZE = 25;

/**
 * The Tables of a notebook (#366, RN-KNW-077): each with what it is for, its
 * columns and how many rows it holds, and, open, its rows page by page and its
 * schema, column by column.
 *
 * Nothing is written here (#462): tables are created, their rows written and
 * the tables deleted by an agent, through the connector. The page is how a
 * person — the Reader of a share too — sees what the agent kept.
 */
export function TablesPage() {
  const { t, i18n } = useTranslation();
  const descriptionOf = useDescriptionOf();
  const locale = intlLocale(i18n.language);
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const live = useLiveInterval();
  const [params, setParams] = useSearchParams();
  const open = params.get('table');

  useDocumentTitle(t('tables.heading'), structure.notebook.name);

  const tables = useQuery({
    queryKey: queryKeys.notebookTables(notebookId),
    refetchInterval: live,
    queryFn: () => listTables(notebookId),
  });
  const uses = useQuery({
    queryKey: queryKeys.tableUses(notebookId),
    refetchInterval: live,
    queryFn: () => getTableUses(notebookId),
  });
  /** The notes naming a table, compared after NFC with case folded (§5.9). */
  const notesOf = (name: string): readonly NoteRefDto[] =>
    uses.data?.find(
      (use) => use.table.normalize('NFC').toLowerCase() === name.normalize('NFC').toLowerCase(),
    )?.notes ?? [];
  const sorted = useMemo(
    () =>
      [...(tables.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, locale)),
    [tables.data, locale],
  );
  const chosen = sorted.find((table) => table.name === open) ?? null;

  const choose = (name: string | null) => {
    const next = new URLSearchParams(params);
    if (name) next.set('table', name);
    else next.delete('table');
    setParams(next, { replace: true });
  };

  return (
    <>
      <NotebookBar
        crumbs={
          chosen
            ? [
                { label: t('tables.heading'), to: tablesAddress(notebookId) },
                { label: chosen.name },
              ]
            : [{ label: t('tables.heading') }]
        }
      />
      <article className="content-pane is-wide tables-page">
        {tables.isError ? (
          <p className="status">{t(messageKeyOf(tables.error))}</p>
        ) : !tables.data ? (
          <SkeletonRegion>
            <ul className="row-card table-list">
              {[0, 1, 2].map((index) => (
                <li key={index} className="table-row">
                  <SkeletonBar width="40%" />
                  <SkeletonBar width="70%" height="0.8rem" />
                </li>
              ))}
            </ul>
          </SkeletonRegion>
        ) : chosen ? (
          <TableDetail
            notebookId={notebookId}
            table={chosen}
            locale={locale}
            notes={notesOf(chosen.name)}
          />
        ) : (
          <>
            <p className="page-intro">{t('tables.intro')}</p>
            {sorted.length === 0 ? (
              <p>{t('tables.none')}</p>
            ) : (
              <>
                <p className="table-count">{t('tables.count', { count: sorted.length })}</p>
                <ul className="row-card table-list">
                  {sorted.map((table) => (
                    <li key={table.tableId} className="table-row">
                      <button
                        type="button"
                        className="table-row-open"
                        onClick={() => choose(table.name)}
                      >
                        <span className="table-row-icon" aria-hidden="true">
                          <TableIcon width={20} height={20} />
                        </span>
                        <span className="table-row-text">
                          <span className="table-row-name">{table.name}</span>
                          <span className="table-row-meta">
                            {t('tables.columns', { count: columnsOf(table).length })} ·{' '}
                            {t('tables.rows', { count: table.rows })} ·{' '}
                            {/* The system table holds no bytes: it is the notes, read (#517). */}
                            {table.system ? t('tables.system') : formatBytes(table.bytes, locale)}
                          </span>
                          {descriptionOf(table) ? (
                            <span className="table-row-desc">{descriptionOf(table)}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </article>
    </>
  );
}

type Tab = 'data' | 'schema';

/**
 * What a table is for, in the reader's language for the system table, whose
 * description the server writes the same in every notebook (#517).
 */
function useDescriptionOf(): (table: NotebookTableDto) => string {
  const { t } = useTranslation();
  return (table) => (table.system ? t('tables.systemDescription') : table.description);
}

function TableDetail({
  notebookId,
  table,
  locale,
  notes,
}: {
  notebookId: string;
  table: NotebookTableDto;
  locale: string;
  notes: readonly NoteRefDto[];
}) {
  const { t } = useTranslation();
  const descriptionOf = useDescriptionOf();
  const [tab, setTab] = useState<Tab>('data');
  const columns = columnsOf(table);

  return (
    <section className="table-detail">
      <header className="table-detail-head">
        <div>
          <h1 className="table-detail-name">{table.name}</h1>
          {descriptionOf(table) ? (
            <p className="table-detail-desc">{descriptionOf(table)}</p>
          ) : null}
          <p className="table-detail-meta">
            {table.system ? `${t('tables.system')} · ` : ''}
            {t('tables.rows', { count: table.rows })} ·{' '}
            {t('tables.columns', { count: columns.length })}
            {table.key ? ` · ${t('tables.keyIs', { columns: table.key.join(', ') })}` : ''}
          </p>
        </div>
      </header>
      <p className="table-detail-meta">
        {notes.length === 0
          ? t('tables.shownByNone')
          : `${t('tables.shownBy', { count: notes.length })}: `}
        {notes.map((note, index) => (
          <span key={note.noteId}>
            {index > 0 ? ', ' : null}
            <Link to={noteAddress(notebookId, note.noteId)}>{note.name || t('note.unnamed')}</Link>
          </span>
        ))}
      </p>
      <div className="tabs" role="tablist" aria-label={table.name}>
        {(['data', 'schema'] as const).map((each) => (
          <button
            key={each}
            type="button"
            role="tab"
            aria-selected={tab === each}
            className={`tab${tab === each ? ' is-selected' : ''}`}
            onClick={() => setTab(each)}
          >
            {t(`tables.tab.${each}`)}
          </button>
        ))}
      </div>
      {tab === 'data' ? (
        <TableRows
          key={table.name}
          notebookId={notebookId}
          table={table}
          columns={columns}
          locale={locale}
        />
      ) : (
        <TableSchemaView table={table} columns={columns} locale={locale} />
      )}
    </section>
  );
}

function TableRows({
  notebookId,
  table,
  columns,
  locale,
}: {
  notebookId: string;
  table: NotebookTableDto;
  columns: ColumnView[];
  locale: string;
}) {
  const { t } = useTranslation();
  const live = useLiveInterval();
  const [page, setPage] = useState(1);
  // Sorting by a column is the reader's, and the table is never rewritten for it.
  const [sort, setSort] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const query = { page, pageSize: PAGE_SIZE, sort: sort ? [sort] : [] };
  const rows = useQuery({
    queryKey: queryKeys.tableRows(notebookId, table.name, query),
    refetchInterval: live,
    placeholderData: keepPreviousData,
    queryFn: () => queryTable(notebookId, table.name, query),
  });

  const flip = (column: string) => {
    setPage(1);
    setSort((current) =>
      current?.column !== column
        ? { column, direction: 'asc' }
        : current.direction === 'asc'
          ? { column, direction: 'desc' }
          : null,
    );
  };

  // The widths come from the first answer and stay for the table (#491).
  const [widths, setWidths] = useState<Widths | null>(null);
  const [opened, setOpened] = useState<{ fields: TableRowField[]; rowId: string } | null>(null);
  if (widths === null && rows.data && rows.data.rows.length > 0) {
    setWidths(widthsOf(columns, rows.data.rows, locale, t));
  }

  if (rows.isError) return <p className="status">{t(messageKeyOf(rows.error))}</p>;
  if (!rows.data) {
    return (
      <SkeletonRegion>
        <SkeletonBar width="100%" height="8rem" />
      </SkeletonRegion>
    );
  }
  if (rows.data.total === 0) return <p>{t('tables.empty')}</p>;

  const pages = Math.max(1, Math.ceil(rows.data.total / rows.data.pageSize));
  const open = (row: { rowId: string; values: Record<string, unknown> }) =>
    setOpened({
      rowId: row.rowId,
      fields: columns.map((column) => ({
        name: column.name,
        value: formatCell(column, row.values[column.name], locale, t),
      })),
    });

  return (
    <>
      <div className="tables-grid-scroll">
        <table
          className="tables-grid is-fixed"
          style={widths ? { minWidth: widths.least } : undefined}
        >
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.name}
                style={widths?.of[column.name] ? { width: widths.of[column.name] } : undefined}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => {
                const sorted = sort?.column === column.name ? sort.direction : null;
                return (
                  <th
                    key={column.name}
                    scope="col"
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                    }
                    className={column.numeric ? 'is-numeric' : undefined}
                  >
                    <button
                      type="button"
                      className="tables-grid-sort"
                      title={column.name}
                      onClick={() => flip(column.name)}
                    >
                      <span className="tables-grid-sort-name">{column.name}</span>
                      <span className="tables-grid-arrow" aria-hidden="true">
                        {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.data.rows.map((row) => (
              <tr
                key={row.rowId}
                className="tables-grid-row"
                tabIndex={0}
                aria-haspopup="dialog"
                onClick={() => {
                  // A click that selected text was reading it, not opening the row.
                  if (window.getSelection()?.toString()) return;
                  open(row);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  open(row);
                }}
              >
                {columns.map((column) => (
                  <td key={column.name} className={column.numeric ? 'is-numeric' : undefined}>
                    {formatCell(column, row.values[column.name], locale, t)}
                  </td>
                ))}
              </tr>
            ))}
            {
              // A shorter last page keeps the height of a full one, so the
              // pager stays where it was (#491).
              pages > 1
                ? Array.from({ length: rows.data.pageSize - rows.data.rows.length }, (_, index) => (
                    <tr key={`filler-${index}`} className="tables-grid-filler" aria-hidden="true">
                      <td colSpan={columns.length}>&nbsp;</td>
                    </tr>
                  ))
                : null
            }
          </tbody>
        </table>
      </div>
      <ListPager
        page={rows.data.page}
        pages={pages}
        total={rows.data.total}
        size={rows.data.pageSize}
        onPage={setPage}
      />
      {opened ? (
        <TableRowDialog
          table={table.name}
          fields={opened.fields}
          // A row of the system table is a note, under its own identifier (#524).
          note={table.system ? noteAddress(notebookId, opened.rowId) : null}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </>
  );
}

/** The widths of a table's columns, fixed once (#491). */
interface Widths {
  /** The width of each column that is not text; text columns share the rest. */
  readonly of: Readonly<Record<string, string>>;
  /** The least width of the table, below which it scrolls sideways. */
  readonly least: string;
}

/** The least width a text column keeps, in `ch`. */
const TEXT_COLUMN = 16;
/** The padding of a cell, and the sort arrow of its header, in `ch`. */
const CELL_SPARE = 4;

/**
 * A date, a number and a yes or no take what their formatted values of the
 * first answer need, and their header; text and lists share what is left, so
 * no page and no order moves a column (#491), as the `table` block of a note
 * lays its own out.
 */
function widthsOf(
  columns: readonly ColumnView[],
  rows: readonly { values: Record<string, unknown> }[],
  locale: string,
  t: TFunction,
): Widths {
  const of: Record<string, string> = {};
  let fixed = 0;
  let texts = 0;
  for (const column of columns) {
    if (column.type === 'string' || column.type === 'list') {
      texts += 1;
      continue;
    }
    const need = Math.max(
      column.name.length,
      ...rows.map((row) => formatCell(column, row.values[column.name], locale, t).length),
    );
    const width = need + CELL_SPARE;
    of[column.name] = `${width}ch`;
    fixed += width;
  }
  return { of, least: `${fixed + texts * TEXT_COLUMN}ch` };
}

function TableSchemaView({
  table,
  columns,
  locale,
}: {
  table: NotebookTableDto;
  columns: ColumnView[];
  locale: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="tables-grid-scroll">
      <table className="tables-grid schema-table">
        <thead>
          <tr>
            <th scope="col">{t('tables.schema.column')}</th>
            <th scope="col">{t('tables.schema.type')}</th>
            <th scope="col">{t('tables.schema.required')}</th>
            <th scope="col">{t('tables.schema.default')}</th>
            <th scope="col">{t('tables.schema.description')}</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((column) => (
            <tr key={column.name}>
              <th scope="row">
                {column.name}
                {table.key?.includes(column.name) ? (
                  <span className="schema-key">{t('tables.schema.key')}</span>
                ) : null}
              </th>
              <td>
                {t(`tables.type.${column.type}`)}
                {column.allowed ? (
                  <span className="schema-allowed">{column.allowed.join(' · ')}</span>
                ) : null}
              </td>
              <td>{column.required ? t('tables.schema.yes') : t('tables.schema.no')}</td>
              <td>
                {column.default === undefined ? '' : formatCell(column, column.default, locale, t)}
              </td>
              <td>{column.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
