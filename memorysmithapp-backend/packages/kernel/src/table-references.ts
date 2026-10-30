/**
 * The tables a note names (MemorySmith Markdown Specification §5.9, §7.15): the
 * value of the `table` key of each `table` block, and nothing else of it.
 *
 * It lives beside the other readers of the notation the backend is allowed
 * (INV-05). A block with no `table` key, an empty one or two of them references
 * nothing; a block with any other mistake still references its table, because
 * the mistake is the block's and the reference is what lets the table say
 * which notes show it. Several blocks naming one table are one reference.
 */

const CONTAINER = String.raw`(?:[ \t]*(?:>[ \t]?|(?:[-*+]|\d{1,9}[.)])[ \t]+))*[ \t]*`;
const OPENING = new RegExp(`^(${CONTAINER})(\`{3,}|~{3,})(.*?)\\s*$`);
const CLOSING = new RegExp(`^${CONTAINER}(\`{3,}|~{3,})[ \\t]*$`);
/** What a line inside a block may carry in front of its text, in a quote or a list. */
const LEAD = /^[ \t>]*/;

/** A fence indented by four or more, with nothing to contain it, is indented code. */
function indentedCode(lead: string): boolean {
  return /^[ \t]+$/.test(lead) && lead.replace(/\t/g, '    ').length >= 4;
}

function blockReference(lines: readonly string[]): string | null {
  const names: string[] = [];
  for (const line of lines) {
    const text = line.replace(LEAD, '');
    const colon = text.indexOf(':');
    if (colon < 0 || text.slice(0, colon).trim() !== 'table') continue;
    names.push(text.slice(colon + 1).trim());
  }
  const [name] = names;
  return names.length === 1 && name ? name.normalize('NFC') : null;
}

/** Compared after NFC with case folded (§5.9). */
export function tableNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}

export function tableReferences(markdown: string): string[] {
  const found = new Map<string, string>();
  let open: { char: string; length: number; table: boolean; lines: string[] } | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    if (open) {
      const closing = CLOSING.exec(line)?.[1];
      if (closing && closing[0] === open.char && closing.length >= open.length) {
        if (open.table) {
          const name = blockReference(open.lines);
          if (name && !found.has(tableNameKey(name))) found.set(tableNameKey(name), name);
        }
        open = null;
      } else {
        open.lines.push(line);
      }
      continue;
    }
    const match = OPENING.exec(line);
    if (!match || indentedCode(match[1] ?? '')) continue;
    const run = match[2] ?? '';
    open = {
      char: run[0] ?? '`',
      length: run.length,
      table: (match[3] ?? '').trim() === 'table',
      lines: [],
    };
  }
  return [...found.values()];
}
