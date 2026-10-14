/**
 * The notices of the note being written (#291, RN-KNW-059): where a notice
 * takes the cursor, and how the list reads in both locales.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { diagnose } from '@memorysmithapp/markdown-renderer/diagnose';
import { offsetOf } from './NoteNotices';

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

describe('where a notice takes the cursor', () => {
  const text = '---\nname: A\n---\n\n## B\n';
  it('counts lines and columns from 1, over the whole note', () => {
    expect(offsetOf(text, 1, 1)).toBe(0);
    expect(offsetOf(text, 5, 1)).toBe(text.indexOf('## B'));
    expect(offsetOf(text, 5, 4)).toBe(text.indexOf('B', text.indexOf('##')));
  });
  it('never points past the end of the text', () => {
    expect(offsetOf(text, 99, 1)).toBe(text.length);
  });
});

let draw: (locale: 'en_US' | 'pt_BR', note: string) => Promise<string>;

beforeAll(async () => {
  const i18n = (await import('../../i18n')).default;
  const { NoteNotices } = await import('./NoteNotices');
  draw = async (locale, note) => {
    await i18n.changeLanguage(locale);
    const notices = await diagnose(note, { diagrams: false });
    return renderToStaticMarkup(
      <NoteNotices text={note} notices={notices} area={{ current: null }} />,
    );
  };
}, 30_000);

describe('the notices under the text', () => {
  const note = '---\nname: A\n---\n\n## Skipped\n\n```\nnever closed\n';

  it('says what the page will draw differently first, with its line, in pt_BR', async () => {
    const html = await draw('pt_BR', note);
    expect(html).toContain('O que a página não vai mostrar como foi digitado');
    expect(html).toContain('Linha 7');
    expect(html).toContain('Este bloco de código nunca é fechado');
    // What the note could still declare is folded, apart.
    expect(html).toContain('<details class="note-notices-hints">');
  });

  it('words every notice in en_US, and draws nothing for a note drawn as typed', async () => {
    expect(await draw('en_US', note)).toContain('The first heading of the body is not level one.');
    expect(
      await draw('en_US', '---\nname: A\naliases: [B]\ntags: [c]\n---\n\n# A\n\nText.\n'),
    ).toBe('');
  });
});
