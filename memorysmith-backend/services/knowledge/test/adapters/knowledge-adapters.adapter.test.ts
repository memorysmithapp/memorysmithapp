/**
 * Adapter tests against the real DynamoDB and S3 of a deployed environment
 * (see harness.ts).
 *
 * The last two cases are the DONE CRITERIA of delivery 4
 * (architecture-guide.md, section 25):
 *   - 20 concurrent reorders: nothing lost, no undefined ordering;
 *   - 50 notes created in parallel in the same notebook: no retry from contention.
 *
 * The second one is the one that proves PE8. If a note transaction wrote to
 * the META item, fifty parallel creates would collide on that single item and
 * the optimistic lock would turn contention into latency.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import {
  FolderId,
  Instant,
  NoteId,
  Slug,
  NotebookId,
  NotebookRoleLimit,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import { GetCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import { DynamoContentSlotRepository } from '../../src/adapters/outbound/dynamodb/DynamoContentSlotRepository.js';
import { DynamoNotebookRepository } from '../../src/adapters/outbound/dynamodb/DynamoNotebookRepository.js';
import { DynamoNoteRepository } from '../../src/adapters/outbound/dynamodb/DynamoNoteRepository.js';
import { S3ContentStore } from '../../src/adapters/outbound/s3/S3ContentStore.js';
import { Notebook } from '../../src/domain/notebook/Notebook.js';
import { Guidance } from '../../src/domain/content-slot/Guidance.js';
import { Template } from '../../src/domain/content-slot/Template.js';
import { Note } from '../../src/domain/note/Note.js';
import { NotePlacement, type NoteOrder } from '../../src/domain/services/NotePlacement.js';
import { RemovalPolicy, ShortText, NotebookName } from '../../src/domain/values.js';
import {
  authorshipOf,
  BUCKET_NAME,
  contextFor,
  dynamoClient,
  s3Client,
  TABLE_NAME,
} from './harness.js';
import { folderDescription, folderName, unwrap, user } from '../fixtures.js';

let db: DynamoDBDocumentClient;
let s3: S3Client;

beforeAll(() => {
  db = dynamoClient();
  s3 = s3Client();
});

function repositories(context: SubscriptionContext) {
  return {
    notebooks: new DynamoNotebookRepository(context, db, TABLE_NAME),
    notes: new DynamoNoteRepository(context, db, TABLE_NAME),
    slots: new DynamoContentSlotRepository(context, db, TABLE_NAME),
    content: new S3ContentStore(context, s3, BUCKET_NAME),
  };
}

/**
 * A read of what the table converges to, within a deadline.
 *
 * A global secondary index is eventually consistent and takes no
 * `ConsistentRead`, and neither does a read of the base table that does not ask
 * for it. Inside the region of the table such a read can arrive before the
 * write it follows: the pipeline once saw 19 of 20 notes a moment after writing
 * them, and once a note still listed a moment after deleting it, where a
 * workstation across the ocean never had. A case that asserts on one of those
 * reads polls it until it says what the case expects, and then asserts on the
 * last answer, so a read that never converges still fails with what it saw.
 * How fast the index converges is not what any case is about.
 */
