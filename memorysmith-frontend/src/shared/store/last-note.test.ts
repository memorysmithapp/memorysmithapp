/**
 * Where the reading stopped, per person, per notebook and per browser.
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

// The `sub` of two accounts, as Cognito spells it.
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
    rememberNote(OWNER, PROCUREMENT, LEI);
    expect(lastNoteOf(OWNER, PROCUREMENT)).toBe(LEI);
  });

  it('keeps one note per notebook, without the notebooks touching each other', () => {
    rememberNote(OWNER, PROCUREMENT, LEI);
    rememberNote(OWNER, JOURNAL, SEPTEMBER);

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBe(LEI);
    expect(lastNoteOf(OWNER, JOURNAL)).toBe(SEPTEMBER);
  });

  it('replaces the note of a notebook instead of piling entries up', () => {
    rememberNote(OWNER, PROCUREMENT, LEI);
    rememberNote(OWNER, PROCUREMENT, ARTICLE);

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBe(ARTICLE);
  });

  it('answers null for a notebook nothing was read in', () => {
    expect(lastNoteOf(OWNER, JOURNAL)).toBeNull();
  });

  it('forgets one notebook and leaves the others alone', () => {
    rememberNote(OWNER, PROCUREMENT, LEI);
    rememberNote(OWNER, JOURNAL, SEPTEMBER);
    forgetNote(OWNER, PROCUREMENT);

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBeNull();
    expect(lastNoteOf(OWNER, JOURNAL)).toBe(SEPTEMBER);
  });

  it('stores nothing that is not an identifier on either side', () => {
    rememberNote(OWNER, '', LEI);
    rememberNote(OWNER, PROCUREMENT, '');
    rememberNote(OWNER, 'procurement', LEI);
    rememberNote(OWNER, PROCUREMENT, 'decisions/lei-14133');

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBeNull();
    expect(lastNoteOf(OWNER, 'procurement')).toBeNull();
  });
});

describe('each person keeps a place of their own', () => {
  it('lets two people stop in different notes of the same shared notebook', () => {
    // The owner and the person it is shared with, in the same browser.
    rememberNote(OWNER, PROCUREMENT, LEI);
    rememberNote(READER, PROCUREMENT, ARTICLE);

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBe(LEI);
    expect(lastNoteOf(READER, PROCUREMENT)).toBe(ARTICLE);
  });

  it('forgets the place of one person and leaves the other where they stopped', () => {
    rememberNote(OWNER, PROCUREMENT, LEI);
    rememberNote(READER, PROCUREMENT, ARTICLE);
    forgetNote(READER, PROCUREMENT);

    expect(lastNoteOf(READER, PROCUREMENT)).toBeNull();
    expect(lastNoteOf(OWNER, PROCUREMENT)).toBe(LEI);
  });

  it('remembers nothing for nobody', () => {
    rememberNote('', PROCUREMENT, LEI);

    expect(lastNoteOf('', PROCUREMENT)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it('drops the entry of nobody in particular, written before notebooks were shared', () => {
    // It cannot be told whose it was, so it is nobody's to resume.
    localStorage.setItem('memorysmith.lastNote', JSON.stringify({ [PROCUREMENT]: LEI }));

    expect(lastNoteOf(READER, PROCUREMENT)).toBeNull();
    rememberNote(READER, JOURNAL, SEPTEMBER);
    expect(localStorage.getItem('memorysmith.lastNote')).toBeNull();
  });
});

describe('an entry written before 0.6.0 is dropped, not followed', () => {
  it('forgets a notebook slug that points at a path', () => {
    // Following it would mean reading a name out of an address, which is the
    // tolerance the address gave up (RN-DSC-045).
    localStorage.setItem(
      `memorysmith.lastNote.${OWNER}`,
      JSON.stringify({ procurement: 'decisions/lei-14133--01j8x2k9qz3m4n5p6r7s8t9v0w' }),
    );

    expect(lastNoteOf(OWNER, 'procurement')).toBeNull();
  });

  it('keeps the identifiers written next to it', () => {
    localStorage.setItem(
      `memorysmith.lastNote.${OWNER}`,
      JSON.stringify({ procurement: 'decisions/lei-14133', [JOURNAL]: SEPTEMBER }),
    );

    expect(lastNoteOf(OWNER, JOURNAL)).toBe(SEPTEMBER);
  });
});

describe('nothing here can keep a notebook from opening', () => {
  it('reads null out of stored nonsense instead of throwing', () => {
    localStorage.setItem(`memorysmith.lastNote.${OWNER}`, 'not json at all');
    expect(lastNoteOf(OWNER, PROCUREMENT)).toBeNull();
  });

  it('drops entries that are not identifiers, and keeps the ones that are', () => {
    localStorage.setItem(
      `memorysmith.lastNote.${OWNER}`,
      JSON.stringify({ [PROCUREMENT]: 42, [JOURNAL]: SEPTEMBER }),
    );

    expect(lastNoteOf(OWNER, PROCUREMENT)).toBeNull();
    expect(lastNoteOf(OWNER, JOURNAL)).toBe(SEPTEMBER);
  });

  it('survives a browser that refuses storage outright', () => {
    vi.stubGlobal('localStorage', refusingStorage());

    expect(() => rememberNote(OWNER, PROCUREMENT, LEI)).not.toThrow();
    expect(() => forgetNote(OWNER, PROCUREMENT)).not.toThrow();
    expect(lastNoteOf(OWNER, PROCUREMENT)).toBeNull();
  });
});
