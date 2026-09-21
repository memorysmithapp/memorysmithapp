/**
 * The numbers a folder issues (RN-KNW-043), through the use case that issues
 * them. The adapter test proves the same against the real table, with twenty
 * requests at once on one folder.
 */

import { describe, expect, it } from 'vitest';
import { FolderId, Role, SubscriptionContext } from '@memorysmith/kernel';
import { NextNumber, RestoreFolderNumber } from '../src/application/folders.js';
import {
  InMemoryDatabase,
  InMemoryFolderNumbers,
} from '../src/adapters/outbound/memory/InMemoryAdapters.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import { authorship, expectErr, notebookWithTree, otherUser, unwrap, user } from './fixtures.js';

const owner = { user, isOwner: true, role: Role.OWNER };

function subject() {
  const { notebook } = notebookWithTree();
  const context = unwrap(
    SubscriptionContext.fromClaims({
      sub: 'user-owner',
      subscription_id: notebook.subscriptionId.value,
      subscription_status: 'active',
    }),
  );
  const numbers = new InMemoryFolderNumbers(context, new InMemoryDatabase());
  const deps = {
    notebooks: { findById: async () => notebook },
    numbers,
  } as unknown as ConstructorParameters<typeof NextNumber>[0];
  const [first, second] = notebook.folders.all();
  return {
    notebook,
    numbers,
    next: new NextNumber(deps),
    restore: new RestoreFolderNumber(deps),
    first: (first as { id: FolderId }).id,
    second: (second as { id: FolderId }).id,
  };
}

const issue = (next: NextNumber, notebook: Notebook, folderId: FolderId, ctx = owner) =>
  next.execute({ ctx, notebookId: notebook.id, folderId, by: authorship() });

describe('A folder issues numbers (RN-KNW-043)', () => {
  it('answers 1, 2 and 3 on a new folder, and another folder starts at 1', async () => {
    const { notebook, next, first, second } = subject();

    expect(unwrap(await issue(next, notebook, first))).toBe(1);
    expect(unwrap(await issue(next, notebook, first))).toBe(2);
    expect(unwrap(await issue(next, notebook, first))).toBe(3);
    expect(unwrap(await issue(next, notebook, second))).toBe(1);
  });

  it('refuses a VIEWER, and the counter does not move', async () => {
    const { notebook, next, first } = subject();
    const viewer = { user: otherUser, isOwner: false, role: Role.VIEWER };

    expect(expectErr(await issue(next, notebook, first, viewer)).code).toBe('FORBIDDEN');
    expect(unwrap(await issue(next, notebook, first))).toBe(1);
  });

  it('answers not found for a folder the notebook does not hold', async () => {
    const { notebook, next } = subject();
    expect(expectErr(await issue(next, notebook, FolderId.generate())).code).toBe('NOT_FOUND');
  });

  it('restores the last number an import carries, and never brings a counter down', async () => {
    const { notebook, next, restore, first } = subject();
    const restoring = (lastNumber: number) =>
      restore.execute({
        ctx: owner,
        notebookId: notebook.id,
        folderId: first,
        lastNumber,
        by: authorship(),
      });

    unwrap(await restoring(42));
    expect(unwrap(await issue(next, notebook, first))).toBe(43);
    unwrap(await restoring(10));
    expect(unwrap(await issue(next, notebook, first))).toBe(44);
  });
});
