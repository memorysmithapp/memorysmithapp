import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/components/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { GuidancePanel } from '../features/guidance/GuidancePanel';
import { FolderRoute } from '../features/structure/FolderRoute';
import { StructurePage } from '../features/structure/StructurePage';
import { TemplatesPage } from '../features/structure/TemplatesPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { GraphPage } from '../features/graph/GraphPage';
import { VaultLayout } from '../features/structure/VaultLayout';
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
              { path: '/', element: <DashboardPage /> },
              {
                path: '/vaults/:vaultSlug',
                element: <VaultLayout />,
                children: [
                  { index: true, element: <StructurePage /> },
                  { path: 'guidance', element: <GuidancePanel /> },
                  { path: 'templates', element: <TemplatesPage /> },
                  { path: 'graph', element: <GraphPage /> },
                  { path: 'folders/*', element: <FolderRoute /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
