import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../shared/components/AppShell';
import { GuidancePanel } from '../features/guidance/GuidancePanel';
import { NotePage } from '../features/note/NotePage';
import { FolderPage } from '../features/structure/FolderPage';
import { VaultLayout } from '../features/structure/VaultLayout';
import { VaultListPage } from '../features/vaults/VaultListPage';

export const router = createBrowserRouter([
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
]);
