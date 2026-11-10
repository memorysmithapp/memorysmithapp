/**
 * The notebooks read in last, for Home's way back (#424): one entry per
 * notebook, the newest first, per person and per browser, and never a throw
 * from a browser that refuses storage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recentNotes, rememberRecent } from './recent-notes';

const PROCUREMENT = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const JOURNAL = '01J8X2K9QZ3M4N5P6R7S8T9V0B';
const LEI = '01J8X2K9QZ3M4N5P6R7S8T9V0W';
const ARTICLE = '01J8X2K9QZ3M4N5P6R7S8T9V0X';
const OWNER = '4418d4b8-3051-70a1-9b2c-6e0f1a2b3c4d';
const READER = '94a8e4d8-a0d1-7023-8f5e-1d2c3b4a5f60';

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

describe('the notebooks read in last', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('keeps one entry per notebook, the newest first, with the note read in it', () => {
    rememberRecent(OWNER, PROCUREMENT, LEI, 'Lei 14.133', new Date('2026-11-10T10:00:00Z'));
    rememberRecent(OWNER, JOURNAL, ARTICLE, 'Article', new Date('2026-11-10T11:00:00Z'));
    rememberRecent(OWNER, PROCUREMENT, ARTICLE, 'Art. 75', new Date('2026-11-10T12:00:00Z'));

    expect(recentNotes(OWNER).map((entry) => [entry.notebookId, entry.noteName])).toEqual([
      [PROCUREMENT, 'Art. 75'],
      [JOURNAL, 'Article'],
    ]);
  });

  it('is kept per person, so one account never moves another', () => {
    rememberRecent(OWNER, PROCUREMENT, LEI, 'Lei 14.133');
    expect(recentNotes(READER)).toEqual([]);
    expect(recentNotes('')).toEqual([]);
  });

  it('drops what is not its own, and survives a browser that refuses storage', () => {
    localStorage.setItem(`memorysmith.recentNotes.${OWNER}`, '[{"notebookId":"x"}, 7]');
    expect(recentNotes(OWNER)).toEqual([]);

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
    });
    expect(() => rememberRecent(OWNER, PROCUREMENT, LEI, 'Lei')).not.toThrow();
    expect(recentNotes(OWNER)).toEqual([]);
  });
});
