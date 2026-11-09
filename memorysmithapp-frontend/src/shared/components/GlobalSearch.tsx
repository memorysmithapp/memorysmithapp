import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listModels, listNotebooks, searchCatalog } from '../api/source';
import { queryKeys } from '../api/query-keys';
import {
  communityModelAddress,
  modelAddress,
  notebookAddress,
  sharedModelAddress,
} from '../api/note-address';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../../features/dashboard/catalogue';
import { BookIcon, CopyIcon, GlobeIcon, SearchIcon } from './icons';

/** Long enough that a typed word asks the catalog once. */
const DEBOUNCE_MS = 250;
/** As many of each kind as a glance reads; the pages hold the rest. */
const PER_GROUP = 6;

interface Hit {
  key: string;
  name: string;
  detail: string | null;
  to: string;
}

/**
 * Search, from the menu of the product (#418): notebooks, models and community
 * models, found by what they are called. The notebooks and the models are the
 * lists the pages already read, narrowed here; the community is asked, since
 * it is larger than any list a page holds. What is inside the notes of a
 * notebook is searched from the top of the notebook's sidebar.
 */
export function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [typed, setTyped] = useState('');
  const [debounced, setDebounced] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // A result chosen is a page left: the search goes with it.
  useEffect(() => onClose(), [pathname, onClose]);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    field.current?.select();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    function onPointerDown(event: MouseEvent) {
      if (!panel.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, onClose]);

  const notebooks = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    enabled: open,
  });
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels, enabled: open });
  const community = useQuery({
    queryKey: queryKeys.catalog(debounced, null),
    queryFn: () => searchCatalog({ text: debounced, language: null }),
    enabled: open && debounced !== '',
  });

  const wanted = typed.trim().toLocaleLowerCase(locale);

  const groups = useMemo((): Array<{
    key: string;
    title: string;
    icon: ReactElement;
    hits: Hit[];
  }> => {
    if (wanted === '') return [];
    const matches = (text: string) => text.toLocaleLowerCase(locale).includes(wanted);
    const ownNotebooks = byName(notebooks.data ?? [], locale)
      .filter((notebook) => matches(notebook.name))
      .slice(0, PER_GROUP)
      .map((notebook) => ({
        key: notebook.id,
        name: notebook.name,
        detail: notebook.description || null,
        to: notebookAddress(notebook.id),
      }));
    const ownModels = byName(models.data ?? [], locale)
      .filter((model) => matches(model.name) || matches(model.objective))
      .slice(0, PER_GROUP)
      .map((model) => ({
        key: model.notebookId,
        name: model.name,
        detail: model.objective || null,
        to:
          model.sharedBy === null
            ? modelAddress(model.notebookId)
            : sharedModelAddress(model.notebookId),
      }));
    const published = (debounced === typed.trim() ? (community.data ?? []) : [])
      .slice(0, PER_GROUP)
      .map((model) => ({
        key: model.publicId,
        name: model.name,
        detail: model.author,
        to: communityModelAddress(model.publicId),
      }));
    return [
      {
        key: 'notebooks',
        title: t('globalSearch.groups.notebooks'),
        icon: <BookIcon />,
        hits: ownNotebooks,
      },
      {
        key: 'models',
        title: t('globalSearch.groups.models'),
        icon: <CopyIcon />,
        hits: ownModels,
      },
      {
        key: 'community',
        title: t('globalSearch.groups.community'),
        icon: <GlobeIcon />,
        hits: published,
      },
    ].filter((group) => group.hits.length > 0);
  }, [wanted, notebooks.data, models.data, community.data, debounced, typed, locale, t]);

  if (!open) return null;

  const first = groups[0]?.hits[0];
  const waiting = wanted !== '' && (community.isFetching || debounced !== typed.trim());

  return (
    <div
      ref={panel}
      className="search-popover global-search"
      role="dialog"
      aria-label={t('nav.search')}
    >
      <div className="search-box">
        <SearchIcon className="search-box-icon" width={15} height={15} />
        <input
          ref={field}
          type="search"
          value={typed}
          placeholder={t('globalSearch.placeholder')}
          aria-label={t('globalSearch.placeholder')}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // Enter opens the first thing found.
            if (event.key === 'Enter' && first) navigate(first.to);
          }}
        />
      </div>
      <div className="global-search-results">
        {wanted === '' ? (
          <p className="search-empty">{t('globalSearch.typeMore')}</p>
        ) : groups.length === 0 ? (
          <p className="search-empty">
            {waiting ? t('search.searching') : t('globalSearch.nothing')}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="global-search-group" aria-label={group.title}>
              <p className="global-search-title">{group.title}</p>
              <ul>
                {group.hits.map((hit) => (
                  <li key={hit.key}>
                    <Link to={hit.to} onClick={onClose}>
                      {group.icon}
                      <span className="global-search-name">{hit.name}</span>
                      {hit.detail ? (
                        <span className="global-search-detail">{hit.detail}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
