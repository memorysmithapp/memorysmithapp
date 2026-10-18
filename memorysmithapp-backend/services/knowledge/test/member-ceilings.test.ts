/**
 * Removing a member clears their ceiling in every notebook (RN-ACC-014, #332),
 * and leaves every other ceiling and every notebook without one alone.
 */

import { describe, expect, it } from 'vitest';
import { NotebookRoleLimit, ok } from '@memorysmithapp/kernel';
import { ClearMemberCeilings } from '../src/application/notebooks.js';
import type { Notebook } from '../src/domain/notebook/Notebook.js';
import type { NotebookRepository } from '../src/domain/ports/index.js';
import { authorship, newNotebook, otherUser, unwrap, user } from './fixtures.js';

function repositoryOf(notebooks: Notebook[]) {
  const saved: Notebook[] = [];
  const repository: Pick<NotebookRepository, 'listAll' | 'findById' | 'save'> = {
    listAll: async () => notebooks,
    findById: async (id) => notebooks.find((notebook) => notebook.id.equals(id)) ?? null,
    save: async (notebook) => {
      saved.push(notebook);
      return ok();
    },
  };
  return { repository: repository as NotebookRepository, saved };
}

describe('ClearMemberCeilings', () => {
  it('clears the ceiling of the member in every notebook that holds one, and saves only those', async () => {
    const limited = newNotebook('Normas');
    const alsoLimited = newNotebook('Achados');
    const untouched = newNotebook('Rascunhos');
    unwrap(limited.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));
    unwrap(alsoLimited.setRoleLimit(otherUser, NotebookRoleLimit.VIEWER, authorship()));
    unwrap(alsoLimited.setRoleLimit(user, NotebookRoleLimit.VIEWER, authorship()));
    const { repository, saved } = repositoryOf([limited, alsoLimited, untouched]);

    unwrap(
      await new ClearMemberCeilings({ notebooks: repository }).execute({
        userId: otherUser,
        by: authorship(),
      }),
    );

    expect(limited.hasLimitFor(otherUser)).toBe(false);
    expect(alsoLimited.hasLimitFor(otherUser)).toBe(false);
    expect(alsoLimited.hasLimitFor(user)).toBe(true);
    expect(saved).toEqual([limited, alsoLimited]);
  });
});
