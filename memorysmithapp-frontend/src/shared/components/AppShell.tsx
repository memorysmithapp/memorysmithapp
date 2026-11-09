import { useEffect, useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { TransfersMenu } from '../../features/portability/TransfersMenu';
import { NotificationsMenu } from '../../features/sharing/NotificationsMenu';
import { UserMenu } from './UserMenu';
import { WriteStatus } from './WriteStatus';
import { ThemeToggle } from './ThemeToggle';
import { AppSidebar } from './AppSidebar';
import { HeaderSearchSlotProvider } from './HeaderSearchSlot';
import { NARROW_NOTEBOOK, useMatchMedia } from '../lib/media';

export function AppShell() {
  /**
   * The middle of the header, where a notebook puts its search (#414). Held
   * as state so the page below draws into it once it exists: on the first
   * render the header has not reached the document yet.
   */
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  // Inside a notebook its own sidebar takes the column; a phone has none.
  const inNotebook = useMatch('/notebooks/:notebookId/*') !== null;
  const narrow = useMatchMedia(NARROW_NOTEBOOK);

  // Ctrl K (⌘K on a Mac) goes to the search wherever the focus is.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      const field = searchSlot?.querySelector('input');
      if (!field) return;
      event.preventDefault();
      field.focus();
      field.select();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [searchSlot]);

  return (
    <HeaderSearchSlotProvider value={searchSlot}>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="brand">
            <BrandMark />
          </Link>
          {/* The slogan left the header for the sign-in screen, where it
              explains the product to who is not inside it yet (#414). */}
          <div className="header-search" ref={setSearchSlot} />
          {/* What happened to the write, where it can be seen from any scroll
              position and without covering a line of the note. */}
          <WriteStatus />
          <ThemeToggle />
          {/* Files on their way in and out, in the place a browser puts its
              downloads: beside the identity, never as a bell (RN-PRT-019). */}
          <TransfersMenu />
          {/* What changed in a share, told to the side that did not change it
              (#256): its own button, because it is news about people and not
              about files. */}
          <NotificationsMenu />
          <UserMenu />
        </header>
        <div className="app-body">
          {inNotebook || narrow ? null : <AppSidebar />}
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </HeaderSearchSlotProvider>
  );
}
