import { useInfiniteQuery } from '@tanstack/react-query';
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
 * Enter picks, so the field never loses the focus while the rows change.
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
  ) => Promise<{ items: PickerItem[]; next: string | null }>;
}

export type PickerSource<K extends string> = LocalSource<K> | RemoteSource<K>;

/** How long the field waits for the person to stop typing before the server is asked. */
const SETTLE_MS = 250;

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
}: {
  /** What the picker as a whole asks, for whoever hears it read out. */
  label: string;
  placeholder: string;
  sources: ReadonlyArray<PickerSource<K>>;
  onPick: (source: K, item: PickerItem) => void;
  /** The tab it opens on; the first one when absent. */
  initial?: K;
}) {
  const { t } = useTranslation();
  const id = useId().replace(/:/g, '');
  const [active, setActive] = useState<K>(initial ?? (sources[0]?.key as K));
  const [text, setText] = useState('');
  const [settled, setSettled] = useState('');
  const [highlighted, setHighlighted] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text.trim()), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const source = sources.find((each) => each.key === active) ?? sources[0];
  const remote = source?.kind === 'remote' ? source : null;
  const pages = useInfiniteQuery({
    queryKey: [...(remote?.queryKey ?? ['picker-none']), settled],
    queryFn: ({ pageParam }) =>
      remote ? remote.search(settled, pageParam) : Promise.resolve({ items: [], next: null }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
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

  const rows: readonly PickerItem[] | undefined =
    source?.kind === 'local'
      ? filtered.get(source.key)
      : pages.data?.pages.flatMap((page) => page.items);

  // What is lit follows what is shown: a new search or tab starts at the top.
  useEffect(() => setHighlighted(0), [active, text, settled]);

  function choose(at: number): void {
    const item = rows?.[at];
    if (item && source) onPick(source.key, item);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    const last = (rows?.length ?? 0) - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((at) => Math.min(at + 1, Math.max(last, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((at) => Math.max(at - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(highlighted);
    }
  }

  const optionId = (at: number) => `${id}-option-${at}`;
  const waiting = source?.kind === 'local' ? rows === undefined : pages.isPending;

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
          aria-activedescendant={rows?.length ? optionId(highlighted) : undefined}
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
        ) : pages.isError && remote ? (
          <p className="status">{t('picker.failed')}</p>
        ) : !rows?.length ? (
          <p className="search-empty">{text.trim() ? t('picker.noMatch') : t('picker.none')}</p>
        ) : (
          <ul className="row-card search-picker-list" role="listbox" aria-label={label}>
            {rows.map((item, at) => (
              <li
                key={item.id}
                id={optionId(at)}
                role="option"
                aria-selected={at === highlighted}
                className={at === highlighted ? 'search-picker-row is-lit' : 'search-picker-row'}
                onMouseEnter={() => setHighlighted(at)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(at)}
              >
                <span className="search-picker-name">{item.name}</span>
                {item.by ? <span className="search-picker-by">{item.by}</span> : null}
                {item.line ? <span className="search-picker-line">{item.line}</span> : null}
              </li>
            ))}
          </ul>
        )}
        {remote && pages.hasNextPage ? (
          <button
            type="button"
            className="button is-quiet search-picker-more"
            disabled={pages.isFetchingNextPage}
            onClick={() => void pages.fetchNextPage()}
          >
            {pages.isFetchingNextPage ? t('picker.loading') : t('picker.more')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
