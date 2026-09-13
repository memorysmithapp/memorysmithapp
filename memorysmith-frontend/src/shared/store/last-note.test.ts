/**
 * Where the reading stopped, per notebook and per browser.
 *
 * Everything here has to survive a browser that refuses storage, because the
 * feature is a convenience and the notebook opening is not: a throw from
 * `localStorage` may never be what keeps somebody out of their own notes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetNote, lastNoteOf, rememberNote } from './last-note';

const PROCUREMENT = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const JOURNAL = '01J8X2K9QZ3M4N5P6R7S8T9V0B';
const LEI = '01J8X2K9QZ3M4N5P6R7S8T9V0W';
const ARTICLE = '01J8X2K9QZ3M4N5P6R7S8T9V0X';
const SEPTEMBER = '01J8X2K9QZ3M4N5P6R7S8T9V0Y';

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

/** A browser that refuses site data: every accessor throws. */
function refusingStorage(): Storage {
  const refuse = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return {
    get length(): number {
      return refuse();
    },
    clear: refuse,
    getItem: refuse,
    key: refuse,
    removeItem: refuse,
    setItem: refuse,
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the last note is remembered per notebook, by identifier', () => {
  it('gives back what was remembered', () => {
    rememberNote(PROCUREMENT, LEI);
    expect(lastNoteOf(PROCUREMENT)).toBe(LEI);
  });

  it('keeps one note per notebook, without the notebooks touching each other', () => {
    rememberNote(PROCUREMENT, LEI);
    rememberNote(JOURNAL, SEPTEMBER);

    expect(lastNoteOf(PROCUREMENT)).toBe(LEI);
    expect(lastNoteOf(JOURNAL)).toBe(SEPTEMBER);
  });

  it('replaces the note of a notebook instead of piling entries up', () => {
    rememberNote(PROCUREMENT, LEI);
    rememberNote(PROCUREMENT, ARTICLE);

    expect(lastNoteOf(PROCUREMENT)).toBe(ARTICLE);
  });

  it('answers null for a notebook nothing was read in', () => {
    expect(lastNoteOf(JOURNAL)).toBeNull();
  });

  it('forgets one notebook and leaves the others alone', () => {
    rememberNote(PROCUREMENT, LEI);
    rememberNote(JOURNAL, SEPTEMBER);
    forgetNote(PROCUREMENT);

    expect(lastNoteOf(PROCUREMENT)).toBeNull();
    expect(lastNoteOf(JOURNAL)).toBe(SEPTEMBER);
  });

  it('stores nothing that is not an identifier on either side', () => {
    rememberNote('', LEI);
    rememberNote(PROCUREMENT, '');
    rememberNote('procurement', LEI);
    rememberNote(PROCUREMENT, 'decisions/lei-14133');

    expect(lastNoteOf(PROCUREMENT)).toBeNull();
    expect(lastNoteOf('procurement')).toBeNull();
  });
});

describe('an entry written before 0.6.0 is dropped, not followed', () => {
  it('forgets a notebook slug that points at a path', () => {
    // Following it would mean reading a name out of an address, which is the
    // tolerance the address gave up (RN-DSC-045).
    localStorage.setItem(
      'memorysmith.lastNote',
      JSON.stringify({ procurement: 'decisions/lei-14133--01j8x2k9qz3m4n5p6r7s8t9v0w' }),
    );

    expect(lastNoteOf('procurement')).toBeNull();
  });

  it('keeps the identifiers written next to it', () => {
    localStorage.setItem(
      'memorysmith.lastNote',
      JSON.stringify({ procurement: 'decisions/lei-14133', [JOURNAL]: SEPTEMBER }),
    );

    expect(lastNoteOf(JOURNAL)).toBe(SEPTEMBER);
  });
});

describe('nothing here can keep a notebook from opening', () => {
  it('reads null out of stored nonsense instead of throwing', () => {
    localStorage.setItem('memorysmith.lastNote', 'not json at all');
    expect(lastNoteOf(PROCUREMENT)).toBeNull();
  });

  it('drops entries that are not identifiers, and keeps the ones that are', () => {
    localStorage.setItem(
      'memorysmith.lastNote',
      JSON.stringify({ [PROCUREMENT]: 42, [JOURNAL]: SEPTEMBER }),
    );

    expect(lastNoteOf(PROCUREMENT)).toBeNull();
    expect(lastNoteOf(JOURNAL)).toBe(SEPTEMBER);
  });

  it('survives a browser that refuses storage outright', () => {
    vi.stubGlobal('localStorage', refusingStorage());

    expect(() => rememberNote(PROCUREMENT, LEI)).not.toThrow();
    expect(() => forgetNote(PROCUREMENT)).not.toThrow();
    expect(lastNoteOf(PROCUREMENT)).toBeNull();
  });
});
