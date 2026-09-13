/**
 * The addresses of the interface, side by side (RN-DSC-045, RN-DSC-046,
 * RN-DSC-057).
 *
 * A **URL is an address**: the product writes it, a person copies it, and
 * pasting it back has to land on what it was copied from. It carries
 * identifiers and nothing else, because anything else in it goes stale the day
 * it is renamed or moved. A **wikilink is a name**: an author writes it inside
 * the content, and a name may be carried by several notes. That is the one
 * place a name legitimately lives in an address.
 */

import { describe, expect, it } from 'vitest';
import {
  folderAddress,
  foldersAddress,
  identifierOf,
  linkTargetAddress,
  noteAddress,
  notebookAddress,
} from './note-address';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const FOLDER = '01J8X2K9QZ3M4N5P6R7S8T9V0F';
const NOTE = '01J8X2K9QZ3M4N5P6R7S8T9V0W';

describe('an address carries identifiers and nothing else', () => {
  it('addresses a note by the notebook and the note alone, in lower case', () => {
    expect(noteAddress(NOTEBOOK, NOTE)).toBe(
      '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/notes/01j8x2k9qz3m4n5p6r7s8t9v0w',
    );
  });

  it('does not nest a note under its folder, so moving it changes nothing', () => {
    expect(noteAddress(NOTEBOOK, NOTE)).not.toContain(FOLDER.toLowerCase());
    expect(noteAddress(NOTEBOOK, NOTE).split('/')).toHaveLength(5);
  });

  it('addresses a folder and the folder root by identifier', () => {
    expect(notebookAddress(NOTEBOOK)).toBe('/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a');
    expect(foldersAddress(NOTEBOOK)).toBe('/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/folders');
    expect(folderAddress(NOTEBOOK, FOLDER)).toBe(
      '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/folders/01j8x2k9qz3m4n5p6r7s8t9v0f',
    );
  });

  it('gives two notes with one name two different addresses', () => {
    // RN-KNW-037: the ambiguity is in the name, and no name is in the address.
    const other = '01J8X2K9QZ3M4N5P6R7S8T9V0X';
    expect(noteAddress(NOTEBOOK, NOTE)).not.toBe(noteAddress(NOTEBOOK, other));
  });
});

describe('a segment is an identifier in either case, or it addresses nothing', () => {
  it('reads the lower and the upper case as the same identifier', () => {
    expect(identifierOf('01j8x2k9qz3m4n5p6r7s8t9v0w')).toBe(NOTE);
    expect(identifierOf(NOTE)).toBe(NOTE);
  });

  it('round-trips every address it writes', () => {
    const segment = noteAddress(NOTEBOOK, NOTE).split('/').pop();
    expect(identifierOf(segment)).toBe(NOTE);
  });

  it('refuses a slug, a label and an address of the earlier form', () => {
    // Nothing reads a name out of an address any more, so nothing tolerates
    // one: an address saved before 0.6.0 answers not-found (RN-DSC-045).
    expect(identifierOf('enologia')).toBeNull();
    expect(identifierOf('indice--01j8x2k9qz3m4n5p6r7s8t9v0w')).toBeNull();
    expect(identifierOf('01j8x2k9qz3m4n5p6r7s8t9v0')).toBeNull();
    expect(identifierOf('01J8X2K9QZ3M4N5P6R7S8T9V0U')).toBeNull();
    expect(identifierOf('')).toBeNull();
    expect(identifierOf(undefined)).toBeNull();
  });
});

describe('the address of a link target names a name', () => {
  it('is where the encoding of a name legitimately lives', () => {
    expect(linkTargetAddress(NOTEBOOK, 'Reunião 03/09/2026')).toBe(
      '/notebooks/01j8x2k9qz3m4n5p6r7s8t9v0a/links/Reuni%C3%A3o%2003%2F09%2F2026',
    );
  });

  it('normalises to NFC before encoding, so both spellings are one address', () => {
    const decomposed = 'Ação'.normalize('NFD');
    expect(linkTargetAddress(NOTEBOOK, decomposed)).toBe(linkTargetAddress(NOTEBOOK, 'Ação'));
  });

  it('does not fold case, because the specification does not', () => {
    // `…/links/indice` is a pending target and never a redirect that repairs
    // it: an address that forgave what a wikilink refuses would make the two
    // surfaces disagree about which note is which (RN-DSC-056).
    expect(linkTargetAddress(NOTEBOOK, 'indice')).not.toBe(linkTargetAddress(NOTEBOOK, 'Índice'));
  });
});
