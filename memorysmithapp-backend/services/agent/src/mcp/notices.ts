import {
  diagnose,
  type Notice,
  type NoticeSeverity,
} from '@memorysmithapp/markdown-renderer/diagnose';

/**
 * The notices of a note (§7.13 of the specification, RN-AGT-052): where the
 * page will not show what was most likely typed, and what the note lacks that
 * the specification reserves a place for.
 *
 * This is the fourth sanctioned reader of a note's notation, beside the two
 * extractors of Discovery and `noteName` (INV-05), and the
 * narrowest: it decides nothing, changes no byte and never refuses a write —
 * there is no invalid note (§6.4) — and what it reads is handed back to the
 * agent that wrote it, so the agent can correct its own note in the same turn.
 * It is the reader the reading page draws with, published as
 * `@memorysmithapp/markdown-renderer`, so what it says is what the page does.
 *
 * Diagrams are not read here: Mermaid needs a document to read some diagrams
 * and would weigh on every call, and the page itself tells a diagram it cannot
 * draw. Links are not read either: the answer of a write already says which
 * of its links reach nothing (`links`), and `check_notebook` says it of the
 * whole notebook.
 */
export interface NoteNotice {
  readonly code: Notice['code'];
  readonly severity: NoticeSeverity;
  /** The section of the specification that decides what happens there. */
  readonly section: string;
  readonly message: string;
  /** From 1, over the whole note, frontmatter included. */
  readonly line: number;
  readonly column: number;
}

export async function noticesOf(
  content: string,
  severities: readonly NoticeSeverity[] = ['notice', 'hint'],
): Promise<NoteNotice[]> {
  const found = await diagnose(content, { diagrams: false });
  return found
    .filter((notice) => severities.includes(notice.severity))
    .map(({ code, severity, section, message, line, column }) => ({
      code,
      severity,
      section,
      message,
      line,
      column,
    }));
}
