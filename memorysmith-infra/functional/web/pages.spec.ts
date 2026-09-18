/**
 * Every page of the interface, in the locale of the project that runs it
 * (software-vision.md, section 13; architecture-guide.md, section 19). Which
 * pages there are is read from the router, so a page added without a case
 * fails the Quality stage.
 */

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { eventually } from '../support/eventually.js';
import { signInOnManagedLogin } from '../support/managed-login.js';
import { expect, speak, test } from './fixtures.js';
import type { Page } from '@playwright/test';

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

    /**
     * And the window holds the whole shell: the banner is a ROW of it, not
     * something fixed over the page with a padding on the body to make room —
     * which is a document taller than the window, scrolling the layout and no
     * content at all (#158). What scrolls is what has content: the sidebar of a
     * notebook, and the middle.
     */
    const scrolls = await app.evaluate(() => {
      // This suite is typed for Node, so the document is named rather than
      // assumed: what runs here runs in the browser.
      const page = globalThis as unknown as {
        document: { documentElement: { scrollHeight: number; clientHeight: number } };
      };
      const root = page.document.documentElement;
      return root.scrollHeight > root.clientHeight + 1;
    });
    expect(scrolls, 'the document scrolls, and nothing of it needs to').toBe(false);
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

  test('[page:/notebooks/:notebookId/templates] lists the Templates of a notebook by folder, opens one and deletes it', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page('/templates'));

    const box = app.locator('details.template-box', { hasText: 'Findings' });
    await box.locator('summary').click();
    await expect(box.getByRole('heading', { name: 'Verification' })).toBeVisible();

    // The Template is an object of its own and is deleted on its own: the
    // card goes and the folder stays (RN-KNW-045). It asks first, in the page,
    // because what a person needs in order to answer is what survives.
    await box.getByRole('button', { name: words.deleteSlot }).click();
    await box.getByRole('button', { name: words.deleteSlotForGood }).click();
    await expect(app.locator('details.template-box', { hasText: 'Findings' })).toHaveCount(0);

    await app.goto(notebook.page(`/folders/${notebook.folderId.toLowerCase()}`));
    await expect(app.getByRole('heading', { level: 1, name: 'Findings' })).toBeVisible();
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

    // On the note itself the pending link is drawn pending and can still be
    // clicked: the choice opens over the page and says nobody carries the name
    // yet (RN-DSC-060, #138, #144).
    const pending = app.locator('a.wikilink-pending', { hasText: 'Nowhere yet' });
    await expect(pending).toHaveAttribute('aria-haspopup', 'dialog');
    await pending.click();
    await expect(
      app.getByRole('dialog').getByText(words.pending('Nowhere yet'), { exact: false }),
    ).toBeVisible();
    await app.keyboard.press('Escape');
    await expect(app.getByRole('dialog')).toHaveCount(0);
  });

  /**
   * #144: the choice was a menu positioned inside whatever held the link, and
   * a table of a note scrolls on its own, so a link written in a table cell
   * opened its menu inside the scroll box of the table — clipped by it, with a
   * scrollbar of its own.
   */
  test('[page:/notebooks/:notebookId/notes/:noteId] opens the choice of a link written in a table over the page, and at phone width as a sheet', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page(`/notes/${notebook.tableNoteId.toLowerCase()}`));
    const link = app.locator('table a.wikilink', { hasText: 'Facet' });
    await link.click();

    const dialog = app.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();
    await expect(dialog.getByRole('heading', { name: words.linkToSeveral })).toBeVisible();

    // Above the table and not inside it: the top layer is what no ancestor
    // clips, so the choice is wider than the cell that held the link.
    const table = await app.locator('table').boundingBox();
    const card = await app.locator('.link-choice-card').boundingBox();
    expect(card?.width ?? 0).toBeGreaterThan(280);
    expect((card?.height ?? 0) + (card?.y ?? 0)).toBeGreaterThan(table?.y ?? 0);

    // Each option is a folder trail, because both notes carry the same name.
    const options = app.locator('.link-choice-option');
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText('Findings');

    // Esc closes it and the focus goes back to the link.
    await app.keyboard.press('Escape');
    await expect(app.getByRole('dialog')).toHaveCount(0);
    await expect(link).toBeFocused();

    // At phone width it rises from the bottom, with comfortable targets.
    await app.setViewportSize({ width: 390, height: 780 });
    await link.click();
    const sheet = await app.locator('.link-choice-card').boundingBox();
    expect(Math.round((sheet?.y ?? 0) + (sheet?.height ?? 0))).toBeGreaterThanOrEqual(770);
    const option = await app.locator('.link-choice-option').first().boundingBox();
    expect(option?.height ?? 0).toBeGreaterThanOrEqual(44);

    // And choosing one opens that note.
    await app.locator('.link-choice-option').first().click();
    await expect(app).toHaveURL(notebook.page(`/notes/${notebook.facetNoteIds[0].toLowerCase()}`));
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

/**
 * The case that would have caught #142: a `.notebook` had never been imported
 * through the interface, because the browser asks the content bucket whether it
 * may upload and the bucket answered no. Everything else in the suite uploads
 * from Node, where nobody asks.
 *
 * It is also the whole of the import page (#143): the document is read in the
 * browser before a byte is uploaded, the name comes from the document and is
 * checked as it is typed, what is imported may be chosen, and the import is a
 * job with a progress.
 */
