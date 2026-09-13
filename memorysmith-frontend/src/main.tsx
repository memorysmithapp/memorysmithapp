import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './app/query-client';
import { router } from './app/router';
import { configureHttp } from './shared/api/http';
import { endExpiredSession } from './app/session-expiry';
import { authConfig } from './shared/auth/session';
import { loadRuntimeConfig } from './shared/config/runtime-config';
import { documentTitleOf, withEnvironment } from './shared/components/document-title';
import './i18n';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root element');

/**
 * The configuration of the environment comes first, because nothing else can
 * run without it: where the API is, where the sign-in page is, and which
 * environment this is. A page that cannot read it says so and renders nothing,
 * rather than rendering a product pointed at no API.
 */
loadRuntimeConfig()
  .then((config) => {
    configureHttp({
      origin: config.apiOrigin,
      auth: authConfig(),
      onUnauthenticated: endExpiredSession,
    });
    document.title = withEnvironment(documentTitleOf(), config.environment);

    createRoot(container).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    container.textContent =
      error instanceof Error
        ? error.message
        : 'The configuration of this environment is unreadable.';
  });
