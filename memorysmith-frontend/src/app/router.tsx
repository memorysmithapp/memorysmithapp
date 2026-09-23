import { createBrowserRouter } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../shared/components/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { AuthCallbackPage } from '../features/auth/AuthCallbackPage';
import { GuidancePanel } from '../features/guidance/GuidancePanel';
import { FolderPage } from '../features/structure/FolderPage';
import { NoteRoute } from '../features/structure/NoteRoute';
import { ResumeReading } from '../features/structure/ResumeReading';
import { TemplatesPage } from '../features/structure/TemplatesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AboutPage, WelcomeGate } from '../features/about/AboutPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { PasswordPage } from '../features/profile/PasswordPage';
import { TransfersPage } from '../features/portability/TransfersPage';
import { GraphPage } from '../features/graph/GraphPage';
import { LinkTargetPage } from '../features/note/LinkTargetPage';
import { NotebookLayout } from '../features/structure/NotebookLayout';
import { RequireSession, RootLayout } from './RootLayout';

/**
 * Anything under a notebook that no route names, an address saved before 0.6.0
 * included. It is not redirected: resolving it would mean reading a name out
 * of an address, which is the tolerance the address gave up (RN-DSC-045).
 */
function NotFound() {
  const { t } = useTranslation();
  return <p className="status">{t('common.notFound')}</p>;
}

/**
 * Every address inside a notebook is an identifier, and the note is not nested
 * under its folder (RN-DSC-045). The breadcrumb, built from the structure
 * already loaded, is where the folder trail is read.
 */
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            children: [
              {
                path: '/',
                element: (
                  <WelcomeGate>
                    <DashboardPage />
                  </WelcomeGate>
                ),
              },
              // What the product is, opened once by itself and from the user
              // menu from then on (#167).
              { path: '/about', element: <AboutPage /> },
              // What a person is called, the face beside it, and the password
              // they sign in with (#168).
              { path: '/profile', element: <ProfilePage /> },
              { path: '/profile/password', element: <PasswordPage /> },
              { path: '/transfers', element: <TransfersPage /> },
              {
                path: '/notebooks/:notebookId',
                element: <NotebookLayout />,
                children: [
                  { index: true, element: <ResumeReading /> },
                  { path: 'guidance', element: <GuidancePanel /> },
                  { path: 'templates', element: <TemplatesPage /> },
                  { path: 'graph', element: <GraphPage /> },
                  { path: 'folders/:folderId', element: <FolderPage /> },
                  { path: 'notes/:noteId', element: <NoteRoute /> },
                  { path: 'links/:target', element: <LinkTargetPage /> },
                  { path: '*', element: <NotFound /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
