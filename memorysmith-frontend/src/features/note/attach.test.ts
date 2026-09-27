/**
 * A file attached from the editor (#242, RN-KNW-054): declared with its hash,
 * sent part by part to the addresses the API signed, finished — and thrown
 * away whole when anything fails after the declaration.
 */

import { describe, expect, it } from 'vitest';
import type { UploadStatusDto } from '@memorysmith/contracts';
import {
  ATTACH_PART_BYTES,
  AttachRefusal,
  attachFile,
  hexOf,
  insertAt,
  referenceOf,
  type AttachPorts,
} from './attach';

function status(parts: number): UploadStatusDto {
  return {
    transfer: {
      transferId: '01JBQ2X0000000000000000UP1',
      kind: 'agent',
      status: 'running',
      notebookId: '01JBQ2X0000000000000000NB1',
      notebookName: 'Atas',
      requestedAt: '2026-09-26T12:00:00.000Z',
      finishedAt: null,
      done: 0,
      total: parts,
      bytes: 0,
      failure: null,
      fileName: 'quadro.jpg',
    },
    missing: Array.from({ length: parts }, (_, index) => index + 1),
    targets: Array.from({ length: parts }, (_, index) => ({
      part: index + 1,
      url: `https://uploads.example/p${index + 1}`,
    })),
    expiresAt: null,
  };
}

function ports(parts: number, over: Partial<AttachPorts> = {}) {
  const calls: string[] = [];
  const sizes: number[] = [];
  const port: AttachPorts = {
    begin: async (input) => {
      calls.push(`begin:${input.name}:${input.size}:${input.sha256}:${input.transport}`);
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
    sha256: async () => 'ab'.repeat(32),
    ...over,
  };
  return { port, calls, sizes };
}

const file = (size: number, type = 'image/jpeg') =>
  new File([new Uint8Array(size)], 'quadro.jpg', { type });

describe('attaching a file from the editor', () => {
  it('declares it with its hash, sends every part to its address, and finishes', async () => {
    const { port, calls, sizes } = ports(2);
    const seen: Array<[number, number]> = [];
    await attachFile(
      port,
      { notebookId: 'nb', file: file(ATTACH_PART_BYTES + 10), purpose: 'Para a ata' },
      (sent, total) => seen.push([sent, total]),
    );

    expect(calls).toEqual([
      `begin:quadro.jpg:${ATTACH_PART_BYTES + 10}:${'ab'.repeat(32)}:url`,
      'put:https://uploads.example/p1',
      'put:https://uploads.example/p2',
      'finish:01JBQ2X0000000000000000UP1',
    ]);
    expect(sizes).toEqual([ATTACH_PART_BYTES, 10]);
    expect(seen).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it('throws the upload away when a part fails, so nothing is left reserving room', async () => {
    const { port, calls } = ports(1, {
      put: async () => {
        throw new Error('network');
      },
    });
    await expect(
      attachFile(port, { notebookId: 'nb', file: file(100), purpose: 'x' }),
    ).rejects.toThrow('network');
    expect(calls).toContain('discard:01JBQ2X0000000000000000UP1');
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
