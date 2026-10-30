/**
 * Every Knowledge use case authorizes ONE action, and the action is the one
 * its kind of change calls for (#346): a share may grant writing content
 * without maintaining the notebook, so the split is a rule, not a naming.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APPLICATION = join(import.meta.dirname, '..', 'src', 'application');

const EXPECTED: Record<string, readonly string[]> = {
  GetNotebook: ['read'],
  GetNotebookContext: ['read'],
  ListNotes: ['read'],
  ReadNote: ['read'],
  GetTemplate: ['read'],
  ListFiles: ['read'],
  LinkToFile: ['read'],
  CreateNote: ['write-content'],
  UpdateNote: ['write-content'],
  ReorderNote: ['write-content'],
  MoveNote: ['write-content', 'write-content'],
  DeleteNote: ['write-content'],
  NextNumber: ['write-content'],
  KeepFile: ['write-content'],
  CheckFileDestination: ['write-content'],
  KeepAssembledFile: ['write-content'],
  DeleteFile: ['write-content'],
  CreateFolder: ['maintain'],
  PatchFolder: ['maintain'],
  ReorderFolder: ['maintain'],
  RemoveFolder: ['maintain'],
  PutTemplate: ['maintain'],
  DeleteTemplate: ['maintain'],
  RestoreFolderNumber: ['maintain'],
  PutGuidance: ['maintain'],
  DeleteGuidance: ['maintain'],
  RenameNotebook: ['administer'],
  DeleteNotebook: ['administer'],
  SetNotebookRoleLimit: ['administer'],
  ClearNotebookRoleLimit: ['administer'],
};

function actionsByUseCase(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const file of ['notebooks.ts', 'folders.ts', 'notes.ts', 'files.ts']) {
    const source = readFileSync(join(APPLICATION, file), 'utf8');
    for (const part of source.split(/^export class /m).slice(1)) {
      const name = part.slice(0, part.search(/[\s<{]/));
      const actions = [...part.matchAll(/loadAuthorized\([^)]*'([a-z-]+)'\)/g)].map((m) => m[1]!);
      if (actions.length) found[name] = actions;
    }
  }
  return found;
}

describe('the action each use case authorizes', () => {
  it('is exactly the one its kind of change calls for', () => {
    expect(actionsByUseCase()).toEqual(EXPECTED);
  });
});
