// The notebook search.
//
// What it types goes to the source untouched: the whole query language lives
// in the backend (software-vision.md 10.2), and a box that pre-filtered here
// would either duplicate that grammar or quietly break it. The screen's job is
// to debounce, to show the passage the match came from and to resolve the note
// identifier of a hit into the URL the reader clicks.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { FolderNode, SearchHit, NotebookStructure } from '../../shared/types/api';
import { searchNotes } from '../../shared/api/source';
import { noteAddress } from '../../shared/api/note-address';
import { ApiError } from '../../shared/api/error-mapper';
import { highlight } from './highlight';
import { SearchIcon } from '../../shared/components/icons';
import { queryKeys } from '../../shared/api/query-keys';

/** Long enough that a typed word is one request, short enough to feel live. */
const DEBOUNCE_MS = 250;
const MAX_HITS = 20;

interface FlatNote {
  id: string;
  /** Where the note lives, built from its identifier (RN-DSC-045). */
  address: string;
  name: string | null;
  folderPath: string;
}

function flatten(notebookId: string, folders: FolderNode[], trail: string[] = []): FlatNote[] {
  return folders.flatMap((folder) => {
    const path = [...trail, folder.name];
    return [
      ...folder.notes.map((note) => ({
        id: note.id,
        address: noteAddress(notebookId, note.id),
        name: note.name,
        folderPath: path.join(' / '),
      })),
      ...flatten(notebookId, folder.children, path),
    ];
  });
}

/**
 * The excerpt arrives as the note was written, which means Markdown: a heading
 * marker, a list bullet, a callout, a table row. Shown as one line of prose,
 * that punctuation reads as noise, so it comes off. Nothing is added and no
 * word is changed: the reader has to recognise the sentence when they open the
 * note.
 */
function readable(excerpt: string): string {
  return excerpt
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*>\s*(?:\[![a-z]+\]\s*)?/i, '')
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*+]\s+/, '')
        // A table separator carries no words at all.
        .replace(/^\s*\|?[\s|:-]*\|[\s|:-]*$/, '')
        .replace(/\|/g, ' '),
    )
    .join(' ')
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_all, target: string, label?: string) => label ?? target,
    )
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface SearchBoxProps {
  notebookId: string;
  structure: NotebookStructure;
  /** Take the focus on arrival, as the search of the phone sheet does (#229). */
  autoFocus?: boolean;
  /**
   * Whether the results float over the reading, as a menu of 460 px anchored to
   * the field (#232). In the phone sheet they sit under the field instead.
   */
  floating?: boolean;
}

/** Where a floating list is drawn: against the window, since the sidebar clips. */
interface Anchor {
  top: number;
  left: number;
  maxHeight: number;
}

export function SearchBox({
  notebookId,
  structure,
  autoFocus = false,
  floating = true,
}: SearchBoxProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // A hit names a note by identifier; the tree the page is already showing is
  // what turns it into a name, a path and a link.
  const byId = useMemo(
    () => new Map(flatten(notebookId, structure.folders).map((note) => [note.id, note])),
    [structure, notebookId],
  );

  const { data, isFetching, error } = useQuery({
    queryKey: queryKeys.notebookSearch(notebookId, debounced),
    queryFn: () => searchNotes(notebookId, debounced, MAX_HITS),
    enabled: debounced !== '',
    // The previous answer stays on screen while the next one is in flight, so
    // the list does not blink empty between two keystrokes.
    placeholderData: (previous: SearchHit[] | undefined) => previous,
    retry: false,
    staleTime: 30_000,
  });

  const results = useMemo(
    () =>
      (data ?? []).flatMap((hit) => {
        const note = byId.get(hit.note.noteId);
        return note ? [{ hit, note, url: note.address }] : [];
      }),
    [data, byId],
  );

  const typed = query.trim();
  /**
   * A click outside puts the list away without throwing the query out; the
   * field brings it back when it is focused or typed in again.
   */
  const [dismissed, setDismissed] = useState(false);
  const open = typed !== '' && !dismissed;
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (box.current?.contains(target) || panel.current?.contains(target)) return;
      setDismissed(true);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  /**
   * The list is wider than the sidebar and passes over the reading, so it is
   * placed against the window from where the field is: anchored inside the
   * sidebar it would be cut at its edge, which scrolls and therefore clips.
   */
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  useLayoutEffect(() => {
    if (!open || !floating) return;
    function place() {
      const rect = box.current?.getBoundingClientRect();
      if (!rect) return;
      const top = rect.bottom + 6;
      setAnchor({ top, left: rect.left, maxHeight: Math.max(160, window.innerHeight - top - 16) });
    }
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
    };
  }, [open, floating]);

  // The list is open over the sidebar wherever the focus went, so Esc closes it
  // wherever the focus is (#192): a handler on the input alone answered only
  // while the reader was still typing. A key some other surface already took —
  // a dialog closing on the same Esc — is left to that surface.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) setQuery('');
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const busy = isFetching || typed !== debounced;

  const failure =
    error instanceof ApiError && error.code === 'VALIDATION'
      ? t('search.invalid')
      : error
        ? t('search.failed')
        : null;

  return (
    <div className="search-box" ref={box}>
      <SearchIcon className="search-box-icon" width={15} height={15} />
      <input
        type="search"
        value={query}
        placeholder={t('search.placeholder')}
        autoFocus={autoFocus}
        onFocus={() => setDismissed(false)}
        onChange={(e) => {
          setDismissed(false);
          setQuery(e.target.value);
        }}
      />
      {open && (
        <div
          ref={panel}
          className={`search-results${floating ? ' is-floating' : ''}`}
          style={
            floating && anchor
              ? { top: anchor.top, left: anchor.left, maxHeight: anchor.maxHeight }
              : undefined
          }
        >
          {failure ? (
            <p className="search-empty">{failure}</p>
          ) : results.length > 0 ? (
            <ul>
              {results.map(({ hit, note, url }) => (
                <li key={hit.note.noteId}>
                  <Link to={url} onClick={() => setQuery('')}>
                    <span className="search-name">{note.name ?? t('note.unnamed')}</span>
                    <span className="search-path">
                      {note.folderPath}
                      {hit.section ? ` · ${hit.section}` : ''}
                    </span>
                    {hit.excerpt !== '' && (
                      <span className="search-excerpt">
                        {highlight(readable(hit.excerpt), debounced)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="search-empty">{busy ? t('search.searching') : t('search.empty')}</p>
          )}
          <p className="search-hint">
            <Trans i18nKey="search.syntaxHint" components={{ c: <code /> }} />
          </p>
        </div>
      )}
    </div>
  );
}
