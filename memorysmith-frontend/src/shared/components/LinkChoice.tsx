import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { folderTrailOfNote, notesNamed, resolveLinkTarget } from '../api/source';
import { noteAddress } from '../api/note-address';
import { LinkChoiceContent, type LinkChoiceOption } from './LinkChoiceContent';

const TARGET_ADDRESS = /^\/notebooks\/([0-9a-hjkmnp-tv-z]{26})\/links\/(.+)$/i;

/**
 * How long a click may resolve before the dialog opens on placeholder rows.
 * Under it the dialog opens once, with its content; over it the click would
 * otherwise look ignored.
 */
const PATIENCE_MS = 150;

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
 * A wikilink that no single note answers by name, and the choice it opens
 * (RN-DSC-046, RN-DSC-060).
 *
 * Two cases reach here. A name several notes carry is a choice, told apart by
 * the folder each note lives in. A name no note carries is drawn as pending and
 * still asks, because only Discovery knows the aliases: an alias may answer it
 * with one note, which opens, or with several, which is the choice.
 *
 * **The choice is a DIALOG over the page, and it has to be.** It used to be a
 * menu positioned inside whatever held the link, and every table of a note
 * scrolls on its own: a link written in a table cell opened its menu inside the
 * scroll box of the table, clipped by it and growing a scrollbar of its own
 * (#144). `showModal()` puts the dialog in the top layer, which no ancestor can
 * clip, and brings the focus handling with it.
 *
 * The link stays a real link to the address of the target, so opening it in a
 * new tab, or with a modifier key, reaches the page that renders the same
 * explanation and the same options.
 */
export function LinkChoice({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const parsed = linkTargetOf(href);
  const [asked, setAsked] = useState(false);
  const [patient, setPatient] = useState(false);
  const anchor = useRef<HTMLAnchorElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['link-target', parsed?.notebookId, parsed?.target],
    queryFn: () => resolveLinkTarget(parsed?.notebookId ?? '', parsed?.target ?? ''),
    enabled: asked && parsed !== null,
  });

  const resolving = asked && isPending && !isError;

  // No dialog that flashes: the click marks the link as loading, and the
  // dialog opens either with its content or, past a moment, on placeholders.
  useEffect(() => {
    if (!resolving) return;
    const timer = setTimeout(() => setPatient(true), PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [resolving]);

  // One note answers, which only an alias can do here: the choice is a step
  // nobody asked for, so the click goes straight to the note.
  const only = data?.notes.length === 1 ? data.notes[0] : undefined;
  useEffect(() => {
    if (asked && only && parsed) {
      setAsked(false);
      setPatient(false);
      navigate(noteAddress(parsed.notebookId, only.noteId));
    }
  }, [asked, only, parsed, navigate]);

  const open = asked && !only && (patient || !resolving);

  /**
   * The dialog is modal or it is nothing: `open` as an attribute renders it
   * inline, inside the scroll box this exists to escape. While it is up the
   * page behind does not scroll.
   */
  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    if (!node.open) node.showModal();
    document.body.classList.add('has-modal');
    return () => document.body.classList.remove('has-modal');
  }, [open]);

  /** The first option takes the focus, and not the control that closes. */
  useEffect(() => {
    if (!open || resolving) return;
    dialog.current?.querySelector<HTMLElement>('.link-choice-option')?.focus();
  }, [open, resolving, data]);

  if (!parsed) return <span className="wikilink-pending">{children}</span>;

  const pending = notesNamed(parsed.notebookId, parsed.target) === 0;

  const ask = (event: MouseEvent<HTMLAnchorElement>) => {
    // A modifier or a middle click keeps the ordinary behaviour of a link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setAsked(true);
  };

  const close = () => {
    dialog.current?.close();
    setAsked(false);
    setPatient(false);
    anchor.current?.focus();
  };

  const options: LinkChoiceOption[] = (data?.notes ?? []).map((note) => ({
    noteId: note.noteId,
    name: note.name,
    trail: folderTrailOfNote(parsed.notebookId, note.noteId),
    address: noteAddress(parsed.notebookId, note.noteId),
  }));

  return (
    <span className="link-choice">
      <a
        ref={anchor}
        href={href}
        className={pending ? 'wikilink-pending' : 'wikilink'}
        title={pending ? t('note.pendingLink') : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={resolving && !open}
        onClick={ask}
      >
        {children}
      </a>
      {open && (
        <dialog
          ref={dialog}
          className="link-choice-dialog"
          aria-label={t('note.linkChoice', { target: parsed.target })}
          // Esc fires `cancel`, and a click on the backdrop lands on the
          // dialog element itself, never on the card inside it.
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === dialog.current) close();
          }}
        >
          <div className="link-choice-card">
            <header className="link-choice-header">
              <h2>{pending ? t('note.linkLeadsNowhere') : t('note.linkLeadsToSeveral')}</h2>
              <button type="button" className="link-choice-close" onClick={close}>
                <span aria-hidden="true">✕</span>
                <span className="visually-hidden">{t('common.close')}</span>
              </button>
            </header>
            <LinkChoiceContent
              target={parsed.target}
              by={data?.by ?? null}
              options={options}
              state={resolving ? 'loading' : isError || !data ? 'error' : 'ready'}
              onPick={(address) => {
                close();
                navigate(address);
              }}
            />
            <footer className="link-choice-footer">
              <button type="button" className="link-choice-cancel" onClick={close}>
                {t('common.cancel')}
              </button>
            </footer>
          </div>
        </dialog>
      )}
    </span>
  );
}
