import { Link, Outlet } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { TransfersMenu } from '../../features/portability/TransfersMenu';
import { NotificationsMenu } from '../../features/sharing/NotificationsMenu';
import { UserMenu } from './UserMenu';
import { WriteStatus } from './WriteStatus';
import { ThemeToggle } from './ThemeToggle';
import { TopMenu } from './TopMenu';

/**
 * The header in two rows and the page under it (#418). The first row is the
 * brand and the controls of the person; the second is the menu of the
 * product, and only it, on every page of the frame. A page outside a notebook
 * has no sidebar and keeps the whole width; a notebook puts its own sidebar
 * under the header.
 */
export function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <BrandMark />
        </Link>
        {/* The slogan left the header for the sign-in screen, where it
            explains the product to who is not inside it yet (#414). */}
        <span className="header-spacer" />
        {/* What happened to the write, where it can be seen from any scroll
            position and without covering a line of the note. */}
        <WriteStatus />
        <ThemeToggle />
        {/* An export or an import under way, beside the identity, where a
            browser shows its downloads; the page of transfers is in the menu
            (#418). */}
        <TransfersMenu />
        {/* What changed in a share, told to the side that did not change it
            (#256): its own button, because it is news about people and not
            about files. */}
        <NotificationsMenu />
        <UserMenu />
      </header>
      <div className="app-menu-row">
        <TopMenu />
      </div>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