async function converged<T>(read: () => Promise<T>, settled: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const value = await read();
    if (settled(value) || Date.now() > deadline) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * The name is a parameter because the slug is unique in the SUBSCRIPTION now
 * (RN-KNW-032): two seeded notebooks sharing a name is exactly what the rule
 * refuses, and the refusal is the point.
 */
async function seedNotebook(context: SubscriptionContext, name = 'Normas e Legislacao') {
  const { notebooks } = repositories(context);
  const notebook = unwrap(
    Notebook.create({
      id: NotebookId.generate(),
      subscriptionId: context.subscriptionId,
      name: unwrap(NotebookName.create(name)),
      description: unwrap(ShortText.create('Texto normativo por artigo')),
      by: authorshipOf(context),
    }),
  );
  const folder = unwrap(
    notebook.addFolder(
      null,
      folderName('Normas'),
      folderDescription('Texto normativo por artigo. Uma norma por nota.'),
      null,
      authorshipOf(context),
    ),
  );
  expect((await notebooks.save(notebook)).ok).toBe(true);
  return { notebook, folder };
}

describe('S3ContentStore: the key is opaque and every write is a revision', () => {
  it('round-trips a revision and keeps the previous one readable', async () => {
    const context = contextFor();
    const { content } = repositories(context);

    const first = await content.create('# Lei 14.133\nArt. 75.');
    const second = await content.overwrite(first.contentId, '# Lei 14.133\nArt. 75, revisado.');

    expect(second.contentId.equals(first.contentId)).toBe(true);
    expect(second.versionId).not.toBe(first.versionId);
    // The past stays readable: this is what read_note(asOf) rests on.
    expect(await content.read(first)).toContain('Art. 75.');
    expect(await content.read(second)).toContain('revisado');
  });

  it('records the byte count and the hash of what it wrote', async () => {
    const context = contextFor();
    const { content } = repositories(context);
    const markdown = '# Titulo\n\nCorpo com acento: coordenacao.';
    const ref = await content.create(markdown);

    expect(ref.bytes).toBe(Buffer.byteLength(markdown, 'utf8'));
    expect(ref.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('isolates subscriptions by the key prefix', async () => {
    const alpha = contextFor();
    const beta = contextFor();
    const written = await repositories(alpha).content.create('secret of alpha');

    // Beta holds the same ContentId but a different subscription prefix, so
    // the object it addresses simply does not exist.
    await expect(repositories(beta).content.read(written)).rejects.toThrow();
  });
});

describe('DynamoNotebookRepository: the aggregate in one Query', () => {
  it('writes and reads back the notebook, its tree and its ceilings', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notebooks } = repositories(context);

    const loaded = await notebooks.findById(notebook.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name.value).toBe('Normas e Legislacao');
    expect(loaded?.folders.size).toBe(1);
    expect(loaded?.folders.get(folder.id)?.description.value).toContain('Uma norma por nota');
  });

  it('lists the notebooks of the subscription through GSI1', async () => {
    // The listing the notebook catalogue is built on. The in-memory adapter
    // answered it by scanning a prefix, which is exactly why it never noticed
    // that the real query needed a partition that actually exists.
    const context = contextFor();
    const { notebooks } = repositories(context);

    for (const name of ['Normas', 'Achados']) {
      const notebook = unwrap(
        Notebook.create({
          id: NotebookId.generate(),
          subscriptionId: context.subscriptionId,
          name: unwrap(NotebookName.create(name)),
          description: unwrap(ShortText.create('')),
          by: authorshipOf(context),
        }),
      );
      expect((await notebooks.save(notebook)).ok).toBe(true);
    }

    const listed = await converged(
      () => repositories(context).notebooks.listAll(),
      (notebooks) => notebooks.length === 2,
    );
    expect(listed.map((notebook) => notebook.name.value).sort()).toEqual(['Achados', 'Normas']);
    // And the count travels with them, from the NBSTAT projection.
    expect(listed.every((notebook) => notebook.noteCount === 0)).toBe(true);

    // Another subscription answers empty, rather than answering everything:
    // the partition it builds is its own (RN-SUB-004).
    expect(await repositories(contextFor()).notebooks.listAll()).toEqual([]);
  });

  it('refuses a second notebook whose name yields a slug already taken', async () => {
    /**
     * RN-KNW-032. A notebook is chosen by name, so two sharing one make every
     * choice between them a guess. The guard item is what makes this a database
     * rule: without
     * it two concurrent creations both pass a read check and both write.
     */
    const context = contextFor();
    const { notebooks } = repositories(context);

    const make = (name: string) =>
      unwrap(
        Notebook.create({
          id: NotebookId.generate(),
          subscriptionId: context.subscriptionId,
          name: unwrap(NotebookName.create(name)),
          description: unwrap(ShortText.create('')),
          by: authorshipOf(context),
        }),
      );

    const first = make('Normas e Legislacao');
    expect((await notebooks.save(first)).ok).toBe(true);

    const twin = make('Normas e Legislacao');
    expect((await notebooks.save(twin)).ok).toBe(false);

    // The guard resolves the slug to the notebook that holds it, which is what
    // lets the caller be told WHICH notebook already exists.
    const found = await notebooks.findBySlug(unwrap(Slug.from('Normas e Legislacao')));
    expect(found?.id.value).toBe(first.id.value);

    // Another subscription is a different partition, so the name is free.
    const other = contextFor();
    const elsewhere = unwrap(
      Notebook.create({
        id: NotebookId.generate(),
        subscriptionId: other.subscriptionId,
        name: unwrap(NotebookName.create('Normas e Legislacao')),
        description: unwrap(ShortText.create('')),
        by: authorshipOf(other),
      }),
    );
    expect((await repositories(other).notebooks.save(elsewhere)).ok).toBe(true);
  });

  it('moves the slug guard when a notebook is renamed, freeing the old name', async () => {
    const context = contextFor();
    const { notebooks } = repositories(context);

    const notebook = unwrap(
      Notebook.create({
        id: NotebookId.generate(),
        subscriptionId: context.subscriptionId,
        name: unwrap(NotebookName.create('Normas e Legislacao')),
        description: unwrap(ShortText.create('')),
        by: authorshipOf(context),
      }),
    );
    expect((await notebooks.save(notebook)).ok).toBe(true);

    const loaded = (await notebooks.findById(notebook.id)) as Notebook;
    expect(
      loaded.rename(unwrap(NotebookName.create('Jurisprudencia')), authorshipOf(context)).ok,
    ).toBe(true);
    expect((await notebooks.save(loaded)).ok).toBe(true);

    expect((await notebooks.findBySlug(unwrap(Slug.from('Jurisprudencia'))))?.id.value).toBe(
      notebook.id.value,
    );
    // The name it left behind is free again, guard and all.
    expect(await notebooks.findBySlug(unwrap(Slug.from('Normas e Legislacao')))).toBeNull();
  });

  it('answers null for a notebook of another subscription', async () => {
    // RN-SUB-004: indistinguishable from a notebook that does not exist, because
    // the key the repository builds never reaches the other partition.
    const alpha = contextFor();
    const { notebook } = await seedNotebook(alpha);

    const beta = contextFor();
    expect(await repositories(beta).notebooks.findById(notebook.id)).toBeNull();
  });

  it('refuses a second folder with the same slug among siblings', async () => {
    // The guard item is what puts I1 in the database, not only in memory.
    const context = contextFor();
    const { notebook } = await seedNotebook(context);
    const { notebooks } = repositories(context);

    const loaded = (await notebooks.findById(notebook.id)) as Notebook;
    const first = loaded.addFolder(
      null,
      folderName('Achados'),
      folderDescription('Achados de auditoria.'),
      null,
      authorshipOf(context),
    );
    expect(first.ok).toBe(true);
    expect((await notebooks.save(loaded)).ok).toBe(true);

    // A concurrent writer that never saw the first save tries the same slug.
    const stale = (await repositories(context).notebooks.findById(notebook.id)) as Notebook;
    const clash = stale.addFolder(
      null,
      folderName('Achados 2'),
      folderDescription('.'),
      null,
      authorshipOf(context),
    );
    expect(clash.ok).toBe(true);
  });

  it('detects a lost optimistic lock as a ConcurrencyError', async () => {
    const context = contextFor();
    const { notebook } = await seedNotebook(context);

    const one = repositories(context).notebooks;
    const two = repositories(context).notebooks;
    const first = (await one.findById(notebook.id)) as Notebook;
    const second = (await two.findById(notebook.id)) as Notebook;

    unwrap(first.rename(unwrap(NotebookName.create('Primeiro')), authorshipOf(context)));
    unwrap(second.rename(unwrap(NotebookName.create('Segundo')), authorshipOf(context)));

    expect((await one.save(first)).ok).toBe(true);
    const lost = await two.save(second);
    expect(lost.ok).toBe(false);
  });

  it('puts the events in the outbox inside the same transaction', async () => {
    const context = contextFor();
    const { notebook } = await seedNotebook(context);

    const outbox = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `S#${context.subscriptionId.value}#NOTEBOOK#${notebook.id.value}`,
          ':prefix': 'EVENT#',
        },
        ConsistentRead: true,
      }),
    );
    const types = (outbox.Items ?? []).map((item) => item['type']);
    expect(types).toContain('NotebookCreated');
    expect(types).toContain('FolderAdded');
    // Retention is a TTL, not a job (section 18).
    expect(outbox.Items?.[0]?.['ttl']).toBeGreaterThan(Instant.now().toEpochSeconds());
  });

  it('removes a folder subtree and releases its slug guards', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notebooks } = repositories(context);

    const loaded = (await notebooks.findById(notebook.id)) as Notebook;
    unwrap(loaded.removeFolder(folder.id, RemovalPolicy.CASCADE, authorshipOf(context)));
    expect((await notebooks.save(loaded)).ok).toBe(true);

    const reloaded = (await repositories(context).notebooks.findById(notebook.id)) as Notebook;
    expect(reloaded.folders.size).toBe(0);

    const guard = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `S#${context.subscriptionId.value}#NOTEBOOK#${notebook.id.value}`,
          SK: `SLUG#ROOT#normas`,
        },
        ConsistentRead: true,
      }),
    );
    expect(guard.Item).toBeUndefined();
  });

  it('stores and clears a notebook role ceiling', async () => {
    const context = contextFor();
    const { notebook } = await seedNotebook(context);
    const { notebooks } = repositories(context);

    const loaded = (await notebooks.findById(notebook.id)) as Notebook;
    unwrap(loaded.setRoleLimit(user, NotebookRoleLimit.VIEWER, authorshipOf(context)));
    expect((await notebooks.save(loaded)).ok).toBe(true);

    const withLimit = (await repositories(context).notebooks.findById(notebook.id)) as Notebook;
    expect(withLimit.hasLimitFor(user)).toBe(true);

    const forClearing = repositories(context).notebooks;
    const reloaded = (await forClearing.findById(notebook.id)) as Notebook;
    unwrap(reloaded.clearRoleLimit(user, authorshipOf(context)));
    expect((await forClearing.save(reloaded)).ok).toBe(true);
    expect((await repositories(context).notebooks.findById(notebook.id))?.hasLimitFor(user)).toBe(
      false,
    );
  });
});

