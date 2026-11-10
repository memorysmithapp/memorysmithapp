import { Link, Outlet } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { NotificationsMenu } from '../../features/sharing/NotificationsMenu';
import { UserMenu } from './UserMenu';
import { WriteStatus } from './WriteStatus';
import { TopMenu } from './TopMenu';
import { GlobalSearch } from './GlobalSearch';
import {
  MobileMenuButton,
  MobileMenuPanel,
  MobileMenuProvider,
  useCloseMobileMenu,
} from './MobileMenu';
import { NARROW_NOTEBOOK, useMatchMedia } from '../lib/media';

/**
 * The header in two rows and the page under it (#418). The first row is the
 * brand, the search and the controls of the person; the second is the menu of
 * the product, and only it, centred, on every page of the frame. A page outside a notebook
 * has no sidebar and keeps the whole width; a notebook puts its own sidebar
 * under the header. On a phone the header is one row, and the menu, the search
 * and the notebook's navigation are behind its ☰ (#419).
 */
export function AppShell() {
  // A phone, and a tablet in portrait: one row, and the rest behind the ☰ (#419).
  const narrow = useMatchMedia(NARROW_NOTEBOOK);

  return (
    <MobileMenuProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="header-start">
            {narrow ? <MobileMenuButton /> : null}
            {/* The brand leads Home, as the first entry of the menu does (#426). */}
            <Link to="/" className="brand">
              <BrandMark />
            </Link>
          </div>
          {/* The slogan left the header for the sign-in screen, where it
            explains the product to who is not inside it yet (#414). */}
          {/* Search, in the middle of the first row: notebooks, models and
            community models by name, and Ctrl K from anywhere (#418). */}
          {narrow ? <span /> : <GlobalSearch />}
          <HeaderControls />
        </header>
        {narrow ? (
          <MobileMenuPanel />
        ) : (
          <div className="app-menu-row">
            <TopMenu />
          </div>
        )}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </MobileMenuProvider>
  );
}

/**
 * The controls of the person, at the end of the first row. Their menus drop
 * from under the header on a phone, where the ☰ does, so pressing one closes
 * the ☰ first (#422).
 */
function HeaderControls() {
  const closeMobileMenu = useCloseMobileMenu();
  return (
    <div className="header-controls" onPointerDownCapture={closeMobileMenu}>
      {/* What happened to the write, where it can be seen from any scroll
        position and without covering a line of the note. */}
      <WriteStatus />
      {/* Light or dark is chosen in the user menu, and only there (#422). */}
      {/* What changed in a share, told to the side that did not change it
        (#256), and the status of the transfers, whose page is in the menu
        (#418). */}
      <NotificationsMenu />
      <UserMenu />
    </div>
  );
}
