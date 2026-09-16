import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { folderTrailOfNote, notesNamed, resolveLinkTarget } from '../api/source';
import { noteAddress } from '../api/note-address';

const TARGET_ADDRESS = /^\/notebooks\/([0-9a-hjkmnp-tv-z]{26})\/links\/(.+)$/i;

/** The notebook and the name a link-target address carries, or `null`. */
export function linkTargetOf(href: string): { notebookId: string; target: string } | null {
  const match = TARGET_ADDRESS.exec(href);
  if (!match?.[1] || !match[2]) return null;
  try {
    return {
      notebookId: match[1].toUpperCase(),
      target: decodeURIComponent(match[2]).normalize('NFC'),
    };
  } catch {
    return null;
  }
}

/**
 * A wikilink that no single note answers by name, and the choice it opens where
 * it stands (RN-DSC-046, RN-DSC-060).
 *
 * Two cases reach here. A name several notes carry is a choice, written as the
 * folder trail and the name of each, which is unique once a folder holds one
 * note of each name (RN-KNW-042). A name no note carries is drawn as pending
 * and still asks, because only Discovery knows the aliases: an alias may
 * answer it with one note, which opens, or with several, which is the choice.
 *
 * It stays a real link to the address of the target, so opening it in a new
 * tab, or with a modifier key, reaches the page that renders the same choice.
 */
export function LinkChoice({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const parsed = linkTargetOf(href);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['link-target', parsed?.notebookId, parsed?.target],
    queryFn: () => resolveLinkTarget(parsed?.notebookId ?? '', parsed?.target ?? ''),
    enabled: open && parsed !== null,
  });

  // One note answers, which only an alias can do here: the choice is a step
  // nobody asked for, so the click goes straight to the note.
  const only = data?.notes.length === 1 ? data.notes[0] : undefined;
  useEffect(() => {
    if (open && only && parsed) {
      setOpen(false);
      navigate(noteAddress(parsed.notebookId, only.noteId));
    }
  }, [open, only, parsed, navigate]);

  // Esc and a click outside close it, and the focus goes back to the link.
  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.MouseEvent) => {
      const within =
        menu.current?.contains(event.target as Node) ||
        anchor.current?.contains(event.target as Node);
      if (!within) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  useEffect(() => {
    if (open && data && data.notes.length > 1) {
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [open, data]);

  if (!parsed) return <span className="wikilink-pending">{children}</span>;

  const pending = notesNamed(parsed.notebookId, parsed.target) === 0;

  const toggle = (event: MouseEvent<HTMLAnchorElement>) => {
    // A modifier or a middle click keeps the ordinary behaviour of a link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setOpen((current) => !current);
  };

  const close = () => {
    setOpen(false);
    anchor.current?.focus();
  };

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <span className="link-choice">
      <a
        ref={anchor}
        href={href}
        className={pending ? 'wikilink-pending' : 'wikilink'}
        title={pending ? t('note.pendingLink') : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) close();
        }}
      >
        {children}
      </a>
      {open && !only && (
        <div
          ref={menu}
          className="link-choice-menu"
          role="menu"
          aria-label={t('note.linkChoice', { target: parsed.target })}
          onKeyDown={onMenuKey}
        >
          {isPending ? (
            <span className="link-choice-status" aria-busy="true">
              {t('common.loading')}
            </span>
          ) : isError || !data ? (
            <span className="link-choice-status">{t('errors.unexpected')}</span>
          ) : data.notes.length === 0 ? (
            <span className="link-choice-status">
              {t('note.targetPending', { target: parsed.target })}
            </span>
          ) : (
            <>
              <span className="link-choice-status">
                {data.by === 'alias' ? t('note.targetByAlias') : t('note.targetByName')}
              </span>
              {data.notes.map((note) => {
                const trail = folderTrailOfNote(parsed.notebookId, note.noteId);
                return (
                  <a
                    key={note.noteId}
                    role="menuitem"
                    className="link-choice-item"
                    href={noteAddress(parsed.notebookId, note.noteId)}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                      event.preventDefault();
                      setOpen(false);
                      navigate(noteAddress(parsed.notebookId, note.noteId));
                    }}
                  >
                    {[...trail, note.name || t('note.unnamed')].join(' › ')}
                  </a>
                );
              })}
            </>
          )}
        </div>
      )}
    </span>
  );
}
