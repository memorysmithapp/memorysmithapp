/**
 * What every API case starts from (architecture-guide.md, section 19): the
 * state of the run, the API called as each of its accounts, and a notebook of
 * the case's own, so no case depends on what another one left behind.
 */

import { test as base, expect } from '@playwright/test';
import { randomBytes, randomInt } from 'node:crypto';
import { apiToken, createAccount, deleteAccount } from '../support/accounts.js';
import { Api } from '../support/api.js';
import { readState, type RunState, type TestAccount } from '../support/state.js';

export interface NotebookFixture {
  readonly notebookId: string;
  readonly name: string;
  readonly folderId: string;
  readonly noteId: string;
}

export interface Newcomer {
  readonly account: TestAccount;
  readonly api: Api;
  readonly userId: string;
}

interface Fixtures {
  state: RunState;
  anonymous: Api;
  owner: Api;
  other: Api;
  admin: Api;
  notebook: NotebookFixture;
  newcomer: Newcomer;
}

/** A name nothing else in the run carries. */
export const unique = (what: string): string => `${what} ${randomBytes(4).toString('hex')}`;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A well-formed identifier that names nothing. */
export const unknownId = (): string =>
  `01${Array.from({ length: 24 }, () => CROCKFORD.charAt(randomInt(32))).join('')}`;

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern -- a fixture that depends on nothing
  state: async ({}, use) => {
    await use(readState());
  },
  anonymous: async ({ state }, use) => {
    await use(new Api(state.surfaces.api));
  },
  owner: async ({ state }, use) => {
    await use(new Api(state.surfaces.api, await apiToken(state, state.accounts.owner)));
  },
  other: async ({ state }, use) => {
    await use(new Api(state.surfaces.api, await apiToken(state, state.accounts.other)));
  },
  admin: async ({ state }, use) => {
    await use(new Api(state.surfaces.api, await apiToken(state, state.accounts.admin)));
  },

  notebook: async ({ owner }, use) => {
    const notebook = await owner.ok<{ notebookId: string; name: string }>(
      'POST',
      '/knowledge/notebooks',
      { name: unique('Functional'), description: 'A notebook a functional case writes in.' },
    );
    const folder = await owner.ok<{ folderId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/folders`,
      { name: 'Findings', description: 'What a functional case found.' },
    );
    const note = await owner.ok<{ noteId: string }>(
      'POST',
      `/knowledge/notebooks/${notebook.notebookId}/notes`,
      {
        folderId: folder.folderId,
        content: '---\nname: First finding\n---\n\nA note a functional case wrote.\n',
      },
    );
    await use({
      notebookId: notebook.notebookId,
      name: notebook.name,
      folderId: folder.folderId,
      noteId: note.noteId,
    });
  },

  /** An account of the case's own, with no subscription, deleted afterwards. */
  newcomer: async ({ state }, use) => {
    const created = await createAccount({
      region: state.region,
      userPoolId: state.userPoolId,
      email: `functional-${state.runId}-${randomBytes(4).toString('hex')}@example.com`,
      platformAdmin: false,
    });
    const account = { ...created, subscriptionId: null };
    const api = new Api(state.surfaces.api, await apiToken(state, account));
    const session = await api.ok<{ user: { userId: string } }>('GET', '/access/session');
    try {
      await use({ account, api, userId: session.user.userId });
    } finally {
      await deleteAccount(state, account);
    }
  },
});

export { expect };
