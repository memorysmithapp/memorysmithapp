/**
 * The Guidance and the Templates written before they had a life of their own
 * (#159).
 *
 * What is proved here is what an operator cannot check by looking: that the
 * migration writes the slot the reader looks for, pointing at the content the
 * old field pointed at; that it leaves alone what is already migrated; and
 * that running it twice writes nothing the second time.
 */

import { describe, expect, it } from 'vitest';
import { SlotMigration } from '../src/adapters/inbound/slot-migration.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTEBOOK = '01JBQ2X0000000000000000001';
const FOLDER = '01JBQ2X0000000000000000002';
const PK = `S#${SUBSCRIPTION}#NOTEBOOK#${NOTEBOOK}`;

const ref = (contentId: string) => ({
  contentId,
  versionId: 'v1',
  sha256: 'a'.repeat(64),
  bytes: 120,
});

const authorship = {
  userId: '64384478-d0f1-7091-9ecc-f3ac58429bbe',
  agent: { clientId: 'https://claude.ai/mcp', clientName: 'Claude' },
  at: '2026-09-14T16:53:17.228Z',
};

/** The table, as the migration sees it: a scan, and what it writes back. */
function tableOf(items: Array<Record<string, unknown>>) {
  const written: Array<Record<string, unknown>> = [];
  const db = {
    send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      const name = command.constructor.name;
      if (name === 'ScanCommand') return { Items: items };
      if (name === 'TransactWriteCommand') {
        for (const each of (command.input['TransactItems'] ?? []) as Array<{
          Put: { Item: Record<string, unknown>; ConditionExpression?: string };
        }>) {
          expect(each.Put.ConditionExpression).toBe('attribute_not_exists(SK)');
          written.push(each.Put.Item);
        }
        return {};
      }
      throw new Error(`Unexpected command: ${name}`);
    },
  };
  return {
    migration: new SlotMigration({ db: db as never, tableName: 'mv-knowledge-test' }),
    written,
  };
}

const notebookOfTheOldShape = {
  PK,
  SK: 'META',
  entity: 'NOTEBOOK',
  notebookId: NOTEBOOK,
  name: 'Observing Log',
  guidanceRef: ref('01M2HE16A15VHDVQMW66YVSMKJ'),
  createdBy: authorship,
  updatedBy: authorship,
  updatedAt: '2026-09-14T16:53:17.228Z',
};

const folderOfTheOldShape = {
  PK,
  SK: `FOLDER#${FOLDER}`,
  entity: 'FOLDER',
  folderId: FOLDER,
  name: 'Sessions',
  templateRef: ref('01M2GDCP9TD0MTEBCDM5S5ZGV8'),
  createdBy: authorship,
  updatedBy: authorship,
  updatedAt: '2026-09-14T16:53:17.228Z',
};

describe('a notebook written before a Guidance had a life of its own', () => {
  it('says what it would write, and writes nothing until it is told to', async () => {
    const { migration, written } = tableOf([notebookOfTheOldShape, folderOfTheOldShape]);

    const report = await migration.run({ apply: false });

    expect(report).toMatchObject({ guidances: 1, templates: 1, alreadyMigrated: 0, written: 0 });
    expect(written).toEqual([]);
  });

  it('writes the slot the reader looks for, pointing at the content that was there', async () => {
    const { migration, written } = tableOf([notebookOfTheOldShape, folderOfTheOldShape]);

    await migration.run({ apply: true });

    const guidance = written.find((item) => item['SK'] === 'GUIDANCE');
    expect(guidance).toMatchObject({
      PK,
      entity: 'GUIDANCE',
      notebookId: NOTEBOOK,
      // The same content: the reference is copied, and no byte is read.
      contentRef: ref('01M2HE16A15VHDVQMW66YVSMKJ'),
      version: 1,
      // What makes a listing answer which notebooks have a Guidance.
      GSI1PK: `S#${SUBSCRIPTION}#NOTEBOOKS`,
      GSI1SK: `NBGUID#${NOTEBOOK}`,
    });
    // The authorship travels: it is whoever wrote the thing it was a field of,
    // and never this migration, which nobody asked for.
    expect(guidance?.['updatedBy']).toEqual(authorship);

    const template = written.find((item) => item['SK'] === `FTPL#${FOLDER}`);
    expect(template).toMatchObject({
      PK,
      entity: 'TEMPLATE',
      notebookId: NOTEBOOK,
      folderId: FOLDER,
      contentRef: ref('01M2GDCP9TD0MTEBCDM5S5ZGV8'),
      version: 1,
    });
    // A Template is not projected anywhere: only a Guidance answers a listing.
    expect(template?.['GSI1PK']).toBeUndefined();
  });

  it('leaves alone what already has a life of its own, and writes nothing twice', async () => {
    const { migration, written } = tableOf([
      notebookOfTheOldShape,
      folderOfTheOldShape,
      // What a write of the product left after the deploy: the live slot.
      { PK, SK: 'GUIDANCE', entity: 'GUIDANCE', notebookId: NOTEBOOK, version: 3 },
      { PK, SK: `FTPL#${FOLDER}`, entity: 'TEMPLATE', notebookId: NOTEBOOK, version: 2 },
    ]);

    const report = await migration.run({ apply: true });

    expect(report).toMatchObject({ guidances: 0, templates: 0, alreadyMigrated: 2, written: 0 });
    expect(written).toEqual([]);
  });

  it('walks past a notebook that never had either', async () => {
    const { migration, written } = tableOf([
      { PK, SK: 'META', entity: 'NOTEBOOK', notebookId: NOTEBOOK, name: 'Sem orientacao' },
      { PK, SK: `FOLDER#${FOLDER}`, entity: 'FOLDER', folderId: FOLDER, name: 'Sem modelo' },
    ]);

    const report = await migration.run({ apply: true });

    expect(report).toMatchObject({ guidances: 0, templates: 0, notebooks: 1, written: 0 });
    expect(written).toEqual([]);
  });
});
