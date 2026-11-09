import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { TransfersMenu } from '../../features/portability/TransfersMenu';
import { NotificationsMenu } from '../../features/sharing/NotificationsMenu';
import { UserMenu } from './UserMenu';
import { WriteStatus } from './WriteStatus';
import { ThemeToggle } from './ThemeToggle';
import { TopMenu } from './TopMenu';
import { HeaderSearchSlotProvider } from './HeaderSearchSlot';

/**
 * The header and the page under it (#418). The header carries the menu of the
 * product beside the brand, so a page outside a notebook has no sidebar and
 * keeps the whole width; a notebook puts its own sidebar under the header,
 * and its search among the icons on the right.
 */
export function AppShell() {
  /**
   * Where a notebook puts its search, among the icons. Held as state so the
   * page below draws into it once it exists: on the first render the header
   * has not reached the document yet.
   */
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);

  return (
    <HeaderSearchSlotProvider value={searchSlot}>
      <div className="app-shell">
        <header className="app-header">
          <Link to="/" className="brand">
            <BrandMark />
          </Link>
          {/* The slogan left the header for the sign-in screen, where it
              explains the product to who is not inside it yet (#414). */}
          <TopMenu />
          <span className="header-spacer" />
          <div className="header-search" ref={setSearchSlot} />
          {/* What happened to the write, where it can be seen from any scroll
              position and without covering a line of the note. */}
          <WriteStatus />
          <ThemeToggle />
          {/* An export or an import under way, beside the identity, where a
              browser shows its downloads; the page of transfers is in the
              menu (#418). */}
          <TransfersMenu />
          {/* What changed in a share, told to the side that did not change it
              (#256): its own button, because it is news about people and not
              about files. */}
          <NotificationsMenu />
          <UserMenu />
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </HeaderSearchSlotProvider>
  );
}