/**
 * Starts an export of one notebook, from wherever the page is (#151).
 *
 * Transfers is on every screen and is where a transfer is followed: it is
 * where one is started, so this opens it, asks for a new export, names the
 * notebook and confirms.
 */
async function startExport(
  app: Page,
  words: { transfers: string; newExport: string; notebookField: string; startExport: string },
  notebookName: string,
): Promise<void> {
  await app.getByRole('button', { name: words.transfers }).click();
  await app.getByRole('button', { name: words.newExport }).click();
  // Scoped to the dialog and exact: `Notebook` is the start of several
  // accessible names on the page behind it.
  await app
    .locator('.export-choice')
    .getByLabel(words.notebookField, { exact: true })
    .selectOption({ label: notebookName });
  // Inside the dialog and exact: `Export` is also the start of the button that
  // opened it.
  await app
    .locator('.export-choice')
    .getByRole('button', { name: words.startExport, exact: true })
    .click();
}

test.describe('a notebook out and back in, through the browser', () => {
  test('[page:/imports/new] reads the file, refuses the name it came with, and imports the structure alone', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(notebook.page());

    /**
     * An export is started from Transfers, from wherever the person is: it
     * used to be a button inside the notebook, which meant navigating to the
     * notebook to export it (#151).
     */
    const downloading = app.waitForEvent('download', { timeout: 120_000 });
    await startExport(app, words, notebook.name);
    const archive = join(tmpdir(), `${notebook.name}.notebook`);
    await (await downloading).saveAs(archive);

    await app.goto(`${state.surfaces.site}/imports/new`);
    const choosing = app.waitForEvent('filechooser');
    await app.getByRole('button', { name: words.chooseFile }).click();
    await (await choosing).setFiles(archive);

    /**
     * The name comes from the DOCUMENT and not from the file, and this document
     * came home to the subscription it left: the page says so before anything
     * is uploaded, which is what a person used to find out as raw text on a
     * button (RN-KNW-032).
     */
    const name = app.getByLabel(words.notebookName);
    await expect(name).toHaveValue(notebook.name);
    await expect(app.getByText(words.nameTaken, { exact: false })).toBeVisible();
    await expect(app.getByRole('button', { name: words.importAction })).toBeDisabled();

    const free = `${notebook.name} again`;
    await name.fill(free);

    /**
     * The design of the notebook and not one note of it (RN-PRT-017). There
     * used to be a preset for exactly this, and it went when the Guidance and
     * each Template became items of the tree: `only this item` on a folder
     * writes it as a path, which is that selection made by hand.
     */
    await app.getByRole('radio', { name: words.chooseItems }).check();
    /**
     * Choosing items starts from what was selected, which is everything. A
     * checkbox always takes the whole branch, so each folder goes off with its
     * notes, and `only this item` then puts the folder back as a PATH — its
     * name and its description, and nothing under it (RN-PRT-017).
     */
    for (const box of await app.locator('.import-tree > li > .import-row input').all()) {
      if (await box.isChecked()) await box.uncheck();
    }
    for (const only of await app.getByRole('button', { name: words.onlyThisItem }).all()) {
      await only.click();
    }
    await expect(app.locator('.import-summary')).toContainText(words.willCreateNoNotes);

    await app.getByRole('button', { name: words.importAction }).click();
    await expect(app.getByRole('link', { name: words.openImported })).toBeVisible({
      timeout: 120_000,
    });
    await app.getByRole('link', { name: words.openImported }).click();

    await expect(app.getByRole('heading', { level: 1, name: free })).toBeVisible();
    await expect(app.locator('a.outline-name', { hasText: 'Findings' })).toBeVisible();
    // Structure only: the folders arrived and the notes did not.
    await app.goto(app.url().replace(/\/?$/, '/folders'));
    await expect(app.locator('ul.note-list a')).toHaveCount(0);
  });
});

/**
 * Transfers: where an export is followed and kept (#145, RN-PRT-019,
 * RN-PRT-020). An export used to be a link of fifteen minutes that nothing
 * listed, and the bucket threw the file away the next day.
 */
test.describe('the transfers of a person', () => {
  test('[page:/transfers] exports a notebook from its page, keeps it, downloads it again and deletes it', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(notebook.page());

    // The download of a small notebook starts by itself while the person is
    // still on the page that asked for it, so the common case stays one click.
    const downloading = app.waitForEvent('download', { timeout: 120_000 });
    await startExport(app, words, notebook.name);
    expect(await (await downloading).suggestedFilename()).toContain('.notebook');

    await app.goto(`${state.surfaces.site}/transfers`);
    await expect(app.getByRole('heading', { level: 1, name: words.transfers })).toBeVisible();
    const row = app.locator('.transfers-row', { hasText: notebook.name });
    await expect(row).toBeVisible();

    // Downloaded again, from a link minted at this moment: the export is kept
    // until it is deleted, and it counts towards the space of the plan.
    await expect(app.locator('.transfers-kept')).toContainText(words.spaceUsed);
    const again = app.waitForEvent('download');
    await row.getByRole('button', { name: words.download }).click();
    expect(await (await again).suggestedFilename()).toContain('.notebook');

    // Deleting asks on the page, saying that the notebook is not touched.
    await row.getByRole('button', { name: words.deleteSlot, exact: true }).click();
    await expect(row.getByText(words.deleteUntouched, { exact: false })).toBeVisible();
    await row.getByRole('button', { name: words.deleteSlotForGood }).click();
    await expect(app.locator('.transfers-row', { hasText: notebook.name })).toHaveCount(0);
  });
});
