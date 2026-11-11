/**
 * Notebook models in the interface (#353, #354, #355, #359, #431, #435): the
 * owner declares a notebook as a model and reads its history, and a notebook
 * is created from it in New notebook, the one way; a person of another
 * subscription the model is shared with as a model reader reads it, what it
 * holds included, on pages of their own, outside any notebook. A model has no
 * versions, and an address of one opens the model.
 */

import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import type { Locator, Page } from '@playwright/test';
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
    readonly tabContents: string;
    readonly tabHistory: string;
    /** The footer of New notebook, as in a blank one (#435). */
    readonly cancel: string;
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
    tabContents: 'Contents',
    tabHistory: 'History',
    cancel: 'Cancel',
    create: 'Create',
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
    tabContents: 'Conteúdo',
    tabHistory: 'Histórico',
    cancel: 'Cancelar',
    create: 'Criar',
    sharedBy: 'Compartilhado com você por',
  },
};

/** The words of the picker of a model (#432), copied from the locale files of the interface. */
const PICKER_WORDS: Record<
  AppLocale,
  {
    readonly fromModel: string;
    readonly model: string;
    readonly mine: string;
    readonly shared: string;
    readonly community: string;
    readonly chooseModel: string;
    readonly noModel: string;
    readonly select: string;
    readonly back: string;
  }
> = {
  en_US: {
    fromModel: 'From a model',
    model: 'Model',
    mine: 'Mine',
    shared: 'Shared with me',
    community: 'Community',
    chooseModel: 'Choose model',
    noModel: 'No model chosen yet',
    select: 'Select',
    back: 'Back',
  },
  pt_BR: {
    fromModel: 'De um Modelo de caderno',
    model: 'Modelo de caderno',
    mine: 'Meus',
    shared: 'Compartilhados comigo',
    community: 'Comunidade',
    chooseModel: 'Escolher modelo',
    noModel: 'Nenhum modelo escolhido',
    select: 'Selecionar',
    back: 'Voltar',
  },
};

/**
 * Opens New notebook on the notebooks, from a model: one form from the start,
 * its first field the model, with Choose model (#437).
 */
async function openNewFromModel(app: Page, site: string, locale: AppLocale) {
  const words = MODEL_WORDS[locale];
  const picker = PICKER_WORDS[locale];
  await app.goto(`${site}/notebooks`);
  await app.getByRole('button', { name: words.newNotebook }).click();
  const box = app.locator('.new-notebook .ask-dialog-box');
  await box.getByRole('radio', { name: picker.fromModel }).click();
  const foot = box.locator('.ask-dialog-foot');
  return {
    box,
    chooseModel: box.getByRole('button', { name: picker.chooseModel, exact: true }),
    // Cancel and Create are in the footer of the form, as in a blank notebook (#435).
    cancel: foot.getByRole('button', { name: words.cancel, exact: true }),
    create: foot.getByRole('button', { name: words.create, exact: true }),
    // And the list, once Choose model opened it, has Back and Select (#437).
    field: box.getByRole('combobox', { name: picker.model, exact: true }),
    back: foot.getByRole('button', { name: picker.back, exact: true }),
    select: foot.getByRole('button', { name: picker.select, exact: true }),
  };
}

/** Opens New notebook from a model, and its list of models. */
async function openModelPicker(app: Page, site: string, locale: AppLocale) {
  const opened = await openNewFromModel(app, site, locale);
  await opened.chooseModel.click();
  return opened;
}

/** The row of the picker whose name is exactly this one, never one that starts with it. */
function rowNamed(box: Locator, name: string): Locator {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`^${escaped}$`);
  return box
    .locator('.search-picker-row')
    .filter({ has: box.page().locator('.search-picker-name', { hasText: exact }) });
}

