/**
 * The title of the tab (RN-DSC-058).
 *
 * An address carries identifiers and no name (RN-DSC-045), so the title is
 * what tells two tabs, two entries of the history and two bookmarks apart.
 */

import { describe, expect, it } from 'vitest';
import { documentTitleOf } from './document-title';

describe('the title of the tab names what is open, then what holds it', () => {
  it('names a note, then its notebook, then the product', () => {
    expect(documentTitleOf('Lei 14.133', 'Procurement')).toBe(
      'Lei 14.133 · Procurement · MemorySmith',
    );
  });

  it('names a notebook on its own page', () => {
    expect(documentTitleOf('Procurement')).toBe('Procurement · MemorySmith');
  });

  it('skips what is not known yet instead of printing a hole', () => {
    // A note still loading has no name to show, and an empty separator would
    // read as a note with an empty name.
    expect(documentTitleOf(null, 'Procurement')).toBe('Procurement · MemorySmith');
    expect(documentTitleOf('  ', undefined)).toBe('MemorySmith');
  });

  it('keeps a name exactly as it was written', () => {
    expect(documentTitleOf('Reunião 03/09/2026 · pauta')).toBe(
      'Reunião 03/09/2026 · pauta · MemorySmith',
    );
  });
});
