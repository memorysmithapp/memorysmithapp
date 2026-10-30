import {
  diagnose,
  type Notice,
  type NoticeSeverity,
} from '@memorysmithapp/markdown-renderer/diagnose';
import { tableColumnsOf } from '@memorysmithapp/contracts';

/** A table's name as it is compared: after NFC, with case folded (§5.9). */
const nameKey = (name: string): string => name.normalize('NFC').toLowerCase();

/** Whether a note holds a `table` block, so its notices need the notebook's tables. */
export function namesATable(content: string): boolean {
  return /^[ \t>]*(?:[-*+][ \t]+)?(?:`{3,}|~{3,})table[ \t]*$/m.test(content);
}

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
  tables?: ReadonlyArray<{ name: string; schema: Readonly<Record<string, unknown>> }>,
): Promise<NoteNotice[]> {
  // With the tables of the notebook, a `table` block is checked against them;
  // without them, nothing is known of them and no block is pending (§7.13).
  const kept = new Map(
    (tables ?? []).map((table) => [
      nameKey(table.name),
      { name: table.name, columns: tableColumnsOf(table.schema) },
    ]),
  );
  const found = await diagnose(content, {
    diagrams: false,
    ...(tables ? { tables: (name: string) => kept.get(nameKey(name)) ?? null } : {}),
  });
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
