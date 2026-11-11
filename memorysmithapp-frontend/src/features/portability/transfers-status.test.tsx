/**
 * The transfers on the bell (#450): the end of an export or an import is news
 * for a day, until it is read, and its notice says how it ended and leads to
 * what it made.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { TransferDto } from '@memorysmithapp/contracts';
import type * as TransfersStatus from './TransfersStatus';

const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  removeItem: (key: string) => void stored.delete(key),
  setItem: (key: string, value: string) => void stored.set(key, value),
} as Storage);

function transfer(over: Partial<TransferDto>): TransferDto {
  return {
    transferId: '01JBQ2X0000000000000000001',
    kind: 'export',
    status: 'ready',
    notebookId: '01JBQ2X0000000000000000002',
    notebookName: 'Obras',
    requestedAt: '2026-11-11T10:00:00.000Z',
    finishedAt: '2026-11-11T10:00:04.000Z',
    done: 0,
    total: 0,
    bytes: 0,
    failure: null,
    fileName: null,
    ...over,
  };
}

let module: typeof TransfersStatus;
const draw = (each: TransferDto) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <module.TransferNotice transfer={each} onClose={() => {}} />
    </MemoryRouter>,
  );

beforeAll(async () => {
  await (await import('../../i18n')).default.changeLanguage('pt_BR');
  module = await import('./TransfersStatus');
}, 30_000);

describe('the transfers on the bell (#450)', () => {
  it('keeps the end of an export or an import as news for a day', () => {
    const now = new Date('2026-11-11T12:00:00.000Z').getTime();
    expect(module.endedLately(transfer({}), now)).toBe(true);
    expect(module.endedLately(transfer({ kind: 'import', status: 'failed' }), now)).toBe(true);
    expect(module.endedLately(transfer({ finishedAt: '2026-11-09T10:00:00.000Z' }), now)).toBe(
      false,
    );
    expect(module.endedLately(transfer({ status: 'running', finishedAt: null }), now)).toBe(false);
    expect(module.endedLately(transfer({ kind: 'agent' }), now)).toBe(false);
  });

  it('says an export finished and offers its archive', () => {
    const html = draw(transfer({}));
    expect(html).toContain('A exportação de <strong>Obras</strong> terminou.');
    expect(html).toContain('Baixar');
  });

  it('says an import failed and why, and leads to the notebook of one that finished', () => {
    expect(
      draw(transfer({ kind: 'import', status: 'failed', failure: 'QUOTA_EXCEEDED' })),
    ).toContain('A importação de <strong>Obras</strong> falhou.');
    expect(draw(transfer({ kind: 'import' }))).toContain('Abrir o caderno');
  });

  it('shows one under way with its bar', () => {
    const html = draw(transfer({ status: 'running', finishedAt: null, done: 3, total: 10 }));
    expect(html).toContain('transfer-bar');
    expect(html).toContain('width:30%');
  });
});
