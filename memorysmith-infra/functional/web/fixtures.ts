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
  /** The heading over the notebooks of the dashboard. */
  readonly openNotebook: string;
  /** The BCP 47 tag the case compares names in. */
  readonly locale: string;
  /** The heading of the space of the subscription on Home (#198). */
  readonly space: string;
  /** The ⋯ of a notebook card and what it holds (#199). */
  readonly moreActions: string;
  readonly exportNotebook: string;
  readonly deleteNotebook: string;
  readonly keep: string;
  readonly deleteForGood: string;
  /** The link the row of a finished import carries, which is another text. */
  readonly openImported: string;
  readonly context: string;
  readonly guidance: string;
  readonly templates: string;
  readonly graph: string;
  readonly notesInFolder: string;
  readonly notFound: string;
  readonly version: string;
  readonly tryAgain: string;
  readonly deleteSlot: string;
  readonly deleteSlotForGood: string;
  /** The notebook a new export names, in the dialog that starts one. */
  readonly notebookField: string;
  /** The action of the Transfers panel that opens the import dialog. */
  readonly importNotebook: string;
  readonly linkToSeveral: string;
  readonly transfers: string;
  /** The three tabs the page filters itself with (#161). */
  readonly filterAll: string;
  readonly filterExports: string;
  readonly filterImports: string;
  readonly download: string;
  readonly spaceUsed: string;
  readonly deleteUntouched: string;
  readonly chooseFile: string;
  readonly notebookName: string;
  /** The one line of the foot that says the import is refused (#161). */
  readonly nameTakenBlock: string;
  /** And the row of the tab that says the whole of it. */
  readonly nameTakenTitle: string;
  /** The tab every refusal is in, which opens only when there is one. */
  readonly tabConflicts: string;
  /** The button of the foot that opens it. */
  /** The foot of an import that refuses, which counts what refuses (#205). */
  readonly inconsistency: string;
  /** The space the kept exports take, as the page says it (#205). */
  readonly ofYourPlan: string;
  /** What the import dialog commits with, which is the verb alone (#160). */
  readonly importAction: string;
  /** The whole notebook, or part of it: the head of the first tab (#161). */
  readonly partOfIt: string;
  /** The notes, as the scope row and the tab of the chooser name them (#161). */
  readonly tabNotes: string;
  readonly newExport: string;
  readonly startExport: string;
  readonly willCreateNoNotes: string;
  readonly pending: (target: string) => string;
  /** The entry of the user menu that reopens the welcome surface (#167). */
  readonly aboutMenu: string;
  /** The user menu, as a menu is named (#201). */
  readonly accountMenu: string;
  readonly themeDark: string;
  readonly themeLight: string;
  /** Its heading, and the section that carries the address of the connector. */
  readonly aboutHeading: string;
  readonly aboutConnector: string;
  /** The two entries of the user menu that lead to the person (#168). */
  readonly profileMenu: string;
  readonly passwordMenu: string;
  /** The source of a picture that is drawn here and asks nothing of anybody. */
  readonly initials: string;
  /** What the password screen says before it changes anything. */
  readonly endsOtherSessions: string;
  readonly cancel: string;
  /** Writing a note from the interface (#169). */
  readonly editNote: string;
  readonly confirmEdit: string;
  readonly messageLabel: string;
  readonly writeIt: string;
  readonly historyHeading: string;
  readonly conflict: string;
}

