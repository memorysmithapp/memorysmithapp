/**
 * The finish of an upload runs in the transfer worker (#480): asking for it
 * answers the file when the worker ends within the wait, `finishing` when it
 * does not, and the status says when the file is kept, once.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AgentIdentity,
  Authorship,
  DomainError,
  Instant,
  ok,
  UserId,
} from '@memorysmithapp/kernel';
import { InMemoryTransferStore } from '../src/adapters/dynamo.js';
import { InMemoryPartStore } from '../src/adapters/memory.js';
import {
  BeginUpload,
  FinishUpload,
  GetUploadStatus,
  RequestFinish,
  RunFinish,
  type FileKeeper,
} from '../src/application/Uploads.js';
import type { TransferWork } from '../src/application/Transfers.js';

const SUB = '01JBQ2X0000000000000000S01';
const USER = 'user-1';
const NOTEBOOK = '01JBQ2X00000000000000000V1';

function by(): Authorship {
  const user = UserId.create(USER);
  const agent = AgentIdentity.create('https://claude.ai', 'Claude');
  if (!user.ok || !agent.ok) throw new Error('fixture');
  return Authorship.create(user.value, agent.value, Instant.now());
}

function harness(keep?: FileKeeper['keepAssembled']) {
  const transfers = new InMemoryTransferStore();
  const parts = new InMemoryPartStore();
  const files: FileKeeper = {
    destination: async () => ok({ notebookName: 'Atas', mimeType: 'image/png' }),
    keepAssembled:
      keep ??
      (async (input) =>
        ok({
          fileId: '01JBQ2X0000000000000000F01',
          name: input.name,
          bytes: input.assembled.size,
        })),
  };
  const sent: TransferWork[] = [];
  const worker = () =>
    new RunFinish(transfers, new FinishUpload(transfers, parts, files, SUB, USER), USER);
  return { transfers, parts, files, sent, worker };
}

async function begun(h: ReturnType<typeof harness>, whole: Buffer): Promise<string> {
  const status = await new BeginUpload(
    h.transfers,
    h.parts,
    h.files,
    { current: async () => ({ usedBytes: 0, limitBytes: 1e12 }) },
    SUB,
    USER,
  ).execute({
    notebookId: NOTEBOOK,
    name: 'quadro.png',
    mimeType: 'image/png',
    purpose: 'A foto do quadro',
    size: whole.length,
    sha256: createHash('sha256').update(whole).digest('hex'),
    by: by(),
  });
  if (!status.ok) throw new Error(status.error.message);
  const multipartId = /uploadId=([^&]+)/.exec(status.value.targets[0]?.url ?? '')?.[1] ?? '';
  h.parts.receivePart(multipartId, 1, whole);
  return status.value.transfer.transferId;
}

const NO_WAIT = { withinMs: 0, everyMs: 0 };

describe('the finish of an upload, in the worker', () => {
  it('answers finishing while the worker runs, and the status answers the file once it is kept', async () => {
    const h = harness();
    const id = await begun(h, Buffer.from('a picture'));
    const asked = await new RequestFinish(
      h.transfers,
      h.parts,
      { send: async (work) => void h.sent.push(work) },
      SUB,
      USER,
      NO_WAIT,
    ).execute(id, by());
    expect(asked).toEqual(ok({ status: 'finishing', transferId: id }));
    expect(h.sent).toMatchObject([{ kind: 'finish', transferId: id, subscriptionId: SUB }]);
    expect(h.sent[0]?.authorship?.agent?.clientName).toBe('Claude');

    // Asked again while it runs, nothing is sent twice.
    await new RequestFinish(
      h.transfers,
      h.parts,
      { send: async (w) => void h.sent.push(w) },
      SUB,
      USER,
      NO_WAIT,
    ).execute(id, by());
    expect(h.sent).toHaveLength(1);
    const running = await new GetUploadStatus(h.transfers, h.parts, SUB, USER).execute(id);
    expect(running.ok && running.value.transfer.upload?.finishing).toBeTruthy();
    expect(running.ok && running.value.kept).toBeUndefined();

    await h.worker().execute(id, by());
    const status = await new GetUploadStatus(h.transfers, h.parts, SUB, USER).execute(id);
    expect(status.ok && status.value.kept).toMatchObject({
      name: 'quadro.png',
      notebookId: NOTEBOOK,
    });
    // Read once: the file is what stays (RN-PRT-028).
    expect(await h.transfers.get(USER, id)).toBeNull();
  });

  it('answers the file within the wait when the worker ends in time', async () => {
    const h = harness();
    const id = await begun(h, Buffer.from('a small picture'));
    const asked = await new RequestFinish(
      h.transfers,
      h.parts,
      { send: async (work) => h.worker().execute(work.transferId, by()) },
      SUB,
      USER,
      NO_WAIT,
    ).execute(id, by());
    expect(asked.ok && asked.value.status).toBe('kept');
  });

  it('says why the worker did not keep the file, and is asked again after', async () => {
    let refuse = true;
    const h = harness(async (input) =>
      refuse
        ? { ok: false, error: DomainError.conflict('The notebook keeps a file of that name') }
        : ok({
            fileId: '01JBQ2X0000000000000000F01',
            name: input.name,
            bytes: input.assembled.size,
          }),
    );
    const id = await begun(h, Buffer.from('a picture'));
    const queue = { send: async (work: TransferWork) => h.worker().execute(work.transferId, by()) };
    const refused = await new RequestFinish(
      h.transfers,
      h.parts,
      queue,
      SUB,
      USER,
      NO_WAIT,
    ).execute(id, by());
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error.code).toBe('CONFLICT');

    refuse = false;
    const kept = await new RequestFinish(h.transfers, h.parts, queue, SUB, USER, NO_WAIT).execute(
      id,
      by(),
    );
    expect(kept.ok && kept.value.status).toBe('kept');
  });
});
