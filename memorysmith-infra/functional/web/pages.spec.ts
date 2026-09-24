/**
 * Every page of the interface, in the locale of the project that runs it
 * (software-vision.md, section 13; architecture-guide.md, section 19). Which
 * pages there are is read from the router, so a page added without a case
 * fails the Quality stage.
 */

import { randomBytes } from 'node:crypto';
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
    const card = app.locator('article.notebook-card', { hasText: notebook.name });
    await expect(card).toBeVisible();
    // The card is drawn with its graph, which is decoration and says so (#198).
    await expect(card.locator('svg.card-graph')).toHaveAttribute('aria-hidden', 'true');

    /**
     * The notebooks by name in the reader's language, and the space of the
     * subscription where the four counts about links used to be (#198).
     */
    const names = await app.locator('article.notebook-card h2').allTextContents();
    const collator = new Intl.Collator(words.locale, { sensitivity: 'base', numeric: true });
    expect(names).toEqual([...names].sort((a, b) => collator.compare(a, b)));
    await expect(app.getByRole('heading', { name: words.space })).toBeVisible();
    await expect(app.locator('.home-counts')).toBeVisible();
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

  test('ends the row of notebooks on the margins of Home, on a computer and on a phone (#212, #213)', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    const edges = async (selector: string) => {
      const box = await app.locator(selector).first().boundingBox();
      expect(box, selector).not.toBeNull();
      return { left: box!.x, right: box!.x + box!.width };
    };

    // A computer: the row is cut on the right margin, with the rule of its title.
    await app.setViewportSize({ width: 1280, height: 800 });
    await app.goto(`${state.surfaces.site}/`);
    await expect(app.locator('article.notebook-card', { hasText: notebook.name })).toBeVisible();
    await expect(app.getByRole('heading', { name: words.openNotebook })).toBeVisible();
    const head = await edges('.carousel-head');
    const row = await edges('.notebook-grid');
    expect(Math.abs(row.right - head.right)).toBeLessThanOrEqual(1);

    // A phone: the first card rests on the left margin, where the title starts.
    await app.setViewportSize({ width: 390, height: 800 });
    await app.goto(`${state.surfaces.site}/`);
    await expect(app.locator('article.notebook-card').first()).toBeVisible();
    const title = await edges('.carousel-head');
    const first = await edges('article.notebook-card');
    expect(Math.abs(first.left - title.left)).toBeLessThanOrEqual(1);
  });

  test('opens the user menu as a menu: arrows move, the theme changes at once, Esc closes it (#201)', async ({
    app,
    state,
    words,
  }) => {
    await app.goto(`${state.surfaces.site}/`);
    const trigger = app.locator('button.user-menu-trigger');
    await trigger.click();
    const menu = app.getByRole('menu', { name: words.accountMenu });
    await expect(menu).toBeVisible();

    // Opened by a click, no item wears the ring of a keyboard; the first arrow
    // key takes the focus to the first item, and the next one moves on (#204).
    const first = menu.getByRole('menuitemradio').first();
    await expect(first).not.toBeFocused();
    await app.keyboard.press('ArrowDown');
    await expect(first).toBeFocused();
    await app.keyboard.press('ArrowDown');
    await expect(first).not.toBeFocused();

    // What is chosen is filled; choosing takes effect with nothing to save.
    const dark = menu.getByRole('menuitemradio', { name: words.themeDark });
    await dark.click();
    await expect(dark).toHaveAttribute('aria-checked', 'true');
    await expect(app.locator('html')).toHaveAttribute('data-theme', 'dark');
    await menu.getByRole('menuitemradio', { name: words.themeLight }).click();
    await expect(app.locator('html')).toHaveAttribute('data-theme', 'light');

    await app.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('exports a notebook from its card, and its owner deletes it there after saying so (#199)', async ({
    app,
    owner,
    state,
    words,
  }) => {
    const name = `Delete ${randomBytes(4).toString('hex')}`;
    const { notebookId } = await owner.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
      name,
      description: 'A notebook a web case deletes.',
    });
    await app.goto(`${state.surfaces.site}/`);
    const card = app.locator('article.notebook-card', { hasText: name });
    const more = card.getByRole('button', { name: words.moreActions });

    // Export lands in the dialog with this notebook already chosen.
    await more.click();
    await app.getByRole('menuitem', { name: words.exportNotebook }).click();
    await expect(
      app.locator('.transfer-dialog').getByLabel(words.notebookField, { exact: true }),
    ).toHaveValue(notebookId);
    await app.keyboard.press('Escape');

    // Deleting asks on the card, and keeping it puts the card back as it was.
    await more.click();
    await app.getByRole('menuitem', { name: words.deleteNotebook }).click();
    await expect(card.getByRole('heading', { name: new RegExp(name) })).toBeVisible();
    await card.getByRole('button', { name: words.keep }).click();
    await expect(card.getByRole('button', { name: words.moreActions })).toBeVisible();

    await more.click();
    await app.getByRole('menuitem', { name: words.deleteNotebook }).click();
    await card.getByRole('button', { name: words.deleteForGood }).click();
    await expect(app.locator('article.notebook-card', { hasText: name })).toHaveCount(0);
    const gone = await owner.call('GET', `/knowledge/notebooks/${notebookId}`);
    expect(gone.status).toBe(404);
  });

  test('[page:/about] says what the product is, and where an agent is pointed at it', async ({
    app,
    state,
    words,
  }) => {
    await app.goto(`${state.surfaces.site}/`);

    // From the user menu, which is where it lives once it has opened by
    // itself: the fixture account has been here before (#167).
    await app.locator('button.user-menu-trigger').click();
    await app.getByRole('menuitem', { name: words.aboutMenu, exact: true }).click();
    await app.waitForURL(`${state.surfaces.site}/about`);

    await expect(app.getByRole('heading', { name: words.aboutHeading })).toBeVisible();
    await expect(app.getByRole('heading', { name: words.aboutConnector })).toBeVisible();
    // The address of THIS environment, published by its own configuration:
    // a page that shows the wrong one sends every agent somewhere else.
    // The endpoint, not the host: a client pointed at the host finds no server (#180).
    await expect(app.locator('.about-connector code')).toHaveText(`${state.surfaces.mcp}/mcp`);

    // One client at a time: the steps of the other are a tab away (#216).
    const panel = app.locator('#about-clients-panel');
    await expect(panel.locator('li')).toHaveCount(5);
    const first = await panel.locator('li').first().textContent();
    await app.locator('#about-clients-tab-chatgpt').click();
    await expect(app.locator('#about-clients-tab-chatgpt')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(panel.locator('li').first()).not.toHaveText(first ?? '');
    // And the foot says which version this is, beside the way in.
    if (state.version) {
      await expect(app.locator('.about-version')).toContainText(state.version);
    }
  });

  test('[page:/profile] [page:/profile/password] draws the initials nobody is asked for, and asks for the current password before changing it', async ({
    app,
    state,
    words,
  }) => {
    await app.goto(`${state.surfaces.site}/`);
    await app.locator('button.user-menu-trigger').click();
    await app.getByRole('menuitem', { name: words.profileMenu }).click();
    await app.waitForURL(`${state.surfaces.site}/profile`);

    // The e-mail is shown and cannot be typed: changing it is another
    // delivery with another rule (RN-ACC-021).
    const email = app.locator('.field input[type="email"]');
    await expect(email).toHaveValue(state.accounts.owner.email);
    await expect(email).toBeDisabled();

    /**
     * The source that asks nothing of anybody: choosing it draws two letters
     * HERE, and no request leaves for them. Which is the whole point of the
     * option, so the case proves the drawing and not the label.
     */
    await app.getByText(words.initials, { exact: true }).click();
    await expect(app.locator('.profile-face .avatar-initials')).toBeVisible();

    await app.getByRole('link', { name: words.passwordMenu }).click();
    await app.waitForURL(`${state.surfaces.site}/profile/password`);
    // Drawn as the sign-in screen: the card and the lockup of the managed
    // login, outside the frame of the application (#214).
    await expect(app.locator('.password-card img.password-logo')).toBeVisible();
    await expect(app.locator('button.user-menu-trigger')).toHaveCount(0);
    // It says what it will do to the other sessions BEFORE it happens.
    await expect(app.getByText(words.endsOtherSessions)).toBeVisible();
    // And giving up is free: nothing about the account was touched.
    await app.getByRole('button', { name: words.cancel }).click();
    await app.waitForURL(`${state.surfaces.site}/profile`);
  });

  test('gives up a change of password back on the page it was asked from', async ({
    app,
    state,
    words,
  }) => {
    await app.goto(`${state.surfaces.site}/transfers`);
    await app.locator('button.user-menu-trigger').click();
    await app.getByRole('menuitem', { name: words.passwordMenu }).click();
    await app.waitForURL(`${state.surfaces.site}/profile/password`);
    await app.getByRole('button', { name: words.cancel }).click();
    await app.waitForURL(`${state.surfaces.site}/transfers`);
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

  test('closes the results of the search with Esc wherever the focus went (#192)', async ({
    app,
    notebook,
  }) => {
    await app.goto(notebook.page());

    const box = app.locator('.search-box input[type="search"]');
    await box.fill('Checklist');
    const results = app.locator('.search-results');
    await expect(results).toBeVisible();

    // The focus leaves the box, which is where the only handler used to be.
    await app.getByRole('heading', { level: 1, name: notebook.name }).click();
    await app.keyboard.press('Escape');

    await expect(results).toBeHidden();
    await expect(box).toHaveValue('');
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
    state,
    words,
  }) => {
    /**
     * The panel holds what the frontmatter declares, and a notebook that
     * declares nothing offers no panel at all. So the case writes a note with
     * a property first, and opens the graph once the projection has it.
     */
    const api = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
    const tagged = await api.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: notebook.folderId,
        content: `---\nname: Graph ${Date.now()}\nstatus: draft\n---\n\nA note with a property.\n`,
      },
    );
    await eventually(
      'the note with a property in the graph',
      () =>
        api.ok<{ nodes: { id?: string; noteId?: string }[] }>(
          'GET',
          `/discovery/notebooks/${notebook.notebookId}/graph`,
        ),
      (graph) => JSON.stringify(graph).includes(tagged.noteId),
    );

    const graph = app.waitForResponse((response) =>
      new URL(response.url()).pathname.endsWith(
        `/discovery/notebooks/${notebook.notebookId}/graph`,
      ),
    );
    await app.goto(notebook.page('/graph'));

    expect((await graph).status()).toBe(200);
    await expect(app.getByRole('heading', { level: 1, name: words.graph })).toBeVisible();
    await expect(app.locator('.graph-canvas-wrap canvas')).toBeAttached();

    // The panel opens behind the gear, and only when it is asked for (#220).
    const gear = app.getByRole('button', { name: words.openGraphControls });
    await expect(gear).toBeVisible();
    await expect(app.getByRole('button', { name: words.closeGraphControls })).toHaveCount(0);
    await gear.click();
    await expect(app.getByRole('button', { name: words.closeGraphControls })).toBeVisible();
  });

  test('opens the tree on the top-level folders, with no Root above them (#196)', async ({
    app,
    notebook,
    words,
  }) => {
    await app.goto(notebook.page(`/folders/${notebook.folderId.toLowerCase()}`));

    const tree = app.locator('aside#notebook-sidebar ul.tree-root');
    await expect(
      tree.locator(':scope > li > .tree-folder a', { hasText: 'Findings' }),
    ).toBeVisible();
    // The trail starts at the notebook and goes straight to the folder.
    const crumbs = app.locator('.notebook-breadcrumb a');
    await expect(crumbs.first()).toHaveText(notebook.name);

    // The address of the page that is gone answers not found, and is not redirected.
    await app.goto(notebook.page('/folders'));
    await expect(app.getByText(words.notFound, { exact: true })).toBeVisible();
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

  test('[page:/notebooks/:notebookId/notes/:noteId] writes a note from the interface with a line, which the history answers, and conflicts with a write it did not see', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(
      `${state.surfaces.site}/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`,
    );

    // The toggle is there because this account writes in this notebook.
    await app.getByRole('button', { name: words.editNote }).click();
    const area = app.locator('textarea.note-editor-area');
    // What is typed is WHAT WAS TYPED: the frontmatter is in the box, not the
    // properties the reading surface drew out of it (RN-KNW-052).
    await expect(area).toHaveValue(/^---/);

    const line = `Written by a functional case at ${new Date().toISOString()}`;
    await area.fill(`${await area.inputValue()}\n\nA paragraph this case wrote.\n`);
    await app.getByRole('button', { name: words.confirmEdit }).click();
    await app.getByLabel(words.messageLabel).fill(line);
    await app.getByRole('button', { name: words.writeIt }).click();

    // Back to reading, with the paragraph in it.
    await expect(app.getByText('A paragraph this case wrote.')).toBeVisible();

    // And the line is in the history, which is the whole reason the field
    // exists: a message written into a drawer nobody opens is a form.
    await app.getByText(words.historyHeading).click();
    await expect(app.getByText(line)).toBeVisible();

    /**
     * A write the screen did not see: the API writes the same note directly,
     * so the revision the page is holding is retired. The next write from the
     * interface must say somebody else wrote, and not overwrite them.
     */
    const api = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
    const read = await api.ok<{ raw: string; revision: { versionId: string } }>(
      'GET',
      `/knowledge/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`,
    );
    await api.ok('PUT', `/knowledge/notebooks/${notebook.notebookId}/notes/${notebook.noteId}`, {
      content: `${read.raw}\n\nWritten around the interface.\n`,
      baseRevision: read.revision.versionId,
      message: 'A write the screen never saw',
    });

    await app.getByRole('button', { name: words.editNote }).click();
    await app.locator('textarea.note-editor-area').fill(`${read.raw}\n\nAnd one more.\n`);
    await app.getByRole('button', { name: words.confirmEdit }).click();
    await app.getByRole('button', { name: words.writeIt }).click();
    await expect(app.locator('.editor-refusal')).toContainText(words.conflict);
  });

  test('renames a note from the editor, and the tree follows without a reload', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    /**
     * Its own note, never the one of the fixture: renaming a note other cases
     * of this run read by name would break them, and a case that depends on
     * the order it runs in is not a case.
     */
    const api = new Api(state.surfaces.api, await apiToken(state, state.accounts.owner));
    const before = `Before ${Date.now()}`;
    const after = `After ${Date.now()}`;
    const made = await api.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: notebook.folderId,
        content: `---
name: ${before}
---

A note to rename.
`,
      },
    );

    await app.goto(`${state.surfaces.site}/notebooks/${notebook.notebookId}/notes/${made.noteId}`);
    await expect(app.locator('.tree-note', { hasText: before })).toBeVisible();

    await app.getByRole('button', { name: words.editNote }).click();
    const area = app.locator('textarea.note-editor-area');
    await area.fill((await area.inputValue()).replace(`name: ${before}`, `name: ${after}`));
    await app.getByRole('button', { name: words.confirmEdit }).click();
    await app.getByRole('button', { name: words.writeIt }).click();

    /**
     * No reload anywhere in this case (#170). The structure draws the tree and
     * is also what every `[[…]]` resolves against, so a rename that does not
     * reach it leaves the whole notebook painting by the old name.
     */
    await expect(app.locator('.note-header h1')).toHaveText(after);
    await expect(app.locator('.tree-note', { hasText: after })).toBeVisible();
    await expect(app.locator('.tree-note', { hasText: before })).toHaveCount(0);
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
 * It is also the whole of the import dialog (#143, #160): the document is read
 * in the browser before a byte is uploaded, the name comes from the document
 * and is checked as it is typed, what is imported may be chosen, and the job
 * that follows is watched in Transfers like every other one.
 */
/**
 * Starts an export of one notebook, from wherever the page is (#151).
 *
 * Transfers is on every screen and is where a transfer is followed: it is
 * where one is started, so this opens it, asks for a new export, names the
 * notebook and confirms. The panel closes as the dialog opens, which is why
 * everything after the first click is scoped to the dialog (#160).
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
    .locator('.transfer-dialog')
    .getByLabel(words.notebookField, { exact: true })
    .selectOption({ label: notebookName });
  // Inside the dialog and exact: `Export` is also the start of the button that
  // opened it.
  await app
    .locator('.transfer-dialog')
    .getByRole('button', { name: words.startExport, exact: true })
    .click();
  /**
   * The dialog closes when the job has been ACCEPTED, and not when the button
   * is pressed. Leaving the page before that aborts the request that starts
   * the export, and nothing is ever exported (#160).
   */
  await expect(app.locator('.transfer-dialog')).toHaveCount(0);
}