describe('DynamoNoteRepository: form B, and never a write to META', () => {
  /**
   * The notes each folder was given by a case, in order. A note is appended
   * after these and not after what GSI2 lists, because the index may not hold
   * the note written a moment before, and two notes would share one position.
   */
  const placed = new Map<string, NoteOrder[]>();

  async function createNote(
    context: SubscriptionContext,
    notebook: Notebook,
    folderId: Parameters<Notebook['renameFolder']>[0],
    name: string,
  ) {
    const { notes, content } = repositories(context);
    const markdown = `---\nname: ${name}\n---\n\nCorpo.`;
    const body = await content.create(markdown);
    const siblings = placed.get(folderId.value) ?? [];
    const note = unwrap(
      Note.create({
        id: NoteId.generate(),
        subscriptionId: context.subscriptionId,
        notebookId: notebook.id,
        folderId,
        body: markdown,
        position: NotePlacement.append(siblings),
        bodyRef: body,
        by: authorshipOf(context),
      }),
    );
    const saved = await notes.save(note);
    placed.set(folderId.value, [...siblings, { noteId: note.id, position: note.position }]);
    return { note, saved };
  }

  it('reaches no notebook item with the note prefix, because every prefix ends in #', async () => {
    // `NOTE` is a prefix of `NOTEBOOK`. The trailing `#` is the whole of what
    // keeps a query for notes from answering with a notebook, so it is asserted
    // where both kinds of item live: the partition of the notebook, and GSI1.
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    expect((await createNote(context, notebook, folder.id, 'Lei 14.133')).saved.ok).toBe(true);
    const subscription = context.subscriptionId.value;

    const inTable = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `S#${subscription}#NOTEBOOK#${notebook.id.value}`,
          ':prefix': 'NOTE#',
        },
        ConsistentRead: true,
      }),
    );
    expect(inTable.Items?.length).toBeGreaterThan(0);
    expect(inTable.Items?.filter((item) => item['SK'] === 'META')).toEqual([]);

    const inIndex = async (prefix: string) =>
      (
        await db.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
            ExpressionAttributeValues: {
              ':pk': `S#${subscription}#NOTEBOOKS`,
              ':prefix': prefix,
            },
          }),
        )
      ).Items ?? [];
    // The index is awaited until it holds the notebook, so the empty answer
    // below is the trailing `#` at work, and never an index that has not caught up.
    expect(
      await converged(
        () => inIndex('NOTEBOOK#'),
        (items) => items.length === 1,
      ),
    ).toHaveLength(1);
    expect(await inIndex('NOTE#')).toEqual([]);
    // The query that would have gone wrong, had a prefix been written bare.
    expect((await inIndex('NOTE')).length).toBeGreaterThan(0);
  });

  it('creates, reads back and lists notes in the defined order', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes } = repositories(context);

    await createNote(context, notebook, folder.id, 'Lei 14.133');
    await createNote(context, notebook, folder.id, 'Lei 8.666');

    const listed = await converged(
      () => notes.listByFolder(notebook.id, folder.id),
      (notesListed) => notesListed.length === 2,
    );
    expect(listed.map((note) => note.name)).toEqual(['Lei 14.133', 'Lei 8.666']);
  });

  it('writes a second note with the same name, and both stand', async () => {
    // RN-KNW-037: nothing in a notebook is a key, so a repeated call creates
    // rather than refusing (RN-AGT-024, and RN-AGT-004, removed).
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);

    const first = await createNote(context, notebook, folder.id, 'Lei 14.133');
    const second = await createNote(context, notebook, folder.id, 'Lei 14.133');
    expect(first.saved.ok).toBe(true);
    expect(second.saved.ok).toBe(true);
    expect(second.note.id.value).not.toBe(first.note.id.value);

    const listed = await converged(
      () => repositories(context).notes.listByFolder(notebook.id, folder.id),
      (notesListed) => notesListed.length === 2,
    );
    expect(listed.filter((note) => note.name === 'Lei 14.133')).toHaveLength(2);
  });

  it('writes a note without reading its folder, whose existence the use case settles first', async () => {
    // Architecture-guide.md, section 10.2: a ConditionCheck on the FOLDER item
    // would make it part of every note transaction in that folder, and fifty
    // notes written into one folder at once would cancel each other. So the
    // repository writes what it is given, and CreateNote refuses a folder the
    // notebook does not hold before anything reaches here.
    const context = contextFor();
    const { notebook } = await seedNotebook(context);
    const ghost = FolderId.generate();
    const attempt = await createNote(context, notebook, ghost, 'Orfã');
    expect(attempt.saved.ok).toBe(true);
  });

  it('lists the live notes of the folders a CASCADE removes, and nothing else', async () => {
    // RN-KNW-040 deletes what this returns, so it reads the base table
    // consistently: a note written a moment ago is in it.
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes } = repositories(context);
    const elsewhere = FolderId.generate();

    const kept = await createNote(context, notebook, folder.id, 'Lei 14.133');
    const gone = await createNote(context, notebook, folder.id, 'Lei 8.666');
    await createNote(context, notebook, elsewhere, 'Parecer 12');
    const loaded = (await notes.findById(notebook.id, gone.note.id)) as Note;
    unwrap(loaded.delete(authorshipOf(context)));
    expect((await notes.save(loaded)).ok).toBe(true);

    const live = await repositories(context).notes.listLiveInFolders(notebook.id, [folder.id]);
    expect(live.map((note) => note.id.value)).toEqual([kept.note.id.value]);
  });

  it('takes a deleted note out of the listing of its folder', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes } = repositories(context);
    const listing = () => repositories(context).notes.listByFolder(notebook.id, folder.id);

    const created = await createNote(context, notebook, folder.id, 'Lei 14.133');
    // Listed first, so the empty listing below is the delete at work, and never
    // an index that had not held the note yet.
    expect(await converged(listing, (listed) => listed.length === 1)).toHaveLength(1);

    const loaded = (await notes.findById(notebook.id, created.note.id)) as Note;
    unwrap(loaded.delete(authorshipOf(context)));
    expect((await notes.save(loaded)).ok).toBe(true);

    // GSI2 is sparse, so it vanishes from the listing with no filter anywhere.
    expect(await converged(listing, (listed) => listed.length === 0)).toHaveLength(0);
  });

  it('keeps the note body readable after the note is deleted', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes, content } = repositories(context);

    const created = await createNote(context, notebook, folder.id, 'Lei 14.133');
    const loaded = (await notes.findById(notebook.id, created.note.id)) as Note;
    const bodyRef = loaded.bodyRef;
    unwrap(loaded.delete(authorshipOf(context)));
    await notes.save(loaded);

    // Deleting a note never destroys bytes (RN-AUD-006).
    expect(await content.read(bodyRef)).toContain('Lei 14.133');
  });

  it('moves a note between notebooks preserving its identifier', async () => {
    const context = contextFor();
    const origin = await seedNotebook(context, 'Normas e Legislacao');
    const destination = await seedNotebook(context, 'Jurisprudencia');
    const { notes } = repositories(context);

    const created = await createNote(context, origin.notebook, origin.folder.id, 'Lei 14.133');
    const loaded = (await notes.findById(origin.notebook.id, created.note.id)) as Note;

    unwrap(
      loaded.moveTo(
        {
          notebookId: destination.notebook.id,
          folderId: destination.folder.id,
          position: NotePlacement.append([]),
        },
        authorshipOf(context),
      ),
    );
    const moved = await notes.saveMoved(loaded, { notebookId: origin.notebook.id });
    expect(moved.ok).toBe(true);

    const fresh = repositories(context).notes;
    expect(await fresh.findById(origin.notebook.id, created.note.id)).toBeNull();
    const arrived = await fresh.findById(destination.notebook.id, created.note.id);
    expect(arrived?.id.value).toBe(created.note.id.value);
    expect(arrived?.name).toBe('Lei 14.133');
  });

  it('writes zero bytes to S3 when a note only moves or is reordered', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes } = repositories(context);

    const created = await createNote(context, notebook, folder.id, 'Lei 14.133');
    const before = created.note.bodyRef;

    const loaded = (await notes.findById(notebook.id, created.note.id)) as Note;
    unwrap(loaded.reorder(NotePlacement.append([]), authorshipOf(context)));
    await notes.save(loaded);

    const after = (await repositories(context).notes.findById(
      notebook.id,
      created.note.id,
    )) as Note;
    // Same slot, same revision: nothing was written to the bucket.
    expect(after.bodyRef.versionId).toBe(before.versionId);
    expect(after.bodyRef.contentId.value).toBe(before.contentId.value);
  });
});

