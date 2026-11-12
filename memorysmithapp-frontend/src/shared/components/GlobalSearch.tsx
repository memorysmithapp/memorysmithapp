import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import {
  getNotebookStructure,
  listModels,
  listNotebooks,
  searchCatalog,
  searchNotes,
} from '../api/source';
import type { SearchHit } from '../types/api';
import { ApiError } from '../api/error-mapper';
import { queryKeys } from '../api/query-keys';
import {
  communityModelAddress,
  identifierOf,
  notebookAddress,
  sharedModelAddress,
} from '../api/note-address';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../../features/dashboard/catalogue';
import { BookIcon, CopyIcon, FileIcon, GlobeIcon, SearchIcon } from './icons';
import { flatten, readable } from '../../features/search/note-hits';
import { highlight } from '../../features/search/highlight';

/** Long enough that a typed word asks the catalog once. */
const DEBOUNCE_MS = 250;
/** As many of each kind as a glance reads; the pages hold the rest. */
const PER_GROUP = 6;
/** The notes of the notebook open, which is what is searched for most. */
const NOTES = 20;

/** ⌘K with a Command key, Ctrl K everywhere else. */
export const SHORTCUT = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
  ? '⌘K'
  : 'Ctrl K';

interface Hit {
  key: string;
  name: string;
  detail: string | null;
  /** The passage a note matched in, with the words searched marked. */
  excerpt?: ReactNode;
  to: string;
}

/**
 * The search of the product, a field in the first row of the header (#418):
 * notebooks, models and community models, found by what they are called, in
 * groups under the field. The notebooks and the models are the lists the pages
 * already read, narrowed here; the community is asked, since it is larger than
 * any list a page holds. Inside a notebook it also searches what its notes
 * say and the properties they declare, first, in the query language of the
 * backend. Ctrl K takes the focus to the field from anywhere.
 */
export function GlobalSearch() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [typed, setTyped] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  // The notebook open, whose notes are searched too.
  const notebookId = identifierOf(useMatch('/notebooks/:notebookId/*')?.params.notebookId) ?? '';

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(typed.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // A result chosen is a page left: the field is emptied and the list closes.
  useEffect(() => {
    setOpen(false);
    setTyped('');
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      field.current?.focus();
      field.current?.select();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      // A click outside puts the list away and keeps what was typed (#232).
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      // Esc empties it wherever the focus went (#192); a key some other
      // surface already took is left to that surface.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setTyped('');
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const wanted = typed.trim().toLocaleLowerCase(locale);
  const asking = open && wanted !== '';
  const notebooks = useQuery({
    queryKey: queryKeys.notebooks(),
    queryFn: listNotebooks,
    enabled: asking,
  });
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels, enabled: asking });
  // The tree the notebook already loaded, which turns a hit into a link.
  const structure = useQuery({
    queryKey: queryKeys.notebookStructure(notebookId),
    queryFn: () => getNotebookStructure(notebookId),
    enabled: notebookId !== '' && asking,
  });
  const notes = useQuery({
    queryKey: queryKeys.notebookSearch(notebookId, debounced),
    queryFn: () => searchNotes(notebookId, debounced, NOTES),
    enabled: notebookId !== '' && asking && debounced !== '',
    // The previous answer stays while the next is in flight, so the list does
    // not blink empty between two keystrokes.
    placeholderData: (previous: SearchHit[] | undefined) => previous,
    retry: false,
    staleTime: 30_000,
  });
  const community = useQuery({
    queryKey: queryKeys.catalog(debounced, null),
    queryFn: () => searchCatalog({ text: debounced, language: null }),
    enabled: asking && debounced !== '',
  });

  const groups = useMemo((): Array<{
    key: string;
    title: string;
    icon: ReactElement;
    hits: Hit[];
  }> => {
    if (wanted === '') return [];
    const matches = (text: string) => text.toLocaleLowerCase(locale).includes(wanted);
    const byId = new Map(
      flatten(notebookId, structure.data?.folders ?? []).map((note) => [note.id, note]),
    );
    const inNotebook = (notebookId === '' ? [] : (notes.data ?? [])).flatMap((hit) => {
      const note = byId.get(hit.note.noteId);
      if (!note) return [];
      const passage = readable(hit.excerpt);
      return [
        {
          key: hit.note.noteId,
          name: note.name ?? t('note.unnamed'),
          detail: `${note.folderPath}${hit.section ? ` · ${hit.section}` : ''}`,
          excerpt: passage ? highlight(passage, debounced) : undefined,
          to: note.address,
        },
      ];
    });
    // A notebook declared as a model is found among the models, and only
    // there (#422, RN-PRT-060).
    const modelIds = new Set((models.data ?? []).map((model) => model.notebookId.toLowerCase()));
    const ownNotebooks = byName(notebooks.data ?? [], locale)
      .filter((notebook) => !modelIds.has(notebook.id.toLowerCase()))
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
          // Of my own, its notebook's overview, as a notebook opens (#417).
          model.sharedBy === null
            ? notebookAddress(model.notebookId)
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
        key: 'notes',
        title: t('globalSearch.groups.notes', { notebook: structure.data?.notebook.name ?? '' }),
        icon: <FileIcon />,
        hits: inNotebook,
      },
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
  }, [
    wanted,
    notebooks.data,
    models.data,
    community.data,
    notes.data,
    structure.data,
    notebookId,
    debounced,
    typed,
    locale,
    t,
  ]);

  const first = groups[0]?.hits[0];
  const waiting = community.isFetching || notes.isFetching || debounced !== typed.trim();
  // A query the backend cannot read says so, in the words of the search of notes.
  const invalid = notes.error instanceof ApiError && notes.error.code === 'VALIDATION';

  return (
    <div ref={box} className="global-search" role="search">
      <div className="search-box">
        <SearchIcon className="search-box-icon" width={15} height={15} />
        <input
          ref={field}
          type="search"
          value={typed}
          placeholder={t(
            notebookId ? 'globalSearch.placeholderNotebook' : 'globalSearch.placeholder',
          )}
          aria-label={t('nav.search')}
          aria-expanded={asking}
          aria-controls="global-search-results"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setTyped(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            // Enter opens the first thing found.
            if (event.key === 'Enter' && first) navigate(first.to);
          }}
        />
        {typed === '' ? (
          <kbd className="search-box-key" aria-hidden="true">
            {SHORTCUT}
          </kbd>
        ) : null}
      </div>
      {asking ? (
        <div id="global-search-results" className="global-search-results">
          {notes.error ? (
            <p className="search-empty">{t(invalid ? 'search.invalid' : 'search.failed')}</p>
          ) : null}
          {groups.length === 0 ? (
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
                      <Link to={hit.to}>
                        {group.icon}
                        <span className="global-search-name">{hit.name}</span>
                        {hit.detail ? (
                          <span className="global-search-detail">{hit.detail}</span>
                        ) : null}
                        {hit.excerpt ? (
                          <span className="global-search-excerpt">{hit.excerpt}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
          {/* Inside a notebook, the language its notes are searched in. */}
          {notebookId ? (
            <p className="search-hint">
              <Trans i18nKey="search.syntaxHint" components={{ c: <code /> }} />
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
