/**
 * A file given from the interface (#242, RN-KNW-054; #253, RN-PRT-030,
 * RN-KNW-055): hashed a slice at a time, declared with its hash — or found
 * again and resumed — sent part by part to the addresses the API signed, and
 * finished.
 */

import { describe, expect, it } from 'vitest';
import type { TransferDto, UploadStatusDto } from '@memorysmith/contracts';
import {
  ATTACH_PART_BYTES,
  AttachRefusal,
  attachFile,
  hexOf,
  insertAt,
  referenceOf,
  type AttachPorts,
} from './attach';

const HASH = 'ab'.repeat(32);
const UPLOAD = '01JBQ2X0000000000000000VP1';

function transfer(parts: number, over: Partial<TransferDto> = {}): TransferDto {
  return {
    transferId: UPLOAD,
    kind: 'agent',
    status: 'running',
    notebookId: '01JBQ2X0000000000000000NB1',
    notebookName: 'Atas',
    requestedAt: '2026-09-26T12:00:00.000Z',
    finishedAt: null,
    done: 0,
    total: parts,
    bytes: ATTACH_PART_BYTES + 10,
    failure: null,
    fileName: 'quadro.jpg',
    upload: {
      mimeType: 'image/jpeg',
      purpose: 'Para a ata',
      platform: null,
      transport: 'url',
      sha256: HASH,
      partSize: ATTACH_PART_BYTES,
      partCount: parts,
      received: [],
      lastPartAt: null,
      fulfils: null,
    },
    ...over,
  };
}

function status(parts: number, missing: number[] = []): UploadStatusDto {
  const left = missing.length > 0 ? missing : Array.from({ length: parts }, (_, i) => i + 1);
  return {
    transfer: transfer(parts),
    missing: left,
    targets: left.map((part) => ({ part, url: `https://uploads.example/p${part}` })),
    expiresAt: null,
  };
}

function ports(parts: number, over: Partial<AttachPorts> = {}) {
  const calls: string[] = [];
  const sizes: number[] = [];
  const port: AttachPorts = {
    begin: async (input) => {
      calls.push(
        `begin:${input.name}:${input.mimeType}:${input.size}:${input.sha256}:${input.request ?? '-'}`,
      );
      return status(parts);
    },
    put: async (url, bytes) => {
      calls.push(`put:${url}`);
      sizes.push(bytes.size);
    },
    finish: async (id) => {
      calls.push(`finish:${id}`);
      return {
        fileId: '01JBQ2X0000000000000000F01',
        notebookId: 'nb',
        name: 'quadro.jpg',
        bytes: 1,
      };
    },
    discard: async (id) => {
      calls.push(`discard:${id}`);
    },
    hash: async (_file, progress) => {
      progress(1, 1);
      return HASH;
    },
    open: async () => [],
    status: async (id) => {
      calls.push(`status:${id}`);
      return status(parts);
    },
    ...over,
  };
  return { port, calls, sizes };
}

const file = (size: number, type = 'image/jpeg') =>
  new File([new Uint8Array(size)], 'quadro.jpg', { type });

describe('giving a file from the interface', () => {
  it('declares it with its hash, sends every part to its address, and finishes', async () => {
    const { port, calls, sizes } = ports(2);
    const seen: Array<[number, number]> = [];
    await attachFile(
      port,
      { notebookId: 'nb', file: file(ATTACH_PART_BYTES + 10), purpose: 'Para a ata' },
      (sent, total) => seen.push([sent, total]),
    );

    expect(calls).toEqual([
      `begin:quadro.jpg:image/jpeg:${ATTACH_PART_BYTES + 10}:${HASH}:-`,
      'put:https://uploads.example/p1',
      'put:https://uploads.example/p2',
      `finish:${UPLOAD}`,
    ]);
    expect(sizes).toEqual([ATTACH_PART_BYTES, 10]);
    expect(seen).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('resumes the upload of the same file from the parts that arrived (RN-KNW-055)', async () => {
    const { port, calls, sizes } = ports(2, {
      open: async () => [transfer(2)],
      status: async (id) => {
        calls.push(`status:${id}`);
        return status(2, [2]);
      },
    });
    const seen: Array<[number, number]> = [];
    await attachFile(
      port,
      { notebookId: 'nb', file: file(ATTACH_PART_BYTES + 10), purpose: 'Para a ata' },
      (sent, total) => seen.push([sent, total]),
    );
    expect(calls).toEqual([
      `status:${UPLOAD}`,
      'put:https://uploads.example/p2',
      `finish:${UPLOAD}`,
    ]);
    expect(sizes).toEqual([10]);
    expect(seen[0]).toEqual([1, 2]);
  });

  it('never resumes an upload an agent opened', async () => {
    const theirs = transfer(2);
    const { port, calls } = ports(2, {
      open: async () => [{ ...theirs, upload: { ...theirs.upload!, platform: 'Claude' } }],
    });
    await attachFile(port, { notebookId: 'nb', file: file(ATTACH_PART_BYTES + 10), purpose: 'x' });
    expect(calls[0]).toMatch(/^begin:/);
  });

  it('leaves the upload open when a part fails, for the next attempt to resume', async () => {
    const { port, calls } = ports(1, {
      put: async () => {
        throw new Error('network');
      },
    });
    await expect(
      attachFile(port, { notebookId: 'nb', file: file(100), purpose: 'x' }),
    ).rejects.toThrow('network');
    expect(calls.some((call) => call.startsWith('discard:'))).toBe(false);
  });

  it('throws away an upload whose bytes the finish refused for good', async () => {
    const { port, calls } = ports(1, {
      finish: async () => {
        throw Object.assign(new Error('refused'), { details: { reason: 'TYPE_MISMATCH' } });
      },
    });
    await expect(
      attachFile(port, { notebookId: 'nb', file: file(100), purpose: 'x' }),
    ).rejects.toThrow('refused');
    expect(calls).toContain(`discard:${UPLOAD}`);
  });

  it('fulfils a request, taking its type when the file has none of its own (RN-PRT-030)', async () => {
    const { port, calls } = ports(1);
    await attachFile(port, {
      notebookId: 'nb',
      file: file(100, ''),
      purpose: 'Pedido',
      request: { transferId: '01JBQ2X0000000000000000RQ1', mimeType: 'image/png' },
    });
    expect(calls[0]).toBe(`begin:quadro.jpg:image/png:100:${HASH}:01JBQ2X0000000000000000RQ1`);
  });

  it('refuses before anything travels what the API would refuse anyway', async () => {
    const { port, calls } = ports(1);
    await expect(
      attachFile(port, { notebookId: 'nb', file: file(0), purpose: 'x' }),
    ).rejects.toBeInstanceOf(AttachRefusal);
    await expect(
      attachFile(port, { notebookId: 'nb', file: file(10, ''), purpose: 'x' }),
    ).rejects.toMatchObject({ reason: 'NO_TYPE' });
    expect(calls).toEqual([]);
  });

  it('writes the reference on a line of its own, where the cursor is', () => {
    const reference = referenceOf('quadro.jpg');
    expect(reference).toBe('![[quadro.jpg]]');
    expect(insertAt('Ata\n', 4, reference)).toEqual({
      text: 'Ata\n![[quadro.jpg]]\n',
      cursor: 20,
    });
    expect(insertAt('Antes depois', 5, reference).text).toBe('Antes\n![[quadro.jpg]]\n depois');
    expect(hexOf(new Uint8Array([0, 15, 255]).buffer)).toBe('000fff');
  });
});