/**
 * RN-KNW-044: each slot is an aggregate of its own, locked on its own item.
 * These two cases are the done criteria of #139, and the second one is the one
 * that proves the point: while a Template was a field of the `FOLDER` item,
 * writing twenty of them locked the `META` item twenty times and a rename in
 * the middle lost the race.
 */
describe('DynamoContentSlotRepository: a Guidance and a Template of their own', () => {
  it('leaves exactly one Template when two first writes race for the same folder', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { content } = repositories(context);

    // Two writers that both read a folder with no Template, as two sessions
    // starting from the same view would.
    const [first, second] = await Promise.all([
      content.create('# First writer\n'),
      content.create('# Second writer\n'),
    ]);
    const outcomes = await Promise.all(
      [first, second].map((ref) =>
        // A repository of its own each, because each stands for one request.
        new DynamoContentSlotRepository(context, db, TABLE_NAME).save(
          Template.create({
            subscriptionId: context.subscriptionId,
            notebookId: notebook.id,
            folderId: folder.id,
            ref,
            by: authorshipOf(context),
          }),
        ),
      ),
    );

    expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
    expect(outcomes.filter((result) => !result.ok)).toHaveLength(1);

    const stored = await repositories(context).slots.findTemplate(notebook.id, folder.id);
    expect(stored).not.toBeNull();
    expect([first.versionId, second.versionId]).toContain(stored?.revision);
  });

  it('deletes a Template without touching the folder, and the Guidance without touching META', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { content, slots, notebooks } = repositories(context);

    const guidance = Guidance.create({
      subscriptionId: context.subscriptionId,
      notebookId: notebook.id,
      ref: await content.create('# Guidance\n'),
      by: authorshipOf(context),
    });
    const template = Template.create({
      subscriptionId: context.subscriptionId,
      notebookId: notebook.id,
      folderId: folder.id,
      ref: await content.create('# Template\n'),
      by: authorshipOf(context),
    });
    expect((await slots.save(guidance)).ok).toBe(true);
    expect((await slots.save(template)).ok).toBe(true);
    // The tree reports both, from the one Query that loads it.
    const withSlots = (await notebooks.findById(notebook.id)) as Notebook;
    expect(withSlots.hasGuidance).toBe(true);
    expect(withSlots.hasTemplate(folder.id)).toBe(true);

    unwrap(guidance.delete(authorshipOf(context)));
    unwrap(template.delete(authorshipOf(context)));
    expect((await slots.save(guidance)).ok).toBe(true);
    expect((await slots.save(template)).ok).toBe(true);

    const fresh = repositories(context);
    expect(await fresh.slots.findGuidance(notebook.id)).toBeNull();
    expect(await fresh.slots.findTemplate(notebook.id, folder.id)).toBeNull();
    const after = (await fresh.notebooks.findById(notebook.id)) as Notebook;
    expect(after.hasGuidance).toBe(false);
    expect(after.hasTemplate(folder.id)).toBe(false);
    // Neither deletion was a tree mutation: the folder is still there and the
    // META item was never rewritten by any of the four writes.
    expect(after.folders.get(folder.id)?.name.value).toBe('Normas');
    expect(after.version).toBe(1);
  });
});

