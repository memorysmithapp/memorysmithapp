import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIcon } from './icons';
import { Tabs } from './Tabs';

/**
 * One searchable picker of a notebook or a model (#432), drawn inside the
 * dialog that asks for it rather than as a pop-up: a field to type in, the
 * places the choice comes from as tabs, and a list of rows under them.
 *
 * A native select could list a handful; the community holds hundreds of
 * models, which a select can neither search nor page. A source the person's
 * own account bounds — their models, the ones shared with them, their
 * notebooks — is read whole and filtered here as they type; a source the
 * server bounds — the community — is searched there, a page at a time, the
 * newest published first, with *Show more*.
 *
 * The list is the keyboard's: the arrows move through it from the field and
 * Enter picks, so the field never loses the focus while the rows change. It
 * is drawn as the list of a folder (#416, #435), and serves the export too.
 */

/** One row of the picker. */
export interface PickerItem {
  readonly id: string;
  readonly name: string;
  /** What it is for, in one line, when it says. */
  readonly line?: string | null;
  /** Whose it is, when it is not the person's own. */
  readonly by?: string | null;
}

/** A place the choice comes from, read whole and filtered here. */
export interface LocalSource<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly kind: 'local';
  /** Undefined while it is read. */
  readonly items: readonly PickerItem[] | undefined;
}

/** A place the server searches, a page at a time. */
export interface RemoteSource<K extends string> {
  readonly key: K;
  readonly label: string;
  readonly kind: 'remote';
  /** What the answers are kept under, the text searched appended. */
  readonly queryKey: readonly unknown[];
  readonly search: (
    text: string,
    cursor: string | null,
  ) => Promise<{ items: PickerItem[]; next: string | null; total: number }>;
}

export type PickerSource<K extends string> = LocalSource<K> | RemoteSource<K>;

/** How long the field waits for the person to stop typing before the server is asked. */
const SETTLE_MS = 250;