export const WORDS: Record<AppLocale, Words> = {
  en_US: {
    openNotebook: 'Open a notebook',
    locale: 'en-US',
    space: 'Subscription space',
    moreActions: 'More actions',
    exportNotebook: 'Export notebook',
    deleteNotebook: 'Delete notebook…',
    keep: 'Keep',
    deleteForGood: 'Delete for good',
    openImported: 'Open notebook',
    context: 'Notebook Context',
    guidance: 'Guidance',
    templates: 'Templates',
    graph: 'Notebook graph',
    notesInFolder: 'Notes in this folder',
    notFound: 'Not found.',
    version: 'MemorySmith.app',
    tryAgain: 'Try again',
    deleteSlot: 'Delete',
    deleteSlotForGood: 'Delete for good',
    notebookField: 'Notebook',
    importNotebook: 'Import a notebook',
    linkToSeveral: 'This link leads to more than one note',
    transfers: 'Transfers',
    filterAll: 'All',
    filterExports: 'Exports',
    filterImports: 'Imports',
    download: 'Download',
    spaceUsed: 'Space used',
    deleteUntouched: 'is not touched',
    chooseFile: 'Choose a file',
    notebookName: 'Name',
    nameTakenBlock: 'The name is already a notebook of yours',
    nameTakenTitle: 'is already in use',
    tabConflicts: 'Conflicts',
    inconsistency: 'inconsistenc',
    ofYourPlan: 'of your plan',
    importAction: 'Import',
    partOfIt: 'Part of it',
    tabNotes: 'Notes',
    newExport: 'New export',
    startExport: 'Export',
    willCreateNoNotes: '0 notes',
    pending: (target) => `No note carries the name “${target}” yet.`,
    aboutMenu: 'About',
    accountMenu: 'Account menu',
    themeDark: 'Dark',
    themeLight: 'Light',
    aboutHeading: 'Welcome to MemorySmith.app',
    aboutConnector: 'Connecting your AI assistant',
    profileMenu: 'Your profile',
    passwordMenu: 'Change your password',
    initials: 'Your initials',
    endsOtherSessions: 'Changing your password ends every other session',
    cancel: 'Cancel',
    editNote: 'Edit this note',
    confirmEdit: 'Confirm',
    messageLabel: 'A line about this change',
    writeIt: 'Write it',
    historyHeading: 'History of this note',
    conflict: 'Somebody else wrote this note',
  },
  pt_BR: {
    openNotebook: 'Abrir um caderno',
    locale: 'pt-BR',
    space: 'Espaço da assinatura',
    moreActions: 'Mais ações',
    exportNotebook: 'Exportar caderno',
    deleteNotebook: 'Apagar caderno…',
    keep: 'Manter',
    deleteForGood: 'Apagar de vez',
    openImported: 'Abrir o caderno',
    context: 'Contexto do caderno',
    guidance: 'Orientação',
    templates: 'Modelos',
    graph: 'Grafo do caderno',
    notesInFolder: 'Notas nesta pasta',
    notFound: 'Não encontrado.',
    version: 'MemorySmith.app',
    tryAgain: 'Tentar de novo',
    deleteSlot: 'Apagar',
    deleteSlotForGood: 'Apagar de vez',
    notebookField: 'Caderno',
    importNotebook: 'Importar um caderno',
    linkToSeveral: 'Este link leva a mais de uma nota',
    transfers: 'Transferências',
    filterAll: 'Todas',
    filterExports: 'Exportações',
    filterImports: 'Importações',
    download: 'Baixar',
    spaceUsed: 'Espaço usado',
    deleteUntouched: 'não é tocado',
    chooseFile: 'Escolher um arquivo',
    notebookName: 'Nome',
    nameTakenBlock: 'O nome já é de um caderno seu',
    nameTakenTitle: 'já está em uso',
    tabConflicts: 'Inconsistências',
    inconsistency: 'inconsistência',
    ofYourPlan: 'do seu plano',
    importAction: 'Importar',
    partOfIt: 'Parte dele',
    tabNotes: 'Notas',
    newExport: 'Nova exportação',
    startExport: 'Exportar',
    willCreateNoNotes: '0 notas',
    pending: (target) => `Nenhuma nota se chama “${target}” ainda.`,
    aboutMenu: 'Sobre',
    accountMenu: 'Menu da conta',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    aboutHeading: 'Bem-vindo ao MemorySmith.app',
    aboutConnector: 'Conectando seu assistente de IA',
    profileMenu: 'Seu perfil',
    passwordMenu: 'Trocar a senha',
    initials: 'Suas iniciais',
    endsOtherSessions: 'Trocar a senha encerra todas as outras sessões',
    cancel: 'Cancelar',
    editNote: 'Editar esta nota',
    confirmEdit: 'Confirmar',
    messageLabel: 'Uma linha sobre esta mudança',
    writeIt: 'Gravar',
    historyHeading: 'Histórico desta nota',
    conflict: 'Outra pessoa gravou esta nota',
  },
};

export const GUIDANCE = '# Guidance\n\nWrite one finding per note, and say how it was verified.\n';
export const TEMPLATE = '## Finding\n\n## Verification\n';
/**
 * A link written INSIDE A TABLE, which is where the choice used to break: a
 * table of a note scrolls on its own, and the menu opened inside that scroll
 * box, clipped by it (#144). Two notes of the notebook carry the name it
 * addresses, in two folders, so the click has a choice to offer.
 */
export const TABLE_NOTE =
  '---\nname: Table\n---\n\n| Subject | Note |\n| --- | --- |\n| Extraction | [[Facet]] |\n';
export const CHECKLIST =
  '---\nname: Checklist\n---\n\n- [ ] first\n- [ ] second\n\nIt points at [[Nowhere yet]].\n';

export interface WebNotebook {
  readonly notebookId: string;
  readonly name: string;
  readonly folderId: string;
  readonly noteId: string;
  /** The note whose table holds a link to a name two notes carry. */
  readonly tableNoteId: string;
  /** The two notes named `Facet`, one per folder, in the order they were written. */
  readonly facetNoteIds: readonly [string, string];
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

  // A second folder, so that one name reaching two notes is a real case: a
  // folder holds one note of each name, and two folders may repeat it
  // (RN-KNW-042).
  const second = await owner.ok<{ folderId: string }>('POST', `${path}/folders`, {
    name: 'Concepts',
    description: 'What a web case defines.',
  });
  const facets: string[] = [];
  for (const where of [folderId, second.folderId]) {
    const facet = await owner.ok<{ noteId: string }>('POST', `${path}/notes`, {
      folderId: where,
      content: '---\nname: Facet\n---\n\nWhat a value of the frontmatter becomes.\n',
    });
    facets.push(facet.noteId);
  }
  const table = await owner.ok<{ noteId: string }>('POST', `${path}/notes`, {
    folderId,
    content: TABLE_NOTE,
  });

  return {
    notebookId,
    name,
    folderId,
    noteId,
    tableNoteId: table.noteId,
    facetNoteIds: [facets[0] ?? '', facets[1] ?? ''],
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
