/**
 * Notebook models in the interface (#353, #354, #355, #359): the owner declares
 * a notebook as a model, freezes it into a version and creates a notebook from
 * it; a person of another subscription the model is shared with as a model
 * reader reads it and its versions on pages of their own, outside any notebook.
 */

import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { eventually } from '../support/eventually.js';
import { expect, openAs, speak, test, type AppLocale } from './fixtures.js';

/** The words of the model pages, copied from the locale files of the interface. */
const MODEL_WORDS: Record<
  AppLocale,
  {
    readonly objective: string;
    readonly newNotebook: string;
    readonly newModel: string;
    readonly modelItem: string;
    readonly name: string;
    readonly notAModel: string;
    readonly addParameter: string;
    readonly parameterName: string;
    readonly required: string;
    readonly declare: string;
    readonly saved: string;
    readonly save: string;
    readonly tabAbout: string;
    readonly tabVersions: string;
    readonly changelog: string;
    readonly createVersion: string;
    readonly ready: string;
    readonly open: string;
    readonly version: (number: number) => string;
    readonly create: string;
    readonly sharedBy: string;
  }
> = {
  en_US: {
    objective: 'Objective',
    newNotebook: 'New notebook',
    newModel: 'New model',
    modelItem: 'Model',
    name: 'Name',
    notAModel: 'This notebook is not a model.',
    addParameter: 'Add a parameter',
    parameterName: 'Name',
    required: 'Required',
    declare: 'Declare as a model',
    saved: 'Saved.',
    save: 'Save',
    tabAbout: 'About the model',
    tabVersions: 'Versions',
    changelog: 'What changed since the last version',
    createVersion: 'Create a version',
    ready: 'Ready',
    open: 'Open',
    version: (number) => `Version ${number}`,
    create: 'Create a notebook from this version',
    sharedBy: 'Shared with you by',
  },
  pt_BR: {
    objective: 'Objetivo',
    newNotebook: 'Novo caderno',
    newModel: 'Novo modelo',
    modelItem: 'Modelo de caderno',
    name: 'Nome',
    notAModel: 'Este caderno não é um Modelo de caderno.',
    addParameter: 'Adicionar um parâmetro',
    parameterName: 'Nome',
    required: 'Obrigatório',
    declare: 'Declarar como Modelo de caderno',
    saved: 'Salvo.',
    save: 'Salvar',
    tabAbout: 'Sobre o modelo',
    tabVersions: 'Versões',
    changelog: 'O que mudou desde a última versão',
    createVersion: 'Criar uma versão',
    ready: 'Pronta',
    open: 'Abrir',
    version: (number) => `Versão ${number}`,
    create: 'Criar um caderno a partir desta versão',
    sharedBy: 'Compartilhado com você por',
  },
};

