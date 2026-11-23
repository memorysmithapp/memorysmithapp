import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../shared/components/AppShell';
// The sign-in is the first screen of most visits, and the root layout already
// imports from it: it stays in the entry.
import { LoginPage } from '../features/auth/LoginPage';
import { lazyPage } from './lazy-page';
import {
  communityModelAddress,
  identifierOf,
  modelAddress,
  sharedModelAddress,
} from '../shared/api/note-address';
import { RequireSession, RootLayout } from './RootLayout';

// Every other page arrives when it is opened (#547; the charts first, #368).
const AuthCallbackPage = lazyPage(() =>
  import('../features/auth/AuthCallbackPage').then((module) => module.AuthCallbackPage),
);
const GuidancePanel = lazyPage(() =>
  import('../features/guidance/GuidancePanel').then((module) => module.GuidancePanel),
);
const StylePage = lazyPage(() =>
  import('../features/structure/StylePage').then((module) => module.StylePage),
);
const FolderPage = lazyPage(() =>
  import('../features/structure/FolderPage').then((module) => module.FolderPage),
);
const FoldersPage = lazyPage(() =>
  import('../features/structure/FoldersPage').then((module) => module.FoldersPage),
);
const NoteRoute = lazyPage(() =>
  import('../features/structure/NoteRoute').then((module) => module.NoteRoute),
);
const NotebookOverview = lazyPage(() =>
  import('../features/structure/NotebookOverview').then((module) => module.NotebookOverview),
);
const NotebookContextPage = lazyPage(() =>
  import('../features/structure/NotebookContextPage').then((module) => module.NotebookContextPage),
);
const TemplatesPage = lazyPage(() =>
  import('../features/structure/TemplatesPage').then((module) => module.TemplatesPage),
);
const DashboardPage = lazyPage(() =>
  import('../features/dashboard/DashboardPage').then((module) => module.DashboardPage),
);
const AboutPage = lazyPage(() =>
  import('../features/about/AboutPage').then((module) => module.AboutPage),
);
const WelcomeGate = lazyPage(() =>
  import('../features/about/AboutPage').then((module) => module.WelcomeGate),
);
const ProfilePage = lazyPage(() =>
  import('../features/profile/ProfilePage').then((module) => module.ProfilePage),
);
const PasswordPage = lazyPage(() =>
  import('../features/profile/PasswordPage').then((module) => module.PasswordPage),
);
const TransfersPage = lazyPage(() =>
  import('../features/portability/TransfersPage').then((module) => module.TransfersPage),
);
const GraphPage = lazyPage(() =>
  import('../features/graph/GraphPage').then((module) => module.GraphPage),
);
const AttachmentsPage = lazyPage(() =>
  import('../features/attachments/AttachmentsPage').then((module) => module.AttachmentsPage),
);
const TablesPage = lazyPage(() =>
  import('../features/tables/TablesPage').then((module) => module.TablesPage),
);
const PrintDashboardPage = lazyPage(() =>
  import('../features/dashboards/PrintDashboardPage').then((module) => module.PrintDashboardPage),
);
const DashboardsPage = lazyPage(() =>
  import('../features/dashboards/DashboardsPage').then((module) => module.DashboardsPage),
);
const LinkTargetPage = lazyPage(() =>
  import('../features/note/LinkTargetPage').then((module) => module.LinkTargetPage),
);
const PrintNotePage = lazyPage(() =>
  import('../features/note/PrintNotePage').then((module) => module.PrintNotePage),
);
const GeneratePdfPage = lazyPage(() =>
  import('../features/note/GeneratePdfPage').then((module) => module.GeneratePdfPage),
);
const PreviewNotePage = lazyPage(() =>
  import('../features/note/PreviewNotePage').then((module) => module.PreviewNotePage),
);
const NotebookLayout = lazyPage(() =>
  import('../features/structure/NotebookLayout').then((module) => module.NotebookLayout),
);
const ModelPage = lazyPage(() =>
  import('../features/models/ModelPage').then((module) => module.ModelPage),
);
const SharedModelPage = lazyPage(() =>
  import('../features/models/ModelPage').then((module) => module.SharedModelPage),
);
const ModelsPage = lazyPage(() =>
  import('../features/models/ModelsPage').then((module) => module.ModelsPage),
);
const NotebooksPage = lazyPage(() =>
  import('../features/dashboard/NotebooksPage').then((module) => module.NotebooksPage),
);
const CommunityModelPage = lazyPage(() =>
  import('../features/community/CommunityPages').then((module) => module.CommunityModelPage),
);
const CommunityPage = lazyPage(() =>
  import('../features/community/CommunityPages').then((module) => module.CommunityPage),
);

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
 * The address of a version of a model, kept by a bookmark from before #431: a
 * model has no versions any more, so it opens the model as it stands rather
 * than answering not-found. A model shared as a model reader and a community
 * model open on what they hold; one's own has no Contents, since its notebook
 * is read by navigating it, and opens on its first tab (#435).
 */
function OldModelVersion({ kind }: { kind: 'own' | 'shared' | 'community' }) {
  const { notebookId, publicId } = useParams();
  const id = identifierOf(kind === 'community' ? publicId : notebookId);
  if (!id) return <NotFound />;
  const address =
    kind === 'community'
      ? communityModelAddress(id)
      : kind === 'shared'
        ? sharedModelAddress(id)
        : modelAddress(id);
  return <Navigate to={kind === 'own' ? address : `${address}?tab=contents`} replace />;
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
          // Drawn as the sign-in screen, outside the frame of the application,
          // because the secret of the account is typed there too (#214).
          { path: '/profile/password', element: <PasswordPage /> },
          // A note laid on A4 pages, opened by the renderer of the server to
          // make its PDF (#263) and never from the interface (#522).
          { path: '/notebooks/:notebookId/notes/:noteId/print', element: <PrintNotePage /> },
          // The tab that becomes a note's PDF (#522), outside the frame of the
          // application, as the file it turns into is.
          { path: '/notebooks/:notebookId/notes/:noteId/pdf', element: <GeneratePdfPage /> },
          // A note or a draft drawn for an agent to see, opened by the renderer
          // of the server and never from the interface (#260): outside the
          // frame of the application, at the reading width.
          { path: '/notebooks/:notebookId/preview', element: <PreviewNotePage /> },
          // A dashboard drawn whole for its image, opened by the same renderer (#368).
          {
            path: '/notebooks/:notebookId/dashboards/print',
            element: <PrintDashboardPage />,
          },
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
              // Every notebook, as cards (#418).
              { path: '/notebooks', element: <NotebooksPage /> },
              // What the product is, opened once by itself and from the menu
              // of the header from then on (#167, #418).
              { path: '/about', element: <AboutPage /> },
              // The community catalog, read by a person signed in, inside the
              // frame and its menu (#360, #418, RN-PRT-079).
              { path: '/community', element: <CommunityPage /> },
              { path: '/community/:publicId', element: <CommunityModelPage /> },
              {
                path: '/community/:publicId/versions/:version',
                element: <OldModelVersion kind="community" />,
              },
              // What a person is called, the face beside it, and the password
              // they sign in with (#168).
              { path: '/profile', element: <ProfilePage /> },
              { path: '/transfers', element: <TransfersPage /> },
              // The models a person reads, and where a new one starts (#418).
              { path: '/models', element: <ModelsPage /> },
              // A model shared as a model reader opens no notebook (#355).
              { path: '/models/:notebookId', element: <SharedModelPage /> },
              {
                path: '/models/:notebookId/versions/:version',
                element: <OldModelVersion kind="shared" />,
              },
              {
                path: '/notebooks/:notebookId',
                element: <NotebookLayout />,
                children: [
                  // What the notebook is, on one screen (#417); its Context is
                  // a page of its own.
                  { index: true, element: <NotebookOverview /> },
                  { path: 'context', element: <NotebookContextPage /> },
                  { path: 'guidance', element: <GuidancePanel /> },
                  { path: 'style', element: <StylePage /> },
                  { path: 'templates', element: <TemplatesPage /> },
                  { path: 'attachments', element: <AttachmentsPage /> },
                  { path: 'tables', element: <TablesPage /> },
                  {
                    path: 'dashboards',
                    element: <DashboardsPage />,
                  },
                  { path: 'graph', element: <GraphPage /> },
                  { path: 'model', element: <ModelPage /> },
                  { path: 'model/versions/:version', element: <OldModelVersion kind="own" /> },
                  { path: 'folders', element: <FoldersPage /> },
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
