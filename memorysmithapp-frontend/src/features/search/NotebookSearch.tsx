import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotebookStructure } from '../../shared/types/api';
import { SearchIcon } from '../../shared/components/icons';
import { SearchBox, SHORTCUT } from './SearchBox';

/**
 * The search of a notebook, from the header (#418): a magnifier among the
 * icons on the right, and Ctrl K (⌘K on a Mac) from anywhere in the notebook.
 * Either opens the field over the page, under the header, with the results
 * under it.
 *
 * The panel is hidden rather than taken down when it closes, so what was typed
 * is still there when it opens again; Esc and a result chosen close it.
 */
export function NotebookSearch({
  notebookId,
  structure,
}: {
  notebookId: string;
  structure: NotebookStructure;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const label = t('search.openNotebook');

  // A result chosen is a page left: the panel goes with it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setOpen(true);
      // Already open: the key takes the focus back to the field.
      const field = panel.current?.querySelector('input');
      field?.focus();
      field?.select();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector('input')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panel.current?.contains(target) || trigger.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button notebook-search-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls="notebook-search"
        title={`${label} (${SHORTCUT})`}
        onClick={() => setOpen((value) => !value)}
      >
        <SearchIcon />
      </button>
      <div
        ref={panel}
        id="notebook-search"
        className="search-popover"
        role="dialog"
        aria-label={label}
        hidden={!open}
      >
        <SearchBox notebookId={notebookId} structure={structure} floating={false} />
      </div>
    </>
  );
}
