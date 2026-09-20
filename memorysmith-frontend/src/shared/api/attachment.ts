import { fileKept } from './source';

/**
 * A target that names a file the notebook keeps rather than a note (§5.8, #166).
 *
 * It used to be a guess: a list of extensions in a regular expression, because
 * the product stored no file and the only thing it could do with
 * `![[diagram.png]]` was keep it from being drawn as a link to a note nobody
 * would ever write.
 *
 * A notebook keeps files now, and **the extension decides nothing**: a file is
 * called whatever it was called, with an extension, without one, or with one
 * that contradicts its type. So the question is no longer what the name looks
 * like, it is what the notebook HOLDS — which the page already knows, because
 * it reads the files of the notebook the way it reads its names (RN-DSC-061).
 */
export function isAttachmentName(notebookId: string, target: string): boolean {
  return fileKept(notebookId, target.trim()) !== null;
}