/**
 * Saves the archive of the one export of this person, from Transfers.
 *
 * Nothing downloads by itself any more: an export used to save itself the
 * moment it was ready, wherever the person had moved to, which was one way too
 * many beside the two buttons that ask for it (#160).
 */
async function saveTheExport(
  app: Page,
  words: { download: string },
  site: string,
  notebookName: string,
  to: string,
): Promise<void> {
  await app.goto(`${site}/transfers`);
  // The row of THIS notebook, because Transfers holds every transfer of the
  // subscription and the newest is as likely to be an import of another case.
  const download = app
    .locator('.transfers-row', { hasText: notebookName })
    .getByRole('button', { name: words.download, exact: true })
    .first();
  await expect(download).toBeVisible({ timeout: 120_000 });
  const downloading = app.waitForEvent('download');
  await download.click();
  await (await downloading).saveAs(to);
}

test.describe('a notebook out and back in, through the browser', () => {
  test('[page:/transfers] reads the file, refuses the name it came with, and imports the structure alone', async ({
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
    await startExport(app, words, notebook.name);
    const archive = join(tmpdir(), `${notebook.name}.notebook`);
    await saveTheExport(app, words, state.surfaces.site, notebook.name, archive);

    /**
     * And an import is asked for in the same dialog, from the same place: it
     * used to be a page of its own, so the two halves of one job were asked
     * for in two shapes (#160).
     */
    await app
      .locator('.transfers-page')
      .getByRole('button', { name: words.importNotebook, exact: true })
      .click();
    const dialog = app.locator('.transfer-dialog');
    const choosing = app.waitForEvent('filechooser');
    await dialog.getByRole('button', { name: words.chooseFile }).click();
    await (await choosing).setFiles(archive);

    /**
     * The name comes from the DOCUMENT and not from the file, and this document
     * came home to the subscription it left: the page says so before anything
     * is uploaded, which is what a person used to find out as raw text on a
     * button (RN-KNW-032).
     */
    const name = dialog.getByLabel(words.notebookName);
    await expect(name).toHaveValue(notebook.name);
    await expect(
      dialog.getByRole('button', { name: words.importAction, exact: true }),
    ).toBeDisabled();

    /**
     * And it says so where a refusal is said, and nowhere else: in the foot,
     * in one line that counts and does not grow, which the field points at;
     * and in the tab of the inconsistencies, in full with the way out. Never a
     * line under the field or in the body of the dialog (#161).
     */
    await expect(name).toHaveAttribute('aria-describedby', 'transfer-refusal');
    await expect(dialog.locator('.field-hint.is-wrong, p.status')).toHaveCount(0);
    await expect(dialog.locator('#transfer-refusal')).toContainText(words.inconsistency);
    await dialog.getByRole('tab', { name: new RegExp(words.tabConflicts) }).click();
    await expect(dialog.getByRole('tab', { name: new RegExp(words.tabConflicts) })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(dialog.getByText(words.nameTakenTitle, { exact: false })).toBeVisible();

    /**
     * The strip of tabs never draws a vertical scrollbar beside the tabs
     * (#161). It scrolls sideways on a narrow screen now (#201), which is
     * safe only because nothing of a tab sticks out of its row any more: the
     * rule under the open tab is drawn inside it. So what is asserted is that
     * the strip has nothing to scroll vertically.
     */
    const strip = dialog.locator('.chooser-tabs');
    const vertical = await strip.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(vertical).toBeLessThanOrEqual(0);

    const free = `${notebook.name} again`;
    await name.fill(free);
    await expect(dialog.locator('#transfer-refusal')).toHaveCount(0);

    /**
     * The design of the notebook and not one note of it (RN-PRT-017).
     *
     * The chooser asks the SCOPE before the items (#161): five species, each
     * saying whether it travels. So the design alone is one box — the notes
     * let go — where it used to be a loop unticking every row of a tab, and
     * the tab of the notes closes with them, because there is nothing left in
     * it to choose.
     */
    await dialog.getByRole('radio', { name: words.partOfIt, exact: true }).check();
    await dialog.getByRole('checkbox', { name: words.tabNotes, exact: true }).uncheck();
    await expect(dialog.getByRole('tab', { name: words.tabNotes, exact: true })).toBeDisabled();
    // The summary names what goes and leaves out what does not: a species
    // nobody chose is not written as a zero (#205).
    const summary = dialog.locator('.transfer-summary');
    await expect(summary).toContainText(words.willCreateFolders);
    await expect(summary).not.toContainText(words.willCreateNotes);

    /**
     * Starting it closes the dialog: the decision is over and the job is
     * followed where every transfer is, which is the row that ends in the
     * notebook it wrote (#160).
     */
    await dialog.getByRole('button', { name: words.importAction, exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // The row of THIS import: Transfers holds every transfer of the
    // subscription, and several of them ended in a notebook of their own.
    const imported = app
      .locator('.transfers-row', { hasText: free })
      .getByRole('link', { name: words.openImported });
    await expect(imported).toBeVisible({ timeout: 120_000 });
    await imported.click();

    await expect(app.getByRole('heading', { level: 1, name: free })).toBeVisible();
    await expect(app.locator('a.outline-name', { hasText: 'Findings' })).toBeVisible();
    // Structure only: the folders arrived and the notes did not.
    await app.goto(app.url().replace(/\/?$/, '/folders'));
    await expect(app.locator('ul.note-list a')).toHaveCount(0);

    /**
     * And its row leaves Transfers when it is asked to, with its record alone:
     * the notebook it created stays (#221, RN-PRT-026).
     */
    await app.goto(`${state.surfaces.site}/transfers`);
    const row = app.locator('.transfers-row', { hasText: free });
    await row.getByRole('button', { name: words.deleteSlot, exact: true }).click();
    await row.getByRole('button', { name: words.deleteForGood, exact: true }).click();
    await expect(row).toHaveCount(0);
    await app.goto(`${state.surfaces.site}/`);
    await expect(app.locator('article.notebook-card', { hasText: free })).toBeVisible();
  });
});

/**
 * Transfers: where an export is followed and kept (#145, RN-PRT-019,
 * RN-PRT-020). An export used to be a link of fifteen minutes that nothing
 * listed, and the bucket threw the file away the next day.
 */
test.describe('the transfers of a person', () => {
  test('ends a page that scrolls with its padding below the last line (#209)', async ({
    app,
    state,
  }) => {
    // Short enough that the list of transfers scrolls.
    await app.setViewportSize({ width: 1280, height: 480 });
    await app.goto(`${state.surfaces.site}/transfers`);
    await expect(app.locator('.transfers-page h1')).toBeVisible();

    const gap = await app.evaluate(() => {
      const page = globalThis as unknown as {
        document: {
          querySelector: (selector: string) => {
            scrollTop: number;
            scrollHeight: number;
            lastElementChild: { getBoundingClientRect: () => { bottom: number } } | null;
            firstElementChild: {
              lastElementChild: { getBoundingClientRect: () => { bottom: number } } | null;
            } | null;
            getBoundingClientRect: () => { bottom: number };
          } | null;
        };
      };
      const main = page.document.querySelector('.app-main');
      if (!main) return -1;
      main.scrollTop = main.scrollHeight;
      const last = main.firstElementChild?.lastElementChild;
      if (!last) return -1;
      return main.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom;
    });
    expect(gap, 'room between the last line and the foot of the window').toBeGreaterThanOrEqual(24);
  });

  test('opens the Transfers panel inside a phone screen (#195)', async ({ app, state, words }) => {
    await app.setViewportSize({ width: 320, height: 640 });
    await app.goto(`${state.surfaces.site}/`);
    await app.getByRole('button', { name: words.transfers }).click();

    const panel = app.locator('.transfers-panel');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box, 'the panel has a box').not.toBeNull();
    expect(box!.x, 'the panel starts on the screen').toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, 'and ends on it').toBeLessThanOrEqual(320);
  });

  test('[page:/transfers] exports a notebook from its page, keeps it, downloads it again and deletes it', async ({
    app,
    notebook,
    state,
    words,
  }) => {
    await app.goto(notebook.page());

    await startExport(app, words, notebook.name);

    await app.goto(`${state.surfaces.site}/transfers`);
    await expect(app.getByRole('heading', { level: 1, name: words.transfers })).toBeVisible();
    const row = app.locator('.transfers-row', { hasText: notebook.name });
    await expect(row).toBeVisible();

    /**
     * Downloaded from a link minted at this moment, and only when it is asked
     * for: nothing saves itself any more (#160). The export is kept until it
     * is deleted, and it counts towards the space of the plan.
     */
    await expect(app.locator('.transfers-kept')).toContainText(words.ofYourPlan);

    /**
     * What is shown is chosen in a TAB STRIP and no longer in three chips: one
     * of three, one at a time, switching the list below it, which is what a
     * tab is — and a chip is a label (#157, #161). The export just made is an
     * export, so it survives that filter and would not survive the other.
     */
    await app.getByRole('tab', { name: new RegExp(`^${words.filterExports}`) }).click();
    await expect(row).toBeVisible();
    await app.getByRole('tab', { name: new RegExp(`^${words.filterImports}`) }).click();
    await expect(app.locator('.transfers-row', { hasText: notebook.name })).toHaveCount(0);
    await app.getByRole('tab', { name: new RegExp(`^${words.filterAll}`) }).click();

    const download = row.getByRole('button', { name: words.download, exact: true });
    await expect(download).toBeVisible({ timeout: 120_000 });
    const downloading = app.waitForEvent('download');
    await download.click();
    expect(await (await downloading).suggestedFilename()).toContain('.notebook');

    // Deleting asks on the page, saying that the notebook is not touched.
    await row.getByRole('button', { name: words.deleteSlot, exact: true }).click();
    await expect(row.getByText(words.deleteUntouched, { exact: false })).toBeVisible();
    await row.getByRole('button', { name: words.deleteSlotForGood }).click();
    await expect(app.locator('.transfers-row', { hasText: notebook.name })).toHaveCount(0);
  });
});