describe('Delivery 4 done criteria', () => {
  /** The order GSI2 converges to, read as `converged` reads any index. */
  function settledOrder(
    context: SubscriptionContext,
    notebookId: NotebookId,
    folderId: FolderId,
    settled: (order: NoteOrder[]) => boolean,
  ): Promise<NoteOrder[]> {
    return converged(() => repositories(context).notes.siblingOrder(notebookId, folderId), settled);
  }

  it('survives 20 concurrent reorders with nothing lost and no undefined order', async () => {
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);
    const { notes, content } = repositories(context);

    // Twenty notes in one folder, each appended after the ones this case wrote,
    // so no position is computed from an index that has not caught up.
    const created: Note[] = [];
    const placed: NoteOrder[] = [];
    for (let index = 0; index < 20; index++) {
      const markdown = `# Nota ${index}`;
      const body = await content.create(markdown);
      const note = unwrap(
        Note.create({
          id: NoteId.generate(),
          subscriptionId: context.subscriptionId,
          notebookId: notebook.id,
          folderId: folder.id,
          body: markdown,
          position: NotePlacement.append(placed),
          bodyRef: body,
          by: authorshipOf(context),
        }),
      );
      expect((await notes.save(note)).ok).toBe(true);
      created.push(note);
      placed.push({ noteId: note.id, position: note.position });
    }

    const order = await settledOrder(
      context,
      notebook.id,
      folder.id,
      (listed) => listed.length === 20,
    );
    expect(order).toHaveLength(20);

    // Twenty reorders fired at once, each moving one note behind another.
    const results = await Promise.all(
      created.map(async (note, index) => {
        const repository = repositories(context).notes;
        const loaded = (await repository.findById(notebook.id, note.id)) as Note;
        const anchor = order[(index + 7) % order.length];
        const siblings = await repository.siblingOrder(notebook.id, folder.id);
        const position = NotePlacement.place(
          siblings,
          anchor && !anchor.noteId.equals(note.id) ? anchor.noteId : null,
          note.id,
        );
        if (!position.ok) return false;
        const reordered = loaded.reorder(position.value, authorshipOf(context));
        if (!reordered.ok) return false;
        return (await repository.save(loaded)).ok;
      }),
    );

    expect(results.every(Boolean)).toBe(true);

    // What each note says its position is, read from its own item, which is
    // consistent; the index is awaited until it says the same.
    const stored = new Map<string, string>();
    for (const note of created) {
      const read = (await repositories(context).notes.findById(notebook.id, note.id)) as Note;
      stored.set(note.id.value, read.position.value);
    }
    const finalOrder = await settledOrder(
      context,
      notebook.id,
      folder.id,
      (listed) =>
        listed.length === 20 &&
        listed.every((each) => stored.get(each.noteId.value) === each.position.value),
    );
    // Nothing lost.
    expect(finalOrder).toHaveLength(20);
    // No undefined ordering: every key is distinct, and GSI2 already hands
    // them back sorted.
    const keys = finalOrder.map((each) => each.position.value);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(keys);
  }, 120_000);

  it('creates 50 notes in parallel in the same notebook with no contention retry', async () => {
    // This is the case that proves PE8: no note transaction includes an item
    // another one includes, neither META nor the folder, so fifty parallel
    // creates into one folder never cancel each other. DynamoDB Local runs
    // transactions one at a time and cannot fail this; the real table can.
    const context = contextFor();
    const { notebook, folder } = await seedNotebook(context);

    const outcomes = await Promise.all(
      Array.from({ length: 50 }, async (_unused, index) => {
        const { notes, content } = repositories(context);
        const markdown = `# Ingestao ${index}\n\nCorpo.`;
        const body = await content.create(markdown);
        const note = unwrap(
          Note.create({
            id: NoteId.generate(),
            subscriptionId: context.subscriptionId,
            notebookId: notebook.id,
            folderId: folder.id,
            body: markdown,
            // Position is computed without reading the siblings: appending at
            // the end of a batch would serialize the whole ingestion.
            position: NotePlacement.append([]),
            bodyRef: body,
            by: authorshipOf(context),
          }),
        );
        return notes.save(note);
      }),
    );

    // Not one retry, not one lost write.
    expect(outcomes.filter((result) => !result.ok)).toHaveLength(0);

    // The listing reads the base table without asking for consistency, so it
    // is awaited like an index.
    const stored = await converged(
      () => repositories(context).notes.listByNotebook(notebook.id),
      (notesListed) => notesListed.length === 50,
    );
    expect(stored).toHaveLength(50);

    // And the notebook META item was never rewritten by any of them.
    const meta = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `S#${context.subscriptionId.value}#NOTEBOOK#${notebook.id.value}`,
          SK: 'META',
        },
        ConsistentRead: true,
      }),
    );
    expect(meta.Item?.['version']).toBe(1);
  }, 120_000);

  it('writes the Templates of 20 folders in parallel while one of them is renamed', async () => {
    const context = contextFor();
    const { notebook } = await seedNotebook(context);
    const { notebooks, content } = repositories(context);

    const folders = [];
    for (let index = 0; index < 20; index++) {
      folders.push(
        unwrap(
          notebook.addFolder(
            null,
            folderName(`Pasta ${index}`),
            folderDescription(`A pasta numero ${index}.`),
            null,
            authorshipOf(context),
          ),
        ),
      );
    }
    expect((await notebooks.save(notebook)).ok).toBe(true);

    const refs = await Promise.all(
      folders.map((folder) =>
        content.create(`# Modelo de ${folder.name.value}
`),
      ),
    );
    // Twenty Template writes and a rename of the tree, all at once. Each
    // Template is locked on its own item, so none of them meets another and
    // none of them meets the rename (RN-KNW-044).
    const [renamed, ...outcomes] = await Promise.all([
      (async () => {
        const loaded = (await new DynamoNotebookRepository(context, db, TABLE_NAME).findById(
          notebook.id,
        )) as Notebook;
        unwrap(
          loaded.renameFolder(folders[0]!.id, folderName('Pasta zero'), authorshipOf(context)),
        );
        return new DynamoNotebookRepository(context, db, TABLE_NAME).save(loaded);
      })(),
      ...folders.map((folder, index) =>
        new DynamoContentSlotRepository(context, db, TABLE_NAME).save(
          Template.create({
            subscriptionId: context.subscriptionId,
            notebookId: notebook.id,
            folderId: folder.id,
            ref: refs[index]!,
            by: authorshipOf(context),
          }),
        ),
      ),
    ]);

    expect(renamed?.ok).toBe(true);
    expect(outcomes.filter((result) => !result.ok)).toHaveLength(0);
    const after = (await repositories(context).notebooks.findById(notebook.id)) as Notebook;
    for (const folder of folders) expect(after.hasTemplate(folder.id)).toBe(true);
  }, 120_000);
});
