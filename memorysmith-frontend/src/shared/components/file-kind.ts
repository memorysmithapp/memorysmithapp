import type { TFunction } from 'i18next';
import { fileTypeOf } from '@memorysmith/contracts';

/**
 * The key of the words that name a type, under `fileKind` in each locale.
 * A media type carries `/`, `.` and `+`, which a key of i18next cannot.
 */
export function fileKindKey(mimeType: string): string {
  return `fileKind.${mimeType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')}`;
}

/**
 * What a file is, in words a person reads (#251): *Documento do Word* where
 * the card used to print
 * `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
 * the longest line of the card, which said nothing a person recognises. A type
 * the product does not accept has no words, and is named by its media type.
 */
export function fileKind(t: TFunction, mimeType: string): string {
  return fileTypeOf(mimeType) === null ? mimeType : t(fileKindKey(mimeType));
}
