import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CloseIcon, MenuLinesIcon } from './icons';
import { GlobalSearch } from './GlobalSearch';
import { TopMenu } from './TopMenu';

/**
 * The menu of a phone (#419): below 860 px the header is one row, and its ☰
 * opens from the top, under the header, everything the wide window shows in
 * the second row and in the sidebar of a notebook: the search, the menu of the
 * product, and inside a notebook the notebook in groups, ending in its tree.
 * It replaced the sheet that rose from the foot of the screen (#229), where
 * people got lost. It closes on a page chosen, on Esc and on a tap outside.
 */
interface MenuState {
  open: boolean;
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  slot: HTMLElement | null;
  setSlot: (slot: HTMLDivElement | null) => void;
}

const MenuContext = createContext<MenuState | null>(null);

export function MobileMenuProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  // A page chosen is what the menu was opened for.
  useEffect(() => setOpen(false), [pathname]);
  return (
    <MenuContext.Provider value={{ open, setOpen, slot, setSlot }}>{children}</MenuContext.Provider>
  );
}

/** The ☰, before the brand. */
export function MobileMenuButton() {
  const { t } = useTranslation();
  const menu = useContext(MenuContext);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = menu?.open ?? false;

  // Closing gives the focus back to the button that opened it.
  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    return () => opener?.focus({ preventScroll: true });
  }, [open]);

  return (
    <button
      ref={trigger}
      type="button"
      className="icon-button is-bare mobile-menu-trigger"
      aria-label={t(open ? 'nav.closeMenu' : 'nav.openMenu')}
      aria-expanded={open}
      aria-controls="mobile-menu"
      onClick={() => menu?.setOpen((value) => !value)}
    >
      {open ? <CloseIcon /> : <MenuLinesIcon />}
    </button>
  );
}

/** What the ☰ opens, under the header. */
export function MobileMenuPanel() {
  const { t } = useTranslation();
  const menu = useContext(MenuContext);
  const panel = useRef<HTMLDivElement>(null);
  const open = menu?.open ?? false;

  useEffect(() => {
    if (!open) return;
    panel.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) menu?.setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, menu]);

  return (
    <>
      {open ? (
        <div
          className="mobile-menu-scrim"
          onClick={() => menu?.setOpen(false)}
          aria-hidden="true"
        />
      ) : null}
      {/* Kept in the page while it is closed, so a notebook draws its part
          into it once, and the tree keeps what was opened in it. */}
      <div
        ref={panel}
        id="mobile-menu"
        className="mobile-menu"
        role="dialog"
        aria-label={t('nav.label')}
        tabIndex={-1}
        hidden={!open}
      >
        <GlobalSearch />
        <TopMenu layout="list" />
        <div ref={menu?.setSlot} className="mobile-menu-notebook" />
      </div>
    </>
  );
}

/** Draws the notebook's part of the menu inside it (#419). */
export function MobileMenuNotebook({ children }: { children: ReactNode }) {
  const slot = useContext(MenuContext)?.slot ?? null;
  return slot ? createPortal(children, slot) : null;
}
