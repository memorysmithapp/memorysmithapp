/**
 * Where a Markdown note holds code (MemorySmith Markdown Specification §3.6,
 * §3.7): the ranges no reader of the notation looks inside, because code is
 * where an author writes the notation without invoking it.
 *
 * It lives in the kernel because two readers ask it the same question:
 * Discovery, for the links a note writes, and the reader of parameter
 * references, which Portability fills in when a notebook is created from a
 * model (§7.14). One function answers both, so the two never disagree about
 * where code is.
 */

/**
 * What may stand in front of a fence on its line: the markers of the block
 * quotes and list items it is written in, and indentation.
 *
 * The specification lets a fence be indented up to three spaces RELATIVE TO
 * ITS CONTAINER, and this reader does not see containers. A fence inside a
 * list item sits two, four or six spaces in, and one inside a quote sits after
 * a `>`; refusing them would read every link in them as an edge. So whatever
 * a container may put before the fence is accepted, and the run itself has to
 * be the first thing on the line after it — which is what keeps a code span
 * showing three backticks in the middle of a sentence from opening anything.
 */
const CONTAINER = String.raw`(?:[ \t]*(?:>[ \t]?|(?:[-*+]|\d{1,9}[.)])[ \t]+))*[ \t]*`;
/** An opening fence: three or more of one character, then the info string. */
const OPENING_FENCE = new RegExp(`^(${CONTAINER})(\`{3,}|~{3,})(.*?)\r?$`);
/** A closing fence: a run and nothing after it but whitespace. */
const CLOSING_FENCE = new RegExp(`^${CONTAINER}(\`{3,}|~{3,})[ \t]*\r?$`);

interface OpenFence {
  readonly char: string;
  readonly length: number;
  readonly start: number;
}

/**
 * The half-open ranges of `markdown` that are code, in document order:
 * fenced blocks first, line by line, then the code spans of the lines no fence
 * holds.
 *
 * A fence closes only on a line holding a run of the SAME character, at least
 * as long as the one that opened it, and nothing else — so a longer outer
 * fence holds a shorter inner one, and a tilde fence holds backticks. A fence
 * that never closes runs to the end of the note, as it does on the page. A
 * line of backticks whose info string holds a backtick is not a fence at all,
 * and is read for spans like any other line.
 */
export function codeRanges(markdown: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let open: OpenFence | null = null;
  let at = 0;

  for (const line of markdown.split('\n')) {
    const end = at + line.length;
    if (open) {
      const run = CLOSING_FENCE.exec(line)?.[1];
      if (run && run[0] === open.char && run.length >= open.length) {
        ranges.push([open.start, end]);
        open = null;
      }
    } else {
      const fence = OPENING_FENCE.exec(line);
      const prefix = fence?.[1] ?? '';
      const run = fence?.[2] ?? '';
      const info = fence?.[3] ?? '';
      if (fence && !(run[0] === '`' && info.includes('`'))) {
        open = { char: run[0] ?? '`', length: run.length, start: at + prefix.length };
      } else {
        ranges.push(...codeSpans(line, at));
      }
    }
    at = end + 1;
  }

  if (open) ranges.push([open.start, markdown.length]);
  return ranges;
}

/**
 * The code spans of one line: a run of backticks closes on the next run of
 * EXACTLY its length, so `` ` ```mermaid ` `` is a span holding three
 * backticks and opens no fence. A run with no partner is literal text, and a
 * backtick escaped by a backslash opens nothing.
 *
 * A span is read inside its line. The specification lets one cross a line
 * break within a paragraph, and finding the paragraph needs the block context
 * this reader does not have; pairing a stray backtick with one paragraphs
 * later would erase every link in between, which is the expensive mistake.
 */
function codeSpans(line: string, offset: number): Array<[number, number]> {
  const runs = [...line.matchAll(/`+/g)].map((match) => {
    const index = match.index ?? 0;
    return { index, length: match[0].length };
  });
  const spans: Array<[number, number]> = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (!run) continue;
    // A backslash in front escapes ONE backtick, and the rest of the run may
    // still open a span.
    const escaped = /(^|[^\\])(\\\\)*\\$/.test(line.slice(0, run.index));
    const start = escaped ? run.index + 1 : run.index;
    const length = escaped ? run.length - 1 : run.length;
    if (length === 0) continue;

    const close = runs.findIndex((other, j) => j > i && other.length === length);
    if (close === -1) continue;
    const closing = runs[close];
    if (!closing) continue;
    spans.push([offset + start, offset + closing.index + closing.length]);
    i = close;
  }
  return spans;
}
