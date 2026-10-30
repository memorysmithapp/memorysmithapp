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
    readonly name: string;
    readonly notAModel: string;
    readonly addParameter: string;
    readonly parameterName: string;
    readonly required: string;
    readonly declare: string;
    readonly saved: string;
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
    newModel: 'New notebook model',
    name: 'Name',
    notAModel: 'This notebook is not a model.',
    addParameter: 'Add a parameter',
    parameterName: 'Name',
    required: 'Required',
    declare: 'Declare as a model',
    saved: 'Saved.',
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
    newModel: 'Novo Modelo de caderno',
    name: 'Nome',
    notAModel: 'Este caderno não é um Modelo de caderno.',
    addParameter: 'Adicionar um parâmetro',
    parameterName: 'Nome',
    required: 'Obrigatório',
    declare: 'Declarar como Modelo de caderno',
    saved: 'Salvo.',
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
  test('[page:/notebooks/:notebookId/model] [page:/notebooks/:notebookId/model/versions/:version] creates a model from Home, freezes a version and creates a notebook from it', async ({
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

    await app.goto(new URL('/', app.url()).href);
    await app.getByRole('button', { name: words.newNotebook }).click();
    await app.getByRole('menuitem', { name: words.newModel }).click();
    const modelName = `${notebook.name} model`;
    await app.getByLabel(words.name, { exact: true }).first().fill(modelName);
    await app.getByLabel(words.objective, { exact: true }).fill('Keep the findings of one review');
    await app.getByRole('button', { name: words.addParameter }).click();
    const row = app.locator('.parameter-row').first();
    await row.getByLabel(words.parameterName, { exact: true }).fill('client');
    await row.getByLabel(words.required, { exact: true }).check();
    await app.getByRole('button', { name: words.declare }).click();
    await app.waitForURL(/\/notebooks\/[0-9a-z]{26}$/, { timeout: 60_000 });
    // First of the menu, with no reload, and it is where the model is kept.
    const item = app.locator('.notebook-nav a').first();
    await expect(item).toHaveText(words.newModel.replace(/^\S+\s/, ''), { ignoreCase: true });
    await item.click();
    await expect(app.getByLabel(words.objective, { exact: true })).toBeVisible();

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

  test('[page:/community] [page:/community/:publicId] [page:/community/:publicId/versions/:version] finds a published model with no account, reads it and its version, and asks to sign in to create from it', async ({
    page,
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
      // No session at all: the catalog is read by anybody.
      await speak(page, state, appLocale);
      await page.goto(`${state.surfaces.site}/community`);
      await expect(page.getByRole('heading', { name: words.title, level: 1 })).toBeVisible();
      await page.getByRole('searchbox').fill(notebook.name);
      await page.getByRole('button', { name: words.find, exact: true }).click();
      await page.getByRole('link', { name: notebook.name }).click({ timeout: 90_000 });

      await expect(page.getByRole('heading', { name: notebook.name, level: 1 })).toBeVisible();
      await expect(page.getByText(words.licence, { exact: false })).toBeVisible();
      await expect(page.getByRole('link', { name: words.signInToReport })).toBeVisible();
      await page
        .locator('.model-version', { hasText: 'v1' })
        .getByRole('link', { name: words.open })
        .click();
      await expect(page.getByRole('heading', { name: words.version(1) })).toBeVisible();
      await expect(page.getByRole('link', { name: words.signInToCreate })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(notebook.name));
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
    readonly find: string;
    readonly licence: string;
    readonly signInToReport: string;
    readonly signInToCreate: string;
    readonly open: string;
    readonly version: (number: number) => string;
  }
> = {
  en_US: {
    title: 'Community models',
    find: 'Find',
    licence: 'Published under CC0 1.0',
    signInToReport: 'Sign in to report this model',
    signInToCreate: 'Sign in to create a notebook from this version',
    open: 'Open',
    version: (number) => `Version ${number}`,
  },
  pt_BR: {
    title: 'Modelos da comunidade',
    find: 'Buscar',
    licence: 'Publicado sob CC0 1.0',
    signInToReport: 'Entre para denunciar este modelo',
    signInToCreate: 'Entre para criar um caderno a partir desta versão',
    open: 'Abrir',
    version: (number) => `Versão ${number}`,
  },
};
