import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/components/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { GuidancePanel } from '../features/guidance/GuidancePanel';
import { NotePage } from '../features/note/NotePage';
import { FolderPage } from '../features/structure/FolderPage';
import { VaultLayout } from '../features/structure/VaultLayout';
import { VaultListPage } from '../features/vaults/VaultListPage';
import { RequireSession, RootLayout } from './RootLayout';

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <VaultListPage /> },
              {
                path: '/vaults/:vaultSlug',
                element: <VaultLayout />,
                children: [
                  { index: true, element: <GuidancePanel /> },
                  { path: 'folders/*', element: <FolderPage /> },
                  { path: 'notes/:noteSlug', element: <NotePage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
