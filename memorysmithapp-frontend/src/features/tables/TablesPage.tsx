import { useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NotebookTableDto, NoteRefDto } from '@memorysmithapp/contracts';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import { getTableUses } from '../../shared/api/backend';
import { deleteTable, listTables, queryTable } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { noteAddress, tablesAddress } from '../../shared/api/note-address';
import { useLiveInterval } from '../../shared/api/live';
import { formatBytes } from '../../shared/components/StorageBar';
import { Modal } from '../../shared/components/Modal';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { TableIcon, TrashIcon } from '../../shared/components/icons';
import { ActionWord } from '../../shared/components/ActionWord';
import { intlLocale } from '../../i18n/intl-locale';
import { columnsOf, formatCell, type ColumnView } from './cells';

const PAGE_SIZE = 25;

/**
 * The Tables of a notebook (#366, RN-KNW-077): each with what it is for, its
 * columns and how many rows it holds, and, open, its rows page by page and its
 * schema, column by column.
 *
 * Nothing is written here but a deletion: tables are created and their rows
 * written by an agent, through the connector. The page is how a person — the
 * Reader of a share too — sees what the agent kept. Deleting is for whoever
 * maintains the notebook, after saying how many rows go.
 */
export function TablesPage() {
  const { t, i18n } = useTranslation();
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
      <article className="content-pane tables-page">
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
            maintains={structure.permissions.maintain}
            notes={notesOf(chosen.name)}
            onDeleted={() => choose(null)}
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
                            {formatBytes(table.bytes, locale)}
                          </span>
                          {table.description ? (
                            <span className="table-row-desc">{table.description}</span>
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

function TableDetail({
  notebookId,
  table,
  locale,
  maintains,
  notes,
  onDeleted,
}: {
  notebookId: string;
  table: NotebookTableDto;
  locale: string;
  maintains: boolean;
  notes: readonly NoteRefDto[];
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('data');
  const [deleting, setDeleting] = useState(false);
  const columns = columnsOf(table);

  return (
    <section className="table-detail">
      <header className="table-detail-head">
        <div>
          <h1 className="table-detail-name">{table.name}</h1>
          {table.description ? <p className="table-detail-desc">{table.description}</p> : null}
          <p className="table-detail-meta">
            {t('tables.rows', { count: table.rows })} ·{' '}
            {t('tables.columns', { count: columns.length })}
            {table.key ? ` · ${t('tables.keyIs', { columns: table.key.join(', ') })}` : ''}
          </p>
        </div>
        {maintains ? (
          <button
            type="button"
            className="button is-quiet is-danger"
            onClick={() => setDeleting(true)}
          >
            <ActionWord icon={<TrashIcon />} word={t('tables.delete')} />
          </button>
        ) : null}
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
        <TableRows notebookId={notebookId} table={table} columns={columns} locale={locale} />
      ) : (
        <TableSchemaView table={table} columns={columns} locale={locale} />
      )}
      {deleting ? (
        <DeleteTableDialog
          notebookId={notebookId}
          table={table}
          notes={notes.length}
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
        />
      ) : null}
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
  const first = (rows.data.page - 1) * rows.data.pageSize + 1;
  const last = Math.min(rows.data.total, rows.data.page * rows.data.pageSize);

  return (
    <>
      <div className="data-table-scroll">
        <table className="data-table">
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
                      className="data-table-sort"
                      onClick={() => flip(column.name)}
                    >
                      {column.name}
                      <span className="data-table-arrow" aria-hidden="true">
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
              <tr key={row.rowId}>
                {columns.map((column) => (
                  <td key={column.name} className={column.numeric ? 'is-numeric' : undefined}>
                    {formatCell(column, row.values[column.name], locale, t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="data-table-pages" aria-label={t('tables.pages')}>
        <span>{t('tables.showing', { first, last, total: rows.data.total })}</span>
        <span className="data-table-page-buttons">
          <button
            type="button"
            className="button is-quiet is-small"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t('tables.previous')}
          </button>
          <button
            type="button"
            className="button is-quiet is-small"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {t('tables.next')}
          </button>
        </span>
      </nav>
    </>
  );
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
    <div className="data-table-scroll">
      <table className="data-table schema-table">
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

/**
 * Deleting a table (RN-KNW-071): one write that takes it and every row out of
 * reach at once, the rows destroyed in the background. It says how many rows go
 * and is deleted only once the person ticks that they understood.
 */
function DeleteTableDialog({
  notebookId,
  table,
  notes,
  onClose,
  onDeleted,
}: {
  notebookId: string;
  table: NotebookTableDto;
  notes: number;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [understood, setUnderstood] = useState(table.rows === 0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function remove(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await deleteTable(notebookId, table.name);
      await client.invalidateQueries({ queryKey: queryKeys.notebookTables(notebookId) });
      onDeleted();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={t('tables.deleteTitle')}
      subtitle={table.name}
      onClose={onClose}
      className="move-dialog folder-delete-dialog"
    >
      <div className="folder-delete">
        <p>{t('tables.deleteHolds', { count: table.rows })}</p>
        <p>{t('tables.deleteConsequences')}</p>
        {notes > 0 ? <p>{t('tables.deleteShownBy', { count: notes })}</p> : null}
        {table.rows > 0 ? (
          <label className="folder-delete-understood">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            <span>{t('tables.deleteUnderstood')}</span>
          </label>
        ) : null}
        {failure ? (
          <p className="move-refusal" role="alert">
            {failure}
          </p>
        ) : null}
        <div className="ask-dialog-foot">
          <button type="button" className="button is-quiet" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button is-danger is-filled"
            disabled={busy || !understood}
            onClick={() => void remove()}
          >
            {busy ? t('tables.deleting') : t('tables.deleteConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
