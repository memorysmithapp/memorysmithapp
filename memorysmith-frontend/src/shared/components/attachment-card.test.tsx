/**
 * The card of a file a note shows and no browser draws (#171).
 *
 * It printed its size with a formatter of its own, `toFixed` and an English
 * unit, so a person reading in pt-BR saw `870.9 KB` on the card and `871 kB`
 * for the same file in Transfers (#250).
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FileLinkDto, NotebookFileDto } from '@memorysmith/contracts';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

vi.stubGlobal('localStorage', memoryStorage());

const FILE: NotebookFileDto = {
  fileId: '01J8X2K9QZ3M4N5P6R7S8T9V0B',
  name: 'Nota_Tecnica_Gradiente_Soberania_v3.docx',
  description: '',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  tags: [],
  path: '/',
  bytes: 891_850,
  sha256: '1523866ce2a439a6fcef1c37c16acad12d038bf4d61c69ddb1e67bb151a80d1a',
  updatedAt: '2026-09-27T14:32:44.000Z',
  authorship: { userId: 'user-1', agent: null },
} as unknown as NotebookFileDto;

const LINK: FileLinkDto = {
  url: 'https://files.example/one',
  downloadUrl: 'https://files.example/one?download',
  opens: false,
  expiresAt: '2026-09-27T15:32:44.000Z',
};

let card: (locale: 'pt_BR' | 'en_US', file?: NotebookFileDto) => string;

beforeAll(async () => {
  const { setLocale } = await import('../../i18n');
  const { AttachmentCard } = await import('./Attachment');
  card = (locale, file = FILE) => {
    setLocale(locale);
    return renderToStaticMarkup(<AttachmentCard file={file} link={LINK} />);
  };
}, 30_000);

describe('the kind of a file', () => {
  it('has words in every locale for every type the product accepts (#251)', async () => {
    const { FILE_MIME_TYPES } = await import('@memorysmith/contracts');
    const { default: i18n } = await import('../../i18n');
    const { fileKindKey } = await import('./file-kind');
    for (const mimeType of FILE_MIME_TYPES) {
      for (const lng of ['en_US', 'pt_BR']) {
        expect(
          i18n.exists(fileKindKey(mimeType), { lng, fallbackLng: [] }),
          `${lng} ${mimeType}`,
        ).toBe(true);
      }
    }
  });
});

describe('the card of a file', () => {
  it('names the kind of the file in words, and keeps the media type as its title (#251)', () => {
    const html = card('pt_BR');
    expect(html).toContain('Documento do Word');
    expect(html).toContain(`title="${FILE.mimeType}"`);
    expect(html).not.toContain(`>${FILE.mimeType}`);
    expect(card('en_US')).toContain('Word document');
  });

  it('reads its size in the locale of the interface (#250)', () => {
    const megabytes = { ...FILE, bytes: 8_756_694 };
    expect(card('pt_BR', megabytes)).toContain('8,4');
    expect(card('en_US', megabytes)).toContain('8.4');
    expect(card('pt_BR', megabytes)).not.toContain('8.4');
  });
});
