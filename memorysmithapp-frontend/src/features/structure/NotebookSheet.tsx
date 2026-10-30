import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotebookStructure } from '../../shared/types/api';
import { ArrowLeftIcon } from '../../shared/components/icons';
import { SheetHandle, useSheetDrag } from '../../shared/components/Sheet';
import { SkeletonBar } from '../../shared/components/Skeleton';
import { FolderTreeSkeleton } from '../../shared/components/skeletons';
import { SearchBox } from '../search/SearchBox';
import { FolderTree } from './FolderTree';
import { NotebookNav } from './NotebookNav';

/**
 * The navigation of a notebook on a phone (#229): the sidebar becomes the
 * sheet of the Controles, and its trigger is where it comes out. The start of
 * the sheet is always showing at the foot of the screen; a tap or a drag up
 * raises it to 88 % of the height, over a dimmed page.
 *
 * It holds what the sidebar holds, the same menu with the same names (#375), so
 * a page of a notebook is never reachable on one and not on the other: the
 * search, the way back to every notebook, the name, the menu with the parts of
 * the Context folded, and the tree. It closes by dragging the handle down, a tap
 * outside, Esc, and by opening a page.
 */
export function NotebookSheet({
  notebookId,
  structure,
}: {
  notebookId: string;
  structure: NotebookStructure | undefined;
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const drag = useSheetDrag(close);
  const raise = useSheetDrag(
    () => undefined,
    () => setOpen(true),
  );

  // Opening a page is what the sheet was opened for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    box.current?.focus({ preventScroll: true });
    const opener = trigger.current;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    // While it is up the sheet is the only thing that scrolls.
    document.body.classList.add('has-sheet');
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.classList.remove('has-sheet');
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      {/* The start of the sheet, always showing: the handle, and the target
          a thumb reaches, which is taller than what it draws. */}
      <button
        ref={trigger}
        type="button"
        className="sheet-peek"
        aria-label={t('structure.openNavigation')}
        aria-expanded={open}
        aria-controls="notebook-sheet"
        onClick={() => setOpen(true)}
        onPointerDown={raise.onPointerDown}
        onPointerMove={raise.onPointerMove}
        onPointerUp={raise.onPointerUp}
      >
        <span className="sheet-handle" aria-hidden="true" />
      </button>
      {open ? (
        <>
          <div className="sheet-scrim" onClick={close} aria-hidden="true" />
          <div
            ref={box}
            id="notebook-sheet"
            className="notebook-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t('structure.openNavigation')}
            tabIndex={-1}
            style={drag.offset > 0 ? { transform: `translateY(${drag.offset}px)` } : undefined}
          >
            <SheetHandle drag={drag} />
            <div className="notebook-sheet-body">
              {structure ? (
                <SearchBox notebookId={notebookId} structure={structure} floating={false} />
              ) : null}
              <div className="sidebar-head">
                <Link to="/" className="back-link">
                  <ArrowLeftIcon width={14} height={14} />
                  {t('structure.backToNotebooks')}
                </Link>
                <h2 className="sidebar-notebook">
                  {structure ? (
                    structure.notebook.name
                  ) : (
                    <SkeletonBar width="10rem" height="1.4rem" />
                  )}
                </h2>
              </div>
              <NotebookNav notebookId={notebookId} folded />
              <p className="sidebar-caption">{t('structure.content')}</p>
              {structure ? (
                <FolderTree notebookId={notebookId} folders={structure.folders} />
              ) : (
                <FolderTreeSkeleton />
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
