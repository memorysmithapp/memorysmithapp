/**
 * The write side of an import (#381): the files of an archive come back through
 * the door an upload uses, with the ceiling of a file sent in parts. The 4 MB
 * of `keep_file` is the ceiling of a request, and an archive's bytes never
 * travel in one.
 */

import { describe, expect, it } from 'vitest';
import { Authorship, ok, UserId } from '@memorysmithapp/kernel';

const owner = UserId.create('user-owner');
if (!owner.ok) throw new Error('A fixed id is a user id');
import {
  MAX_ASSEMBLED_BYTES,
  MAX_INLINE_BYTES,
  type KeepFile,
} from '@memorysmithapp/svc-knowledge/application/files';
import type { ContentStore, RequestContext } from '@memorysmithapp/svc-knowledge/domain';
import { KnowledgeNotebookWriter, type KnowledgeWriteUseCases } from '../src/import-writer.js';

describe('the files an import keeps (#381)', () => {
  it('are kept up to the ceiling of a file sent in parts, not the 4 MB of a request', async () => {
    const asked: Array<Parameters<KeepFile['execute']>[0]> = [];
    const keepFile = {
      execute: async (input: Parameters<KeepFile['execute']>[0]) => {
        asked.push(input);
        return ok(undefined as never);
      },
    } as unknown as KeepFile;
    const writer = new KnowledgeNotebookWriter(
      { keepFile } as unknown as KnowledgeWriteUseCases,
      {} as RequestContext,
      'sub' as never,
      {} as ContentStore,
    );

    const kept = await writer.keepFile({
      notebookId: '01M6H8KYBNJZRK9SX39AD47WC0',
      name: 'foto grande',
      description: '',
      mimeType: 'image/png',
      tags: [],
      path: '',
      bytes: new Uint8Array(8),
      by: Authorship.byHuman(owner.value),
    });

    expect(kept.ok).toBe(true);
    expect(asked[0]?.maxBytes).toBe(MAX_ASSEMBLED_BYTES);
    expect(MAX_ASSEMBLED_BYTES).toBeGreaterThan(MAX_INLINE_BYTES);
  });
});
