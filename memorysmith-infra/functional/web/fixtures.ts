/**
 * What every web case starts from (architecture-guide.md, section 19): a locale,
 * the words the interface says in it, a notebook of the case's own, and a page
 * already signed in as the owner of the run.
 *
 * The interface has no test identifiers, and it does not need them: a case
 * finds what a person finds, by role, by heading and by the words on the screen,
 * in the locale its project runs in. The words live here, one table per locale,
 * copied from the locale files of the interface.
 */

import { test as base, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { apiToken } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readState, type RunState, type TestAccount } from '../support/state.js';
import { webSession } from '../support/web-session.js';

export type AppLocale = 'en_US' | 'pt_BR';

export interface Words {
  readonly openNotebook: string;
  readonly context: string;
  readonly guidance: string;
  readonly templates: string;
  readonly graph: string;
  readonly root: string;
  readonly notesInFolder: string;
  readonly notFound: string;
  readonly version: string;
  readonly tryAgain: string;
  readonly deleteSlot: string;
  readonly deleteSlotForGood: string;
  readonly pending: (target: string) => string;
}

export const WORDS: Record<AppLocale, Words> = {
  en_US: {
    openNotebook: 'Open a notebook',
    context: 'Notebook Context',
    guidance: 'Guidance',
    templates: 'Templates',
    graph: 'Notebook graph',
    root: 'Root',
    notesInFolder: 'Notes in this folder',
    notFound: 'Not found.',
    version: 'Version',
    tryAgain: 'Try again',
    deleteSlot: 'Delete',
    deleteSlotForGood: 'Delete for good',
    pending: (target) => `No note carries the name “${target}” yet.`,
  },
  pt_BR: {
    openNotebook: 'Abrir um caderno',
    context: 'Contexto do caderno',
    guidance: 'Orientação',
    templates: 'Modelos',
    graph: 'Grafo do caderno',
    root: 'Raiz',
    notesInFolder: 'Notas nesta pasta',
    notFound: 'Não encontrado.',
    version: 'Versão',
    tryAgain: 'Tentar de novo',
    deleteSlot: 'Apagar',
    deleteSlotForGood: 'Apagar de vez',
    pending: (target) => `Nenhuma nota se chama “${target}” ainda.`,
  },
};

export const GUIDANCE = '# Guidance\n\nWrite one finding per note, and say how it was verified.\n';
export const TEMPLATE = '## Finding\n\n## Verification\n';
export const CHECKLIST =
  '---\nname: Checklist\n---\n\n- [ ] first\n- [ ] second\n\nIt points at [[Nowhere yet]].\n';

export interface WebNotebook {
  readonly notebookId: string;
  readonly name: string;
  readonly folderId: string;
  readonly noteId: string;
  /** An address of the interface inside this notebook, with the lower-case ids it uses. */
  readonly page: (path?: string) => string;
}

export interface WebOptions {
  appLocale: AppLocale;
}

interface WebFixtures {
  state: RunState;
  owner: Api;
  words: Words;
  notebook: WebNotebook;
  app: Page;
}

type Scope = {
  location: { origin: string };
  localStorage: { setItem(key: string, value: string): void; removeItem(key: string): void };
};

/** Sets the locale of the interface before its first page loads, which is when it is read. */
export async function speak(page: Page, state: RunState, locale: AppLocale): Promise<void> {
  await page.addInitScript(
    ({ site, locale }) => {
      const scope = globalThis as unknown as Scope;
      if (scope.location.origin !== site) return;
      scope.localStorage.setItem('memorysmith.locale', locale);
      // A remembered note would turn the page of a notebook into a redirect.
      scope.localStorage.removeItem('memorysmith.lastNote');
    },
    { site: state.surfaces.site, locale },
  );
}

/** Signs a page in as an account, in a locale, before the first page of the site loads. */
export async function openAs(
  page: Page,
  state: RunState,
  account: TestAccount,
  locale: AppLocale,
): Promise<void> {
  const tokens = JSON.stringify(await webSession(state, account));
  await speak(page, state, locale);
  await page.addInitScript(
    ({ site, tokens }) => {
      const scope = globalThis as unknown as Scope;
      if (scope.location.origin === site) scope.localStorage.setItem('memorysmith.tokens', tokens);
    },
    { site: state.surfaces.site, tokens },
  );
}

/** A notebook with a Guidance, a folder with a Template, and a note with a checklist. */
export async function writeNotebook(owner: Api, state: RunState): Promise<WebNotebook> {
  const name = `Web ${randomBytes(4).toString('hex')}`;
  const { notebookId } = await owner.ok<{ notebookId: string }>('POST', '/knowledge/notebooks', {
    name,
    description: 'A notebook a web case reads.',
  });
  const path = `/knowledge/notebooks/${notebookId}`;
  await owner.ok('PUT', `${path}/guidance`, { content: GUIDANCE, baseRevision: null });
  const { folderId } = await owner.ok<{ folderId: string }>('POST', `${path}/folders`, {
    name: 'Findings',
    description: 'What a web case found.',
  });
  await owner.ok('PUT', `${path}/folders/${folderId}/template`, {
    content: TEMPLATE,
    baseRevision: null,
  });
  const { noteId } = await owner.ok<{ noteId: string }>('POST', `${path}/notes`, {
    folderId,
    content: CHECKLIST,
  });
  return {
    notebookId,
    name,
    folderId,
    noteId,
    page: (suffix = '') => `${state.surfaces.site}/notebooks/${notebookId.toLowerCase()}${suffix}`,
  };
}

export const test = base.extend<WebOptions & WebFixtures>({
  appLocale: ['en_US', { option: true }],
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  state: async ({}, use) => {
    await use(readState());
  },
  owner: async ({ state }, use) => {
    await use(new Api(state.surfaces.api, await apiToken(state, state.accounts.owner)));
  },
  words: async ({ appLocale }, use) => {
    await use(WORDS[appLocale]);
  },
  notebook: async ({ owner, state }, use) => {
    await use(await writeNotebook(owner, state));
  },
  app: async ({ page, state, appLocale }, use) => {
    await openAs(page, state, state.accounts.owner, appLocale);
    await use(page);
  },
});

export { expect };
