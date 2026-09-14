/**
 * Every page of the interface, in the locale of the project that runs it
 * (software-vision.md, section 13; architecture-guide.md, section 19). Which
 * pages there are is read from the router, so a page added without a case
 * fails the Quality stage.
 */

import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { eventually } from '../support/eventually.js';
import { signInOnManagedLogin } from '../support/managed-login.js';
import { expect, speak, test } from './fixtures.js';

test.describe('signing in', () => {
  test('[page:/login] [page:/auth/callback] hands a person to the managed login and back, signed in', async ({
    page,
    state,
    appLocale,
    words,
  }) => {
    await speak(page, state, appLocale);
    const authorize = page.waitForRequest((request) =>
      request.url().startsWith(`${state.surfaces.auth}/oauth2/authorize`),
    );
    await page.goto(`${state.surfaces.site}/login`);

    const asked = new URL((await authorize).url());
    expect(asked.searchParams.get('code_challenge_method')).toBe('S256');
    expect(asked.searchParams.get('redirect_uri')).toBe(`${state.surfaces.site}/auth/callback`);
    expect(asked.searchParams.get('lang')).toBe(appLocale === 'pt_BR' ? 'pt-BR' : 'en');

    await signInOnManagedLogin(page, state.accounts.owner);
    await page.waitForURL(`${state.surfaces.site}/`, { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: words.openNotebook })).toBeVisible();
  });

  test('[page:/auth/callback] says why a sign-in did not complete, and offers to try again', async ({
    page,
    state,
    appLocale,
    words,
  }) => {
    await speak(page, state, appLocale);
    await page.goto(
      `${state.surfaces.site}/auth/callback?error=access_denied&error_description=${encodeURIComponent('Refused by a functional case')}`,
    );

    await expect(page.getByText('Refused by a functional case')).toBeVisible();
    await expect(page.getByRole('button', { name: words.tryAgain })).toBeVisible();
  });
});

