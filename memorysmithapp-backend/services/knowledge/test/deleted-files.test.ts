/**
 * The tombstones of files are handed over as the deletion would have (#372).
 */

import { describe, expect, it } from 'vitest';
import { deletedFiles } from '../src/adapters/inbound/deleted-files.js';

const SUBSCRIPTION = '01J00000000000000000000001';
const NOTEBOOK = '01J00000000000000000000002';
const BY = { userId: 'user-owner', at: '2026-09-16T00:00:00.000Z' };
const REF = { contentId: 'content', versionId: 'v1', sha256: 'hash', bytes: 3000 };

describe('the files deleted before the purge heard of them', () => {
  it('are read page by page, each as the envelope of its deletion', async () => {
    const asked: Array<Record<string, unknown>> = [];
    const pages = [
      {
        Items: [
          {
            PK: `S#${SUBSCRIPTION}#NOTEBOOK#${NOTEBOOK}`,
            fileId: 'file-1',
            notebookId: NOTEBOOK,
            contentRef: REF,
            updatedBy: BY,
          },
        ],
        LastEvaluatedKey: { PK: 'next' },
      },
      { Items: [] },
    ];
    const db = {
      send: async (command: { input: Record<string, unknown> }) => {
        asked.push(command.input);
        return pages.shift();
      },
    };

    const found = await deletedFiles({ db: db as never, tableName: 'mv-knowledge-test' });

    expect(found).toEqual([
      {
        type: 'FileDeleted',
        subscriptionId: SUBSCRIPTION,
        authorship: BY,
        contentRef: REF,
        payload: { notebookId: NOTEBOOK, fileId: 'file-1' },
      },
    ]);
    expect(asked[0]?.['FilterExpression']).toContain('attribute_exists(deletedAt)');
    expect(asked[1]?.['ExclusiveStartKey']).toEqual({ PK: 'next' });
  });
});
