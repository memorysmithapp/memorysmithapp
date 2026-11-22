/**
 * A file of a `.notebook` document (RN-PRT-092): up to `1.5` its bytes base64
 * inside the document, from `1.6` the entry of the archive that holds them,
 * with their size and SHA-256. One of the two, never both.
 */

import { describe, expect, it } from 'vitest';
import {
  documentFileSchema,
  NOTEBOOK_DOCUMENT_VERSION,
  READABLE_DOCUMENT_VERSIONS,
} from '../src/api/notebook-document.js';

const what = {
  name: 'foto.png',
  description: '',
  mimeType: 'image/png',
  tags: [],
  path: '/',
};
const entry = { entry: 'files/1/foto.png', size: 12, sha256: 'a'.repeat(64) };

describe('a file of the document', () => {
  it('is written as 1.7 and read back to 1.0', () => {
    expect(NOTEBOOK_DOCUMENT_VERSION).toBe('1.8');
    expect(READABLE_DOCUMENT_VERSIONS).toContain('1.5');
  });

  it('names its entry with its size and hash, or carries its bytes base64', () => {
    expect(documentFileSchema.safeParse({ ...what, ...entry }).success).toBe(true);
    expect(documentFileSchema.safeParse({ ...what, bytes: 'iVBORw0KGgo=' }).success).toBe(true);
  });

  it('carries one of the two, and an entry with its size and hash', () => {
    expect(documentFileSchema.safeParse(what).success).toBe(false);
    expect(documentFileSchema.safeParse({ ...what, ...entry, bytes: 'AA==' }).success).toBe(false);
    expect(
      documentFileSchema.safeParse({ ...what, entry: 'files/1/foto.png', size: 12 }).success,
    ).toBe(false);
  });

  it('names an entry inside the archive, never a path out of it', () => {
    for (const outside of ['/etc/passwd', 'files/../../x', '..']) {
      expect(documentFileSchema.safeParse({ ...what, ...entry, entry: outside }).success).toBe(
        false,
      );
    }
  });
});
