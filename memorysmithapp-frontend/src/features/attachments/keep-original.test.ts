/**
 * The original kept in the place of the copy (#466, RN-KNW-091): everything
 * the API would refuse after the copy is gone is asked first; the copy is let
 * go only as the upload is declared; the original goes through the editor's
 * checked upload under the same name, description, tags and path; and what the
 * notebook then holds is checked again.
 */

import { describe, expect, it } from 'vitest';
import type { NotebookFileDto, TransferDto, UploadStatusDto } from '@memorysmithapp/contracts';
import type { AttachPorts } from '../note/attach';
import { keepOriginal, OriginalRefusal, type KeepOriginalPorts } from './keep-original';

const SHA = 'c'.repeat(64);
const UPLOAD = '01JBQ2X0000000000000000VP1';
const NOTEBOOK = '01JBQ2X0000000000000000NB1';

const kept: NotebookFileDto = {
  fileId: '01JBQ2X0000000000000000F01',
  name: 'anexo-foto.jpg',
  description: 'The façade, from the street',
  mimeType: 'image/jpeg',
  tags: ['obra'],
  path: '/Anexos',
  bytes: 1960955,
  sha256: 'b'.repeat(64),
  updatedAt: '2026-11-16T12:00:00.000Z',
  authorship: { kind: 'agent', userId: 'u1', clientName: 'ChatGPT' },
} as unknown as NotebookFileDto;

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]);

function transfer(name: string): TransferDto {
  return {
    transferId: UPLOAD,
    kind: 'agent',
    status: 'running',
    notebookId: NOTEBOOK,
    notebookName: 'Obra',
    requestedAt: '2026-11-16T12:00:00.000Z',
    finishedAt: null,
    done: 0,
    total: 1,
    bytes: JPEG.length,
    failure: null,
    noticeRead: false,
    cancelling: false,
    fileName: name,
    upload: {
      mimeType: 'image/jpeg',
      purpose: 'x',
      platform: null,
      transport: 'url',
      sha256: SHA,
      partSize: 8 * 1024 * 1024,
      partCount: 1,
      received: [],
      lastPartAt: null,
      fulfils: null,
    },
  } as TransferDto;
}

const status = (name = kept.name): UploadStatusDto => ({
  transfer: transfer(name),
  missing: [1],
  targets: [{ part: 1, url: 'https://uploads.example/p1' }],
  expiresAt: null,
});

function ports(
  over: { remove?: () => Promise<void>; open?: TransferDto[]; room?: number | null } = {},
) {
  const calls: string[] = [];
  const attach: AttachPorts = {
    begin: async (input) => {
      calls.push(
        `begin:${input.name}:${input.mimeType}:${input.description}:${(input.tags ?? []).join(',')}:${input.path}:${input.sha256}`,
      );
      return status();
    },
    put: async (url) => {
      calls.push(`put:${url}`);
    },
    finish: async (id) => {
      calls.push(`finish:${id}`);
      return {
        fileId: '01JBQ2X0000000000000000F02',
        notebookId: NOTEBOOK,
        name: kept.name,
        bytes: 1,
      };
    },
    discard: async () => undefined,
    hash: async () => {
      calls.push('hash');
      return 'f'.repeat(64);
    },
    open: async () => over.open ?? [],
    status: async (id) => {
      calls.push(`status:${id}`);
      return status();
    },
  };
  const port: KeepOriginalPorts = {
    attach,
    remove:
      over.remove ??
      (async () => {
        calls.push('remove');
      }),
    room: async () => (over.room === undefined ? null : over.room),
    list: async () => {
      calls.push('list');
      return [{ ...kept, fileId: '01JBQ2X0000000000000000F02', bytes: JPEG.length, sha256: SHA }];
    },
  };
  return { port, calls };
}

const original = (content: Uint8Array<ArrayBuffer> = JPEG, type = 'image/jpeg') =>
  new File([content], 'IMG_0412.JPG', { type });

const input = (file: File) => ({
  notebookId: NOTEBOOK,
  kept,
  file,
  sha256: SHA,
  purpose: 'The original',
});

describe('keeping the original in the place of the copy', () => {
  it('lets the copy go as the upload is declared, and keeps the original as the copy was described', async () => {
    const { port, calls } = ports();
    const phases: string[] = [];

    const answer = await keepOriginal(port, input(original()), (now) => phases.push(now.phase));

    expect(calls).toEqual([
      'remove',
      `begin:anexo-foto.jpg:image/jpeg:The façade, from the street:obra:/Anexos:${SHA}`,
      'put:https://uploads.example/p1',
      `finish:${UPLOAD}`,
      'list',
    ]);
    // The check already hashed the file: it is not read again.
    expect(calls).not.toContain('hash');
    expect(phases).toContain('letting-go');
    expect(answer.identical).toBe(true);
  });

  it('changes nothing when a notebook does not keep the type of the original', async () => {
    const { port, calls } = ports();
    await expect(
      keepOriginal(
        port,
        input(original(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]), 'image/heic')),
      ),
    ).rejects.toEqual(new OriginalRefusal('TYPE_NOT_KEPT'));
    expect(calls).toEqual([]);
  });

  it('changes nothing when the bytes contradict the type the file says it is', async () => {
    const { port, calls } = ports();
    await expect(
      keepOriginal(port, input(original(new TextEncoder().encode('%PDF-1.7'), 'image/jpeg'))),
    ).rejects.toEqual(new OriginalRefusal('TYPE_CONTRADICTED'));
    expect(calls).toEqual([]);
  });

  it('takes the type of the copy when the system gives the original none', async () => {
    const { port, calls } = ports();
    await keepOriginal(port, input(original(JPEG, '')));
    expect(calls[1]).toContain(':image/jpeg:');
  });

  it('goes on when an attempt the connection dropped already let the copy go', async () => {
    const gone = Object.assign(new Error('File not found'), { code: 'NOT_FOUND' });
    const { port, calls } = ports({ remove: () => Promise.reject(gone) });

    const answer = await keepOriginal(port, input(original()));

    expect(calls[0]).toMatch(/^begin:/);
    expect(answer.identical).toBe(true);
  });

  it('refuses before letting the copy go when the plan has no room for the original (#482)', async () => {
    const { port, calls } = ports({ room: 0 });
    await expect(
      keepOriginal(port, {
        notebookId: 'nb',
        kept: { ...kept, bytes: 5 },
        file: new File([JPEG], 'foto.jpg', { type: 'image/jpeg' }),
        sha256: SHA,
        purpose: 'x',
      }),
    ).rejects.toMatchObject({ reason: 'NO_ROOM' });
    expect(calls).not.toContain('remove');
  });

  it('stops before declaring anything when letting the copy go fails otherwise', async () => {
    const refused = Object.assign(new Error('Forbidden'), { code: 'NOT_AUTHORIZED' });
    const { port, calls } = ports({ remove: () => Promise.reject(refused) });

    await expect(keepOriginal(port, input(original()))).rejects.toBe(refused);
    expect(calls).toEqual([]);
  });

  it('resumes only an upload of this very name, never another file of the same bytes', async () => {
    const elsewhere = ports({ open: [transfer('another-name.jpg')] });
    await keepOriginal(elsewhere.port, input(original()));
    expect(elsewhere.calls[0]).toBe('remove');

    const dropped = ports({ open: [transfer(kept.name)] });
    await keepOriginal(dropped.port, input(original()));
    expect(dropped.calls[0]).toBe(`status:${UPLOAD}`);
    expect(dropped.calls).not.toContain('remove');
  });
});