/** Opens one's own models in the picker of New notebook, searched by a name. */
async function pickOwnModel(app: Page, site: string, locale: AppLocale, name: string) {
  const opened = await openModelPicker(app, site, locale);
  await opened.box.getByRole('tab', { name: new RegExp(`^${PICKER_WORDS[locale].mine}`) }).click();
  await opened.field.fill(name);
  return opened;
}

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
      // It is a notebook of mine, and opens on its overview as one does (#417).
      await expect(mine.first().locator('a.notebook-open')).toHaveAttribute(
        'href',
        /^\/notebooks\/[0-9a-z]{26}$/,
      );
      await mine.first().locator('button.notebook-card-more').click();
      await expect(app.getByRole('menuitem')).toHaveCount(3);
      await app.keyboard.press('Escape');
    }
    await testInfo.attach('models.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

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

  test('[page:/notebooks/:notebookId/model] creates a model from the models, reads its history as the list of a folder with no Contents tab, and creates a notebook from it in New notebook (#431, #435)', async ({
    app,
    notebook,
    owner,
    appLocale,
    state,
  }, testInfo) => {
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
    // On every page of it, its folders among them, and its trail starts on
    // Models (#422).
    const modelPage = app.url();
    await app.locator('#notebook-nav-parts a[href$="/folders"]').click();
    await app.waitForURL(/\/folders$/);
    await expect(app.locator('nav.top-menu .top-menu-item.active')).toHaveAttribute(
      'href',
      '/models',
    );
    await expect(app.locator('.notebook-breadcrumb a.crumb.is-shelf')).toHaveAttribute(
      'href',
      '/models',
    );
    // Its overview opens on its model, a card the whole row above the others,
    // with the icon of the sidebar (#429).
    await app.locator('aside#notebook-sidebar nav.notebook-nav > a.nav-row').first().click();
    const modelCard = app.locator('.overview-stats .overview-stat.is-wide');
    await expect(modelCard.locator('a.overview-stat-link')).toHaveAttribute('href', /\/model$/);
    await expect(modelCard.locator('.overview-stat-icon svg')).toBeVisible();
    // Its Context lists what it declares as a model, first of its parts (#422);
    // the Context is a page of its own, under the overview (#417).
    await app.locator('aside#notebook-sidebar a.nav-row[href$="/context"]').click();
    await expect(app.locator('a.context-card')).toHaveCount(4);
    await expect(app.locator('a.context-card').first()).toHaveAttribute('href', /\/model$/);
    await app.goto(modelPage);

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

    // Its owner reads the notebook by navigating it, so its page has no
    // Contents, and no button creates a notebook from it there (#435).
    await expect(app.getByRole('tab', { name: words.tabContents })).toHaveCount(0);
    await expect(app.locator('section.model-contents')).toHaveCount(0);

    // Nor History: its history is the overview of its notebook (#446), the
    // trail of it, which follows a write within seconds (#431), drawn as the
    // list of a folder (#435).
    await expect(app.getByRole('tab', { name: words.tabHistory })).toHaveCount(0);
    await app.locator('aside#notebook-sidebar nav.notebook-nav > a.nav-row').first().click();
    const rows = app.locator('#overview-history .model-history-table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 90_000 });
    // What changed comes first, its kind its tooltip, as a note of a folder (#437).
    await expect(rows.first().locator('td').first()).toHaveClass(/model-history-what/);
    await expect(rows.first().locator('.model-history-what')).toHaveAttribute('title', /\S/);
    await expect(rows.first().locator('.property-chip')).toHaveCount(0);
    await app.locator('#overview-history').scrollIntoViewIfNeeded();
    await testInfo.attach('model-history.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await app.setViewportSize({ width: 390, height: 844 });
    await expect(rows.first()).toBeVisible();
    await app.locator('#overview-history').scrollIntoViewIfNeeded();
    await testInfo.attach('model-history-phone.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await app.setViewportSize({ width: 1280, height: 800 });

    // A notebook is created from it in New notebook, the one way (#435).
    const { box, create, select } = await pickOwnModel(
      app,
      state.surfaces.site,
      appLocale,
      modelName,
    );
    await rowNamed(box, modelName).click();
    await select.click();
    const fields = box.locator('.create-from-model');
    await expect(fields).toBeVisible();
    // Its one parameter is required, so Create waits for it.
    await expect(create).toBeDisabled();
    const name = `${notebook.name} for Aurora`;
    await fields.locator('input').first().fill(name);
    await fields.locator('#value-client').fill('Aurora');
    await expect(create).toBeEnabled();
    await create.click();
    await app.waitForURL(/\/notebooks\/[0-9a-z]{26}$/, { timeout: 120_000 });
    // It opens on its overview, whose history starts with its creation from
    // the model, the copy that wrote it folded into that one row (#446).
    const createdRows = app.locator('#overview-history .model-history-table tbody tr');
    await expect(createdRows.last()).toContainText(modelName, { timeout: 90_000 });
    await expect(createdRows).toHaveCount(1);
    await app.locator('#overview-history').scrollIntoViewIfNeeded();
    await testInfo.attach('overview-history.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

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

  test('[page:/notebooks/:notebookId/model/versions/:version] draws a yes-or-no parameter as a box beside its name in New notebook from a model, with Cancel and Create in its footer before and after choosing, and the old address of a version opens the model (#411, #431, #435)', async ({
    app,
    notebook,
    owner,
    state,
    appLocale,
  }, testInfo) => {
    const words = MODEL_WORDS[appLocale];
    const picker = PICKER_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, {
      objective: 'Keep the findings of one review',
      parameters: [
        { name: 'withMinutes', type: 'boolean', required: false, default: true },
        { name: 'client', type: 'text', required: true },
      ],
    });

    // An address of a version, bookmarked before #431, opens the model on its
    // first tab: the page of one's own model has no Contents (#435).
    await app.goto(notebook.page('/model/versions/1'));
    await app.waitForURL(/\/model$/);
    await expect(app.getByRole('tab', { name: words.tabAbout })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(app.getByRole('tab', { name: words.tabContents })).toHaveCount(0);

    // New notebook from a model is one form from the start: the model field,
    // Choose model, the name, Cancel and a disabled Create (#435, #437).
    const { box, chooseModel, cancel, create, field, back, select } = await openNewFromModel(
      app,
      state.surfaces.site,
      appLocale,
    );
    await expect(box.getByText(picker.noModel)).toBeVisible();
    await expect(cancel).toBeVisible();
    await expect(create).toBeDisabled();
    await testInfo.attach('new-notebook-from-model.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    // Choose model opens the list; a click marks a row, Select takes it back.
    await chooseModel.click();
    await box.getByRole('tab', { name: new RegExp(`^${picker.mine}`) }).click();
    await field.fill(notebook.name);
    const row = rowNamed(box, notebook.name);
    await expect(row).toBeVisible();
    await expect(select).toBeDisabled();
    await row.click();
    await expect(row).toHaveClass(/is-chosen/);
    // The row chosen says so with its radio, filled (#438).
    await expect(row.locator('.search-picker-radio.is-chosen')).toBeVisible();
    await expect(back).toBeVisible();
    await testInfo.attach('new-notebook-model-list.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await select.click();

    // Back in the form: the model in its field, its parameters under it.
    await expect(field).toHaveCount(0);
    await expect(box.locator('.new-notebook-chosen strong')).toHaveText(notebook.name);
    const fields = box.locator('.create-from-model');
    const tick = fields.locator('#value-withMinutes');
    await expect(tick).toBeChecked();
    await expect(cancel).toBeVisible();
    await expect(create).toBeDisabled();
    await testInfo.attach('new-notebook-from-model-chosen.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    // A box of its own size, never the width of the text field below it.
    const drawn = await tick.boundingBox();
    const text = await fields.locator('#value-client').boundingBox();
    expect(drawn && drawn.width <= 24 && drawn.height <= 24).toBe(true);
    expect(text && text.width > 200).toBe(true);
    // Its name is its label, beside it: clicking the name ticks it.
    await fields
      .locator('label.parameter-required', { hasText: 'withMinutes' })
      .locator('span')
      .click();
    await expect(tick).not.toBeChecked();
    // Create waits for the required parameter, and only for it.
    await expect(create).toBeDisabled();
    await fields.locator('#value-client').fill('Aurora');
    await expect(create).toBeEnabled();
    await cancel.click();
    await expect(box).toHaveCount(0);

    // On a phone, the form, the list and the form again, the footer the foot of the screen.
    await app.setViewportSize({ width: 390, height: 844 });
    const phone = await openNewFromModel(app, state.surfaces.site, appLocale);
    await expect(phone.create).toBeVisible();
    await testInfo.attach('new-notebook-from-model-phone.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await phone.chooseModel.click();
    await phone.box.getByRole('tab', { name: new RegExp(`^${picker.mine}`) }).click();
    await phone.field.fill(notebook.name);
    const phoneRow = rowNamed(phone.box, notebook.name);
    await phoneRow.click();
    await testInfo.attach('new-notebook-model-list-phone.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
    await phone.select.click();
    await expect(phone.box.locator('.create-from-model #value-withMinutes')).toBeVisible();
    await expect(phone.create).toBeDisabled();
    await testInfo.attach('new-notebook-from-model-chosen-phone.png', {
      body: await app.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });
  });

  test('[page:/notebooks] [page:/transfers] finds a model of its own and a community model in one picker, creates a notebook from the community one from the keyboard, and picks a notebook to export the same way (#432)', async ({
    app,
    notebook,
    owner,
    state,
    appLocale,
    words: common,
  }, testInfo) => {
    const words = MODEL_WORDS[appLocale];
    const picker = PICKER_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, {
      objective: `Keep the findings of ${notebook.name}`,
      parameters: [{ name: 'client', type: 'text', required: true }],
    });
    const profile = await owner.ok<{ name: string; email: string }>('GET', '/access/profile');
    if (!profile.name.trim() || profile.name === profile.email) {
      await owner.ok('PUT', '/access/profile', { name: 'Functional Owner', avatar: 'initials' });
    }
    await owner.ok('PUT', `${model}/publication`, { language: 'en', acceptLicence: true });
    const name = `${notebook.name} from the community`;

    try {
      // Mine: read whole and filtered as the name is typed.
      const { box, field } = await openModelPicker(app, state.surfaces.site, appLocale);
      await box.getByRole('tab', { name: new RegExp(`^${picker.mine}`) }).click();
      await field.fill(notebook.name);
      await expect(box.locator('.search-picker-row', { hasText: notebook.name })).toBeVisible();
      await testInfo.attach('picker-mine.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      // The community: searched on the server, a page at a time.
      await box.getByRole('tab', { name: picker.community, exact: true }).click();
      await expect(box.locator('.search-picker-row', { hasText: notebook.name })).toBeVisible({
        timeout: 90_000,
      });
      await testInfo.attach('picker-community.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      // From the keyboard: the field keeps the focus and Enter marks the lit
      // row; Select takes it back to the form (#437).
      await field.press('Enter');
      await box
        .locator('.ask-dialog-foot')
        .getByRole('button', { name: picker.select, exact: true })
        .click();
      const fields = box.locator('.create-from-model');
      await expect(fields).toBeVisible();
      await fields.locator('input').first().fill(name);
      await fields.locator('#value-client').fill('Aurora');
      // Created from the footer, as a blank notebook is (#435).
      await box
        .locator('.ask-dialog-foot')
        .getByRole('button', { name: words.create, exact: true })
        .click();
      // Created in the dialog, never on another page, and opened.
      await app.waitForURL(/\/notebooks\/[0-9a-z]{26}$/, { timeout: 120_000 });

      // On a phone the picker is the dialog, the whole screen.
      await app.setViewportSize({ width: 390, height: 844 });
      const phone = await openModelPicker(app, state.surfaces.site, appLocale);
      await phone.field.fill(notebook.name);
      await expect.poll(async () => (await phone.box.boundingBox())?.width ?? 0).toBe(390);
      await testInfo.attach('picker-phone.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await app.keyboard.press('Escape');

      // The export asks for its notebook in the same picker.
      await app.setViewportSize({ width: 1280, height: 800 });
      await app.goto(`${state.surfaces.site}/transfers`);
      await app
        .locator('.transfers-start')
        .getByRole('button', { name: common.newExport, exact: true })
        .click();
      const dialog = app.locator('.transfer-dialog');
      // It opens on its form, the notebook a field with Choose notebook (#444).
      await expect(dialog.locator('.export-chosen')).toBeVisible();
      await testInfo.attach('export-form.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await dialog.getByRole('button', { name: common.chooseNotebook, exact: true }).click();
      await dialog.getByRole('combobox', { name: common.notebookField, exact: true }).fill(name);
      const row = dialog.locator('.search-picker-row', { hasText: name }).first();
      await expect(row).toBeVisible();
      // Under the mouse the whole row is shaded, and no name is underlined (#444).
      await row.hover();
      await expect(row).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(row.locator('.search-picker-name')).toHaveCSS('text-decoration-line', 'none');
      await testInfo.attach('export-picker.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      // Back returns to the form with nothing chosen, on a phone as well.
      await app.setViewportSize({ width: 390, height: 844 });
      await dialog.getByRole('button', { name: common.backFromPicker, exact: true }).click();
      await expect(dialog.locator('.export-chosen .hint')).toBeVisible();
      await testInfo.attach('export-form-phone.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
    } finally {
      const listed = await owner.ok<Array<{ notebookId: string; name: string }>>(
        'GET',
        '/knowledge/notebooks',
      );
      const created = listed.find((each) => each.name === name);
      if (created) await owner.call('DELETE', `/knowledge/notebooks/${created.notebookId}`);
      await owner.call('DELETE', `${model}/publication`);
    }
  });

  test('[page:/models/:notebookId] [page:/models/:notebookId/versions/:version] opens a model shared as a model reader, with what it holds and its history, never its notebook, and creates from it in New notebook only (#435)', async ({
    page,
    notebook,
    owner,
    state,
    appLocale,
    words: common,
  }, testInfo) => {
    const words = MODEL_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, { objective: 'Keep the findings of one review' });

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
      // What it holds and its history are tabs of their own (#400, #431); what
      // it holds is read here, where its notebook cannot be opened, and
      // nothing on it creates a notebook (#435).
      await page.getByRole('tab', { name: words.tabContents }).click();
      const contents = page.locator('section.model-contents');
      await expect(contents).toBeVisible();
      await expect(contents.locator('form, .create-from-model')).toHaveCount(0);
      await testInfo.attach('model-reader.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(contents).toBeVisible();
      await testInfo.attach('model-reader-phone.png', {
        body: await page.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.getByRole('tab', { name: words.tabHistory }).click();
      await expect(page.locator('.model-history-table tbody tr').first()).toBeVisible({
        timeout: 90_000,
      });
      // An address of a version opens what the model holds, as it stands.
      await page.goto(
        `${state.surfaces.site}/models/${notebook.notebookId.toLowerCase()}/versions/1`,
      );
      await page.waitForURL(/\?tab=contents$/);
      await expect(page.locator('section.model-contents')).toBeVisible();

      // And New notebook finds it among the models shared with them (#432).
      const picker = PICKER_WORDS[appLocale];
      const { box, field } = await openModelPicker(page, state.surfaces.site, appLocale);
      await box.getByRole('tab', { name: new RegExp(`^${picker.shared}`) }).click();
      await field.fill(notebook.name);
      await box.locator('.search-picker-row', { hasText: notebook.name }).click();
      await box
        .locator('.ask-dialog-foot')
        .getByRole('button', { name: picker.select, exact: true })
        .click();
      await expect(box.locator('.create-from-model')).toBeVisible();
      await page.keyboard.press('Escape');

      // The notebook itself stays closed to a model reader.
      await page.goto(notebook.page());
      await expect(page.getByText(common.notFound, { exact: true })).toBeVisible();
    } finally {
      const { user } = await other.ok<{ user: { userId: string } }>('GET', '/access/session');
      await owner.call('DELETE', `${shares}/${user.userId}`);
    }
  });

  test('[page:/community] [page:/community/:publicId] [page:/community/:publicId/versions/:version] finds a published model signed in, under the menu, reads what it holds and its history, creates nothing on its page, and sends a visitor with no session to sign in first (#418, #431, #435)', async ({
    browser,
    app,
    notebook,
    owner,
    state,
    appLocale,
  }, testInfo) => {
    const words = COMMUNITY_WORDS[appLocale];
    const model = `/portability/models/${notebook.notebookId}`;
    await owner.ok('PUT', model, { objective: `Keep the findings of ${notebook.name}` });
    const profile = await owner.ok<{ name: string; email: string }>('GET', '/access/profile');
    if (!profile.name.trim() || profile.name === profile.email) {
      await owner.ok('PUT', '/access/profile', { name: 'Functional Owner', avatar: 'initials' });
    }
    await owner.ok('PUT', `${model}/publication`, {
      language: 'en',
      acceptLicence: true,
    });

    try {
      // The Community tab of the model says it is published, and links nowhere (#437).
      await app.goto(notebook.page('/model?tab=community'));
      const publication = app.locator('section.model-publication');
      await expect(publication).toBeVisible();
      await expect(publication.locator('a[href^="/community/"]')).toHaveCount(0);
      await testInfo.attach('model-community.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });

      // No session at all: the community asks to sign in first (RN-PRT-079).
      // A context of its own, because `app` is `page` already signed in.
      const visitor = await browser.newPage();
      try {
        await speak(visitor, state, appLocale);
        const authorize = visitor.waitForRequest((request) =>
          request.url().startsWith(`${state.surfaces.auth}/oauth2/authorize`),
        );
        await visitor.goto(`${state.surfaces.site}/community`);
        await authorize;
      } finally {
        await visitor.close();
      }

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
      // A notebook is created from it in New notebook, so its card has no ⋯ (#435).
      await expect(card.locator('button.notebook-card-more')).toHaveCount(0);
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
      // Nobody reports a model, and About lists no parameters (#439).
      await expect(app.getByRole('button', { name: words.report })).toHaveCount(0);
      await expect(app.locator('.parameter-list')).toHaveCount(0);
      await expect(app).toHaveTitle(new RegExp(notebook.name));
      await testInfo.attach('community-about.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      const modelAddress = app.url();
      await app.getByRole('tab', { name: words.tabContents }).click();
      const contents = app.locator('section.model-contents');
      await expect(contents).toBeVisible();
      await expect(contents.locator('form, .create-from-model')).toHaveCount(0);
      // Each part an accordion, its Markdown drawn as a note reads (#439).
      const folder = contents.locator('details.model-part', {
        has: app.locator(':scope > summary', { hasText: 'Findings' }),
      });
      await folder.locator(':scope > summary').click();
      await folder
        .locator(':scope > .template-card-body > details.model-part > summary')
        .first()
        .click();
      await expect(folder.getByRole('heading', { name: 'Verification' })).toBeVisible();
      // Beside its name, a part says whether it is a folder or a note (#443).
      await expect(folder.locator(':scope > summary .model-part-kind')).toHaveText(
        words.kindFolder,
      );
      const noteKinds = folder.locator(
        ':scope > .template-card-body > details.model-part > summary .model-part-kind',
      );
      await expect(noteKinds.first()).toHaveText(words.kindNote);
      // A note still folded points its chevron right, inside a folder that is open.
      await expect(
        folder
          .locator(':scope > .template-card-body > details.model-part:not([open]) > summary')
          .first()
          .locator('.template-card-chevron'),
      ).toHaveCSS('transform', 'none');
      await noteKinds.first().scrollIntoViewIfNeeded();
      await testInfo.attach('community-contents.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await app.setViewportSize({ width: 390, height: 844 });
      await folder.locator(':scope > summary').scrollIntoViewIfNeeded();
      await testInfo.attach('community-contents-phone.png', {
        body: await app.screenshot({ animations: 'disabled' }),
        contentType: 'image/png',
      });
      await app.setViewportSize({ width: 1280, height: 720 });
      // Its history says when and what, never who, not even the column (#431, #435).
      await app.getByRole('tab', { name: words.tabHistory }).click();
      await expect(app.locator('.model-history-table tbody tr').first()).toBeVisible({
        timeout: 90_000,
      });
      await expect(app.locator('.model-history-table .model-history-who')).toHaveCount(0);
      await expect(app.locator('.model-history-table thead th')).toHaveCount(3);

      // An address of a version opens what the model holds as it stands.
      await app.goto(`${modelAddress.replace(/\?.*$/, '')}/versions/1`);
      await app.waitForURL(/\?tab=contents$/);
      await expect(app.locator('section.model-contents')).toBeVisible();

      // The trail goes back to every model of the community (#422).
      const trail = app.locator('.notebook-bar .notebook-breadcrumb');
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
    readonly tabContents: string;
    readonly tabHistory: string;
    readonly kindFolder: string;
    readonly kindNote: string;
  }
> = {
  en_US: {
    title: 'Community',
    communityGroup: 'Community',
    licence: 'Published under CC0 1.0',
    report: 'Report this model',
    tabContents: 'Contents',
    tabHistory: 'History',
    kindFolder: 'Folder',
    kindNote: 'Note',
  },
  pt_BR: {
    title: 'Comunidade',
    communityGroup: 'Comunidade',
    licence: 'Publicado sob CC0 1.0',
    report: 'Denunciar este modelo',
    tabContents: 'Conteúdo',
    tabHistory: 'Histórico',
    kindFolder: 'Pasta',
    kindNote: 'Nota',
  },
};
