import { existsSync, readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * `/config.json` for `vite dev`.
 *
 * In an environment the release publishes that file beside the bundle, with the
 * API, the sign-in page, the app client, the environment and the version it
 * serves (architecture-guide.md, 23.3). On a workstation there is no release,
 * so the dev server answers it from `config.local.json`, which is untracked and
 * points at a live environment. Nothing of it reaches a build: the file is not
 * in `public/`, and the plugin only runs while serving.
 */
function localRuntimeConfig(): Plugin {
  const local = new URL('./config.local.json', import.meta.url);
  return {
    name: 'memorysmith-local-runtime-config',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/config.json', (_request, response) => {
        if (!existsSync(local)) {
          response.statusCode = 404;
          response.end('Copy memorysmith-frontend/config.example.json to config.local.json.');
          return;
        }
        response.setHeader('content-type', 'application/json');
        response.setHeader('cache-control', 'no-store');
        response.end(readFileSync(local));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localRuntimeConfig()],
});