test.describe('notebook models', () => {
  test('[page:/models] lists the models a person reads, and opens the dialog of a new model as the only thing that scrolls, the whole screen on a phone (#398, #418)', async ({
    app,
    notebook,
    appLocale,
  }, testInfo) => {
    const words = MODEL_WORDS[appLocale];
    // From a page of the run, then the models until they show: the first
    // visit of an account opens the welcome surface in its place, once.
    await app.goto(notebook.page('/model'));
    const newModel = app.getByRole('button', { name: words.newModel });
    await expect(async () => {
      await app.goto(new URL('/models', app.url()).href);
      await expect(newModel).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    // Each model it reads is a card, or the page says there is none yet; a card
    // says whose it is in its corner, with the words in a tooltip, beside its ⋯.
    await expect(
      app.locator('.shelf-grid article.notebook-card, .shelf-page .hint').first(),
    ).toBeVisible();
    const card = app.locator('.shelf-grid article.notebook-card').first();
    if ((await card.count()) > 0) {
      // A click on the mark says what it means for this card, as the `?` of
      // the page does (#418).
      await card.locator('button.ownership-mark').click();
      await expect(card.locator('.ownership-box')).toBeVisible();
      await app.keyboard.press('Escape');
      await expect(card.locator('.ownership-box')).toHaveCount(0);
    }
    // A model of mine carries the ⋯ of a notebook card: export, share, delete.
    const mine = app.locator('.shelf-grid article.notebook-card', {
      has: app.locator(
        '.ownership-mark[data-ownership="own"], .ownership-mark[data-ownership="sharedByMe"]',
      ),
    });
    if ((await mine.count()) > 0) {
      await mine.first().locator('button.notebook-card-more').click();
      await expect(app.getByRole('menuitem')).toHaveCount(3);
      await app.keyboard.press('Escape');
    }
    await testInfo.attach('models.png', { body: await app.screenshot(), contentType: 'image/png' });

    // The notebooks offer a notebook only; a model starts here (#418).
    await app.goto(new URL('/notebooks', app.url()).href);
    await expect(app.getByRole('button', { name: words.newNotebook })).toBeVisible();
    await expect(app.getByRole('button', { name: words.newModel })).toHaveCount(0);
    await app.goto(new URL('/models', app.url()).href);

    await newModel.click();
    const box = app.locator('.new-notebook .ask-dialog-box');
    await expect(box).toBeVisible();

    // The page scrolls inside .app-main, and a modal locks it: one scrollbar.
    await expect(app.locator('.app-main')).toHaveCSS('overflow-y', 'hidden');

    // On a phone the modal is the whole screen, edge to edge.
    await app.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await box.boundingBox())?.width ?? 0).toBe(390);
  });

  test('[page:/notebooks/:notebookId/model] [page:/notebooks/:notebookId/model/versions/:version] creates a model from the models, freezes a version and creates a notebook from it', async ({
    app,
    notebook,
    owner,
    appLocale,
  }) => {
    const words = MODEL_WORDS[appLocale];
    // A notebook that is no model offers none.
    await app.goto(notebook.page('/model'));
    await expect(app.getByText(words.notAModel, { exact: true })).toBeVisible();
    await expect(app.getByLabel(words.objective, { exact: true })).toHaveCount(0);

    await app.goto(new URL('/models', app.url()).href);
    await app.getByRole('button', { name: words.newModel }).click();
    const modelName = `${notebook.name} model`;
    await app.getByLabel(words.name, { exact: true }).first().fill(modelName);
    await app.getByLabel(words.objective, { exact: true }).fill('Keep the findings of one review');
    // The dialog asks the essentials, and the parameters wait for their tab (#400).
    await expect(app.getByRole('button', { name: words.addParameter })).toHaveCount(0);
    await app.getByRole('button', { name: words.declare }).click();
    await app.waitForURL(/\/notebooks\/[0-9a-z]{26}\/model\?tab=parameters$/, { timeout: 60_000 });
    // A part of the Context, with no reload, and it is where the model is kept.
    await expect(app.locator('#notebook-nav-parts a').first()).toHaveText(words.modelItem);
    // A model of one's own is a model: the menu lights Models, never Notebooks (#422).
    await expect(app.locator('nav.top-menu .top-menu-item.active')).toHaveAttribute(
      'href',
      '/models',
    );

    // A parameter is added in a modal, and written when it is confirmed.
    await app.getByRole('button', { name: words.addParameter }).click();
    const modal = app.locator('.parameter-modal');
    await modal.getByLabel(words.parameterName, { exact: true }).fill('client');
    await modal.getByLabel(words.required, { exact: true }).check();
    await modal.getByRole('button', { name: words.save, exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(app.locator('.parameter-line', { hasText: '{{client}}' })).toBeVisible();

    // What the model says of itself is a tab of its own, its texts shown whole.
    await app.getByRole('tab', { name: words.tabAbout }).click();
    await expect(app.locator('.model-form textarea').first()).toHaveValue(
      'Keep the findings of one review',
    );

    await app.getByRole('tab', { name: words.tabVersions }).click();
    await app.getByLabel(words.changelog).fill('The first version');
    await app.getByRole('button', { name: words.createVersion }).click();
    const version = app.locator('.model-version', { hasText: 'v1' });
    await expect(version.getByText(words.ready, { exact: true })).toBeVisible({ timeout: 120_000 });

    await version.getByRole('link', { name: words.open }).click();
    await expect(app.getByRole('heading', { name: words.version(1) })).toBeVisible();
    await app.getByRole('button', { name: words.create }).click();
    const name = `${notebook.name} for Aurora`;
    const form = app.locator('form.create-from-model');
    await form.locator('input').first().fill(name);
    await form.locator('#value-client').fill('Aurora');
    await form.getByRole('button', { name: words.create }).click();
    await app.waitForURL(/\/notebooks\/[0-9a-z]{26}$/, { timeout: 120_000 });

    const listed = await owner.ok<Array<{ notebookId: string; name: string }>>(
      'GET',
      '/knowledge/notebooks',
    );
    const created = listed.find((each) => each.name === name);
    expect(created).toBeDefined();
    if (created) await owner.ok('DELETE', `/knowledge/notebooks/${created.notebookId}`);
    const model = listed.find((each) => each.name === modelName);
    expect(model).toBeDefined();
    if (model) await owner.ok('DELETE', `/knowledge/notebooks/${model.notebookId}`);
  });

  test('[page:/notebooks/:notebookId/model/versions/:version] draws a yes-or-no parameter as a box beside its name when a notebook is created from a version (#411)', async ({
    app,
    notebook,
    owner,
    appLocale,
  }) => {
    const words = MODEL_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, {
      objective: 'Keep the findings of one review',
      parameters: [
        { name: 'withMinutes', type: 'boolean', required: false, default: true },
        { name: 'client', type: 'text', required: true },
      ],
    });
    await owner.call('POST', `${model}/versions`, { changelog: 'The first version' });
    await eventually(
      'the first version of the model is ready',
      () => owner.ok<{ versions: Array<{ status: string }> }>('GET', model),
      (read) => read.versions[0]?.status === 'ready',
      { timeoutMs: 120_000 },
    );

    await app.goto(notebook.page('/model/versions/1'));
    await app.getByRole('button', { name: words.create }).click();
    const form = app.locator('form.create-from-model');
    const box = form.locator('#value-withMinutes');
    await expect(box).toBeChecked();
    // A box of its own size, never the width of the text field below it.
    const drawn = await box.boundingBox();
    const text = await form.locator('#value-client').boundingBox();
    expect(drawn && drawn.width <= 24 && drawn.height <= 24).toBe(true);
    expect(text && text.width > 200).toBe(true);
    // Its name is its label, beside it: clicking the name ticks it.
    await form
      .locator('label.parameter-required', { hasText: 'withMinutes' })
      .locator('span')
      .click();
    await expect(box).not.toBeChecked();
  });

  test('[page:/models/:notebookId] [page:/models/:notebookId/versions/:version] opens a model shared as a model reader, and never its notebook', async ({
    page,
    notebook,
    owner,
    state,
    appLocale,
    words: common,
  }) => {
    const words = MODEL_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, { objective: 'Keep the findings of one review' });
    await owner.call('POST', `${model}/versions`, { changelog: 'The first version' });
    await eventually(
      'the first version of the model is ready',
      () => owner.ok<{ versions: Array<{ status: string }> }>('GET', model),
      (read) => read.versions[0]?.status === 'ready',
      { timeoutMs: 120_000 },
    );

    const other = new Api(state.surfaces.api, await apiToken(state, state.accounts.other));
    const shares = `/access/notebooks/${notebook.notebookId}/shares`;
    await owner.ok('POST', shares, {
      email: state.accounts.other.email,
      profile: 'model-reader',
      acceptLicence: true,
    });
    try {
      await other.ok('POST', `/access/shared/${notebook.notebookId}/accept`);

      await openAs(page, state, state.accounts.other, appLocale);
      await page.goto(`${state.surfaces.site}/models/${notebook.notebookId.toLowerCase()}`);
      await expect(page.getByText(words.sharedBy, { exact: false })).toContainText(
        state.accounts.owner.email,
      );
      // The versions are a tab of their own (#400).
      await page.getByRole('tab', { name: words.tabVersions }).click();
      await page
        .locator('.model-version', { hasText: 'v1' })
        .getByRole('link', { name: words.open })
        .click();
      await expect(page.getByRole('heading', { name: words.version(1) })).toBeVisible();
      await expect(page.getByRole('button', { name: words.create })).toBeVisible();

      // The notebook itself stays closed to a model reader.
      await page.goto(notebook.page());
      await expect(page.getByText(common.notFound, { exact: true })).toBeVisible();
    } finally {
      const { user } = await other.ok<{ user: { userId: string } }>('GET', '/access/session');
      await owner.call('DELETE', `${shares}/${user.userId}`);
    }
  });

  test('[page:/community] [page:/community/:publicId] [page:/community/:publicId/versions/:version] finds a published model signed in, under the menu, reads it and its version, and sends a visitor with no session to sign in first (#418)', async ({
    page,
    app,
    notebook,
    owner,
    state,
    appLocale,
  }) => {
    const words = COMMUNITY_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, { objective: `Keep the findings of ${notebook.name}` });
    await owner.call('POST', `${model}/versions`, { changelog: 'The first version' });
    await eventually(
      'the first version of the model is ready',
      () => owner.ok<{ versions: Array<{ status: string }> }>('GET', model),
      (read) => read.versions[0]?.status === 'ready',
      { timeoutMs: 120_000 },
    );
    const profile = await owner.ok<{ name: string; email: string }>('GET', '/access/profile');
    if (!profile.name.trim() || profile.name === profile.email) {
      await owner.ok('PUT', '/access/profile', { name: 'Functional Owner', avatar: 'initials' });
    }
    await owner.ok('PUT', `${model}/publication`, {
      language: 'en',
      acceptLicence: true,
    });

    try {
      // No session at all: the community asks to sign in first (RN-PRT-059).
      await speak(page, state, appLocale);
      const authorize = page.waitForRequest((request) =>
        request.url().startsWith(`${state.surfaces.auth}/oauth2/authorize`),
      );
      await page.goto(`${state.surfaces.site}/community`);
      await authorize;

      // A notebook declared as a model is a model: it is not among the
      // notebooks, whose count is drawn once every list is read (#422).
      await app.goto(`${state.surfaces.site}/notebooks`);
      await expect(app.locator('.shelf-page .shelf-count')).toBeVisible({ timeout: 30_000 });
      await expect(app.locator('article.notebook-card', { hasText: notebook.name })).toHaveCount(0);

      // Signed in, it is a page of the application, under its menu.
      await app.goto(`${state.surfaces.site}/community`);
      await expect(app.locator('.app-menu-row nav.top-menu')).toBeVisible();
      await expect(app.getByRole('heading', { name: words.title, level: 1 })).toBeVisible();
      // Every published model is a card, the card the notebooks and the
      // models use, its corner saying it is the owner's own (#418).
      const card = app.locator('article.notebook-card', { hasText: notebook.name });
      await expect(card.locator('.ownership-mark[data-ownership="own"]')).toBeVisible({
        timeout: 90_000,
      });
      await expect(card.locator('button.notebook-card-more')).toBeVisible();
      // And the search of the header finds it among the community models.
      const field = app.locator('.app-header .global-search input[type="search"]');
      await field.fill(notebook.name);
      await app
        .locator('.global-search-group', {
          has: app.getByText(words.communityGroup, { exact: true }),
        })
        .locator('a', { hasText: notebook.name })
        .click({ timeout: 90_000 });

      await expect(app.getByRole('heading', { name: notebook.name, level: 1 })).toBeVisible();
      await expect(app.getByText(words.licence, { exact: false })).toBeVisible();
      await expect(app.getByRole('button', { name: words.report })).toBeVisible();
      await app
        .locator('.model-version', { hasText: 'v1' })
        .getByRole('link', { name: words.open })
        .click();
      await expect(app.getByRole('heading', { name: words.version(1) })).toBeVisible();
      await expect(app.getByRole('button', { name: words.create })).toBeVisible();
      await expect(app).toHaveTitle(new RegExp(notebook.name));

      // The trail goes back: to the model from its version, and to every
      // model of the community from the model (#422).
      const trail = app.locator('.notebook-bar .notebook-breadcrumb');
      await expect(trail.locator('.crumb.is-last')).toHaveText('v1');
      await trail.getByRole('link', { name: notebook.name }).click();
      await expect(app.getByRole('heading', { name: notebook.name, level: 1 })).toBeVisible();
      await trail.locator('a.crumb[href="/community"]').click();
      await expect(app.getByRole('heading', { name: words.title, level: 1 })).toBeVisible();
    } finally {
      await owner.call('DELETE', `${model}/publication`);
    }
  });
});

/** The words of the community pages, copied from the locale files of the interface. */
const COMMUNITY_WORDS: Record<
  AppLocale,
  {
    readonly title: string;
    readonly communityGroup: string;
    readonly licence: string;
    readonly report: string;
    readonly create: string;
    readonly open: string;
    readonly version: (number: number) => string;
  }
> = {
  en_US: {
    title: 'Community',
    communityGroup: 'Community',
    licence: 'Published under CC0 1.0',
    report: 'Report this model',
    create: 'Create a notebook from this version',
    open: 'Open',
    version: (number) => `Version ${number}`,
  },
  pt_BR: {
    title: 'Comunidade',
    communityGroup: 'Comunidade',
    licence: 'Publicado sob CC0 1.0',
    report: 'Denunciar este modelo',
    create: 'Criar um caderno a partir desta versão',
    open: 'Abrir',
    version: (number) => `Versão ${number}`,
  },
};