test.describe('the pages of an account', () => {
  test('[page:/] lists the notebooks of the account, and says which environment and version this is', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(`${state.surfaces.site}/`);

    await expect(app.getByRole('heading', { name: words.openNotebook })).toBeVisible();
    await expect(app.locator('a.notebook-card', { hasText: notebook.name })).toBeVisible();
    await expect(app).toHaveTitle(`[${state.environment}] MemorySmith`);
    await expect(app.locator('.environment-banner')).toContainText(
      state.version ? `Staging · ${state.version}` : 'Staging',
    );
    if (state.version) {
      await app.locator('button.user-menu-trigger').click();
      await expect(app.locator('p.user-menu-version')).toHaveText(
        `${words.version} ${state.version}`,
      );
    }
  });

  test('[page:/notebooks/:notebookId] opens a notebook on its context: its name, its folders and their Templates', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(notebook.page());

    await expect(app.getByText(words.context, { exact: true })).toBeVisible();
    await expect(app.getByRole('heading', { level: 1, name: notebook.name })).toBeVisible();
    await expect(app.locator('a.outline-name', { hasText: 'Findings' })).toBeVisible();
    await expect(app).toHaveTitle(`[${state.environment}] ${notebook.name} · MemorySmith`);
  });

  test('[page:/notebooks/:notebookId/guidance] reads the Guidance of a notebook, rendered', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(notebook.page('/guidance'));

    await expect(app.locator('article.content-pane .markdown')).toContainText(
      'Write one finding per note',
    );
    await expect(app).toHaveTitle(
      `[${state.environment}] ${words.guidance} · ${notebook.name} · MemorySmith`,
    );
  });

  test('[page:/notebooks/:notebookId/templates] lists the Templates of a notebook by folder, and opens one', async ({
    app,
    notebook,
  }) => {
    await app.goto(notebook.page('/templates'));

    const box = app.locator('details.template-box', { hasText: 'Findings' });
    await box.locator('summary').click();
    await expect(box.getByRole('heading', { name: 'Verification' })).toBeVisible();
  });

  test('[page:/notebooks/:notebookId/graph] draws the graph of a notebook from its projection', async ({
    app,
    notebook,
    words,
  }) => {
    const graph = app.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/discovery/notebooks/${notebook.notebookId}/graph`,
      ),
    );
    await app.goto(notebook.page('/graph'));

    expect((await graph).status()).toBe(200);
    await expect(app.getByRole('heading', { level: 1, name: words.graph })).toBeVisible();
    await expect(app.locator('.graph-canvas-wrap canvas')).toBeAttached();
  });

  test('[page:/notebooks/:notebookId/folders] lists the folders at the root of a notebook', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page('/folders'));

    await expect(app.getByRole('heading', { level: 1, name: words.root })).toBeVisible();
    await expect(app.locator('a.note-list-folder', { hasText: 'Findings/' })).toBeVisible();
  });

  test('[page:/notebooks/:notebookId/folders/:folderId] lists the notes of a folder', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page(`/folders/${notebook.folderId.toLowerCase()}`));

    await expect(app.getByRole('heading', { level: 1, name: 'Findings' })).toBeVisible();
    await expect(app.getByRole('heading', { name: words.notesInFolder })).toBeVisible();
    await expect(app.locator('ul.note-list a', { hasText: 'Checklist' })).toBeVisible();
  });

  test('[page:/notebooks/:notebookId/notes/:noteId] ticks two boxes whose writes chain, and shows them ticked on coming back', async ({
    app,
    notebook,
    owner,
  }) => {
    await app.goto(notebook.page(`/notes/${notebook.noteId.toLowerCase()}`));
    await expect(app.getByRole('heading', { level: 1, name: 'Checklist' })).toBeVisible();

    const status = app.locator('.write-status');
    const box = (item: string) =>
      app.locator('li.task-item', { hasText: item }).getByRole('checkbox');

    // The defect this guards: the second write of a checklist conflicted with
    // the first, because the page kept the revision it loaded with.
    await box('first').check();
    await expect(status).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });
    await box('second').check();
    await expect(status).toHaveAttribute('data-state', 'saved', { timeout: 15_000 });

    const stored = await owner.ok<{ content: string }>(
      'GET',
      `/knowledge/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`,
    );
    expect(stored.content).toContain('- [x] first');
    expect(stored.content).toContain('- [x] second');

    // And this one: coming back to a note inside the application showed the
    // state from before its own write, from a cache nobody told to forget. It
    // leaves through the folder: the title of the notebook resumes the note
    // last read, which is this one, so it would never leave at all.
    await app.locator('aside#notebook-sidebar .tree-folder a', { hasText: 'Findings' }).click();
    await expect(app.getByRole('heading', { level: 1, name: 'Findings' })).toBeVisible();
    await app.locator('ul.note-list a', { hasText: 'Checklist' }).click();
    await expect(box('first')).toBeChecked();
    await expect(box('second')).toBeChecked();
  });

  test('[page:/notebooks/:notebookId/links/:target] keeps a link to a name nobody carries, and follows one that resolves', async ({
    app,
    notebook,
    owner,
    words,
  }) => {
    await app.goto(notebook.page(`/links/${encodeURIComponent('Nowhere yet')}`));
    await expect(app.getByRole('heading', { level: 1, name: 'Nowhere yet' })).toBeVisible();
    await expect(app.getByText(words.pending('Nowhere yet'), { exact: false })).toBeVisible();

    await eventually(
      'the name Checklist resolved',
      () =>
        owner.ok<{ kind: string }>(
          'GET',
          `/discovery/notebooks/${notebook.notebookId}/links/Checklist`,
        ),
      (answer) => answer.kind === 'note',
    );
    await app.goto(notebook.page('/links/Checklist'));
    await expect(app).toHaveURL(notebook.page(`/notes/${notebook.noteId.toLowerCase()}`));
  });

  test('[page:/notebooks/:notebookId/*] answers an address no page names inside a notebook with not found', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page('/nowhere'));

    await expect(app.getByText(words.notFound, { exact: true })).toBeVisible();
    await expect(app.locator('aside#notebook-sidebar')).toBeVisible();
  });

  test('shows nothing at the address of a notebook of another subscription', async ({
    app,
    state,
    words,
  }) => {
    const other = new Api(state.surfaces.api, await apiToken(state, state.accounts.other));
    const { notebookId } = await other.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
      name: `Foreign ${Date.now().toString(36)}`,
      description: 'A notebook of another subscription.',
    });

    await app.goto(`${state.surfaces.site}/notebooks/${notebookId.toLowerCase()}`);
    await expect(app.getByText(words.notFound, { exact: true })).toBeVisible();
    await expect(app.locator('aside#notebook-sidebar')).toHaveCount(0);
  });
});
