import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandMark } from './BrandMark';
import { TransfersMenu } from '../../features/portability/TransfersMenu';
import { NotificationsMenu } from '../../features/sharing/NotificationsMenu';
import { UserMenu } from './UserMenu';
import { WriteStatus } from './WriteStatus';

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <BrandMark />
        </Link>
        {/* The slogan, after a hairline, on a surface with no band of colour
            behind it (#198): the blue is spent on actions, not on a header. */}
        <span className="header-divider" aria-hidden="true" />
        <span className="tagline">{t('app.tagline')}</span>
        <span className="header-spacer" />
        {/* What happened to the write, where it can be seen from any scroll
            position and without covering a line of the note. */}
        <WriteStatus />
        {/* Files on their way in and out, in the place a browser puts its
            downloads: beside the identity, never as a bell (RN-PRT-019). */}
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
  );
}
