/**
 * Which pending link looks broken, and what it most likely meant (#217). A link
 * to a note not written yet is on purpose; one that almost reaches a name the
 * notebook has is not.
 */

import { describe, expect, it } from 'vitest';
import { comparableName, likelyMeant, type LinkCandidate } from '../src/link-check.js';

const note = (name: string, noteId: string): LinkCandidate => ({ name, kind: 'note', noteId });

const NOTEBOOK: LinkCandidate[] = [
  note('M42 Orion Nebula', 'n1'),
  note('M4', 'n2'),
  note('Contratação Direta', 'n3'),
  note('Back garden', 'n4'),
  // An alias of the same note is the same candidate.
  note('Garden', 'n4'),
  { name: 'telescope.jpg', kind: 'file' },
];

describe('a pending link that looks broken', () => {
  it('meets a name in another case, without its accents or its spacing', () => {
    expect(likelyMeant('contratacao direta', NOTEBOOK)?.noteId).toBe('n3');
    expect(likelyMeant('back-garden', NOTEBOOK)?.noteId).toBe('n4');
    expect(comparableName('M 42')).toBe(comparableName('m-42'));
  });

  it('meets the one longer name it is the start of, word by word', () => {
    expect(likelyMeant('M42', NOTEBOOK)?.noteId).toBe('n1');
    // The words of M42 are not the words of M4.
    expect(likelyMeant('M42 Orion', NOTEBOOK)?.noteId).toBe('n1');
    expect(likelyMeant('M4 cluster', NOTEBOOK)?.noteId).toBe('n2');
  });

  it('meets a file the notebook keeps', () => {
    expect(likelyMeant('Telescope JPG', NOTEBOOK)).toEqual({ name: 'telescope.jpg', kind: 'file' });
  });
});

describe('a pending link left on purpose', () => {
  it('meets nothing when no name is near it', () => {
    expect(likelyMeant('M81 Bodes Galaxy', NOTEBOOK)).toBeNull();
    expect(likelyMeant('Dark site', NOTEBOOK)).toBeNull();
  });

  it('meets nothing when two names are equally near, rather than guess', () => {
    const two = [note('Lei 14.133 art 75', 'a'), note('Lei 14.133 art 72', 'b')];
    expect(likelyMeant('Lei 14.133', two)).toBeNull();
  });

  it('meets nothing for a target too short to mean anything', () => {
    expect(likelyMeant('M', NOTEBOOK)).toBeNull();
  });
});