/** How many rows a page of the picker shows, in every tab (#438). */
export const PICKER_PAGE = 20;

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Whether every word typed is in the name, the line or the owner of a row. */
export function matchesItem(item: PickerItem, text: string): boolean {
  const haystack = fold([item.name, item.line ?? '', item.by ?? ''].join(' '));
  return fold(text)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function SearchPicker<K extends string>({
  label,
  placeholder,
  sources,
  onPick,
  initial,
  chosen,
}: {
  /** What the picker as a whole asks, for whoever hears it read out. */
  label: string;
  placeholder: string;
  sources: ReadonlyArray<PickerSource<K>>;
  onPick: (source: K, item: PickerItem) => void;
  /** The tab it opens on; the first one when absent. */
  initial?: K;
  /**
   * The row picked and waiting to be confirmed, where a dialog asks for that
   * (#437): it stays marked while the keyboard and the mouse move on.
   */
  chosen?: string | null;
}) {
  const { t } = useTranslation();
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<K>(initial ?? (sources[0]?.key as K));
  const [text, setText] = useState('');
  const [settled, setSettled] = useState('');
  // The row the keyboard or the mouse is on; none until one of them moves (#444).
  const [highlighted, setHighlighted] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text.trim()), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const source = sources.find((each) => each.key === active) ?? sources[0];
  const remote = source?.kind === 'remote' ? source : null;

  // A page at a time, as the list of a folder (#438): the person's own and
  // the shared ones are paged here, the community on the server, where the
  // cursor of each page seen is kept so Previous returns to it.
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<ReadonlyArray<string | null>>([null]);
  useEffect(() => {
    setPage(1);
    setCursors([null]);
  }, [active, settled, text]);
  const cursor = cursors[page - 1] ?? null;
  const answer = useQuery({
    queryKey: [...(remote?.queryKey ?? ['picker-none']), settled, cursor],
    queryFn: () =>
      remote
        ? remote.search(settled, cursor)
        : Promise.resolve({ items: [], next: null, total: 0 }),
    enabled: remote !== null,
  });

  const filtered = useMemo(() => {
    const found = new Map<K, readonly PickerItem[] | undefined>();
    for (const each of sources) {
      if (each.kind === 'local') {
        found.set(
          each.key,
          each.items?.filter((item) => matchesItem(item, text)),
        );
      }
    }
    return found;
  }, [sources, text]);

  const local = source?.kind === 'local' ? filtered.get(source.key) : undefined;
  const total = source?.kind === 'local' ? (local?.length ?? 0) : (answer.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PICKER_PAGE));
  const rows: readonly PickerItem[] | undefined =
    source?.kind === 'local'
      ? local?.slice((page - 1) * PICKER_PAGE, page * PICKER_PAGE)
      : answer.data?.items;

  function turn(to: number): void {
    if (to < 1 || to > pages) return;
    if (remote && to > page && answer.data?.next) {
      const next = answer.data.next;
      setCursors((seen) => (seen.length > page ? seen : [...seen, next]));
    }
    setPage(to);
  }

  // What is lit follows what is shown: a new search, tab or page lights nothing.
  useEffect(() => setHighlighted(-1), [active, text, settled, page]);

  function choose(at: number): void {
    const item = rows?.[at];
    if (item && source) onPick(source.key, item);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    const last = (rows?.length ?? 0) - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((at) => Math.min(at + 1, last));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((at) => Math.max(at - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Enter with nothing lit takes the first row, as typing and Enter always did.
      choose(highlighted >= 0 ? highlighted : 0);
    }
  }

  const optionId = (at: number) => `${id}-option-${at}`;
  const waiting = source?.kind === 'local' ? rows === undefined : answer.isPending;
  // The radio of the row chosen, where the picker waits for Select (#438).
  const radio = chosen !== undefined;

  return (
    <div className="search-picker">
      <div className="search-box">
        <SearchIcon className="search-box-icon" width={15} height={15} />
        <input
          type="search"
          role="combobox"
          aria-label={label}
          aria-expanded="true"
          aria-controls={`${id}-panel`}
          aria-activedescendant={
            rows?.length && highlighted >= 0 ? optionId(highlighted) : undefined
          }
          aria-autocomplete="list"
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {sources.length > 1 ? (
        <Tabs
          id={id}
          label={label}
          active={active}
          onSelect={setActive}
          tabs={sources.map((each) => {
            const counted = each.kind === 'local' ? filtered.get(each.key) : undefined;
            return {
              key: each.key,
              label: each.label,
              ...(counted ? { total: counted.length } : {}),
            };
          })}
        />
      ) : null}
      <div id={`${id}-panel`} className="search-picker-panel">
        {waiting ? (
          <p className="status">{t('picker.loading')}</p>
        ) : answer.isError && remote ? (
          <p className="status">{t('picker.failed')}</p>
        ) : !rows?.length ? (
          <p className="search-empty">{text.trim() ? t('picker.noMatch') : t('picker.none')}</p>
        ) : (
          // The list of a folder (#416, #435): the name, what it is for and
          // whose it is, one column each. The rows are the options of the
          // listbox, so the table is drawn for the eye only, its head unread.
          <div className="tables-grid-scroll search-picker-list">
            <table
              className="tables-grid folder-notes-table search-picker-table"
              role="presentation"
            >
              <thead aria-hidden="true">
                <tr>
                  {radio ? <th className="search-picker-radio-cell" /> : null}
                  <th>{t('picker.columns.name')}</th>
                  <th>{t('picker.columns.line')}</th>
                  <th>{t('picker.columns.by')}</th>
                </tr>
              </thead>
              <tbody role="listbox" aria-label={label} onMouseLeave={() => setHighlighted(-1)}>
                {rows.map((item, at) => (
                  <tr
                    key={item.id}
                    id={optionId(at)}
                    role="option"
                    aria-selected={chosen === undefined ? at === highlighted : item.id === chosen}
                    className={[
                      'search-picker-row',
                      at === highlighted ? 'is-lit' : '',
                      item.id === chosen ? 'is-chosen' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setHighlighted(at)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(at)}
                  >
                    {radio ? (
                      <td className="search-picker-radio-cell">
                        <span
                          className={
                            item.id === chosen
                              ? 'search-picker-radio is-chosen'
                              : 'search-picker-radio'
                          }
                          aria-hidden="true"
                        />
                      </td>
                    ) : null}
                    <td className="folder-notes-name search-picker-name">{item.name}</td>
                    <td data-label={t('picker.columns.line')} className="search-picker-line">
                      {item.line ?? ''}
                    </td>
                    <td data-label={t('picker.columns.by')} className="search-picker-by">
                      {item.by ?? t('picker.yours')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          // The pager of the list of a folder, word for word (#438).
          <nav className="tables-grid-pages" aria-label={t('tables.pages')}>
            <span>
              {t('tables.showing', {
                first: (page - 1) * PICKER_PAGE + 1,
                last: Math.min(page * PICKER_PAGE, total),
                total,
              })}
            </span>
            <span className="tables-grid-page-buttons">
              <button
                type="button"
                className="button is-quiet is-small"
                disabled={page <= 1}
                onClick={() => turn(page - 1)}
              >
                {t('tables.previous')}
              </button>
              <button
                type="button"
                className="button is-quiet is-small"
                disabled={page >= pages || (remote !== null && answer.isFetching)}
                onClick={() => turn(page + 1)}
              >
                {t('tables.next')}
              </button>
            </span>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
