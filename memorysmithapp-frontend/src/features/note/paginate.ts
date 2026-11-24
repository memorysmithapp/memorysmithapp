/**
 * The pages a printed note is laid on (#258), drawn in the tab before the
 * print, as the print will lay them.
 *
 * A stylesheet cannot paginate a screen: the browser divides a document into
 * pages only while it prints, so a note drawn for paper used to read as one
 * long sheet, and where a page ended was seen only in the dialog. Paged.js lays
 * the content into A4 page boxes in the page itself — the size and margins of
 * the sheet, the orientation, the breaks before and after a part, a block kept
 * whole — and those boxes are what the tab shows and what the printer gets,
 * the print included: they come out one per sheet.
 *
 * What it reads is the note as the reading surface drew it, off screen, at the
 * width of the paper less its margins; it lays a COPY of it, so the drawn note
 * stays where tables are measured and diagrams were drawn. The library is
 * loaded here, by the one page that uses it.
 */

import type { PrintOrientation as Orientation } from '@memorysmithapp/contracts';

/** The sheet and its margins: the same numbers the stylesheet lays the drawn note at. */
export const PAGE_MARGINS = '18mm 16mm 20mm';

/**
 * The rules only the paginator reads: the page box, the break before the
 * properties at the end, on a page of their own, and the page each entry of a
 * contents lands on, at its right (#521), a dotted line leading to it (#539),
 * and, when the style asks, a page for each list of a contents and for what
 * follows it (#542). A block kept whole and a heading never alone at the foot
 * of a page are read from the stylesheet of the application, which applies to
 * the copy.
 */
export function pageRules(
  orientation: Orientation,
  appendices: Appendices | null,
  contentsPages: boolean,
): string {
  return `
@page { size: A4 ${orientation}; margin: ${PAGE_MARGINS}; }
.print-end { break-before: page; }
${CONTENTS_ENTRIES}
${contentsPages ? CONTENTS_PAGES : ''}
${appendices ? appendixRules(appendices) : ''}`;
}

/**
 * An entry of a contents as a printed table of contents reads (#545): its
 * number on the first line, in a column as wide as the widest number of its
 * level, the text beside it and every line of it under its first word, left
 * aligned whatever the note's alignment; the dotted line from the last word of
 * the last line to the page, at the right in a column of its own.
 *
 * The entry is inline, so its text flows as text: the dotted line hangs off
 * the end of its last line (`left: 100%` of an inline is where its last line
 * ends) and is cut at the page column by its item, and the page is a float of
 * no width on that last line, over the dotted line. The widths of the number
 * column come from the drawn note (`hangContents`); with none, an entry has no
 * column and wraps under its start.
 */
const CONTENTS_ENTRIES = `
.contents-item { overflow: hidden; text-align: left; hyphens: manual; padding-inline-start: var(--contents-indent, 0px); text-indent: calc(-1 * var(--contents-indent, 0px)); padding-inline-end: 2.5em; }
.contents-item .contents-entries { text-indent: 0; clear: right; margin-inline-end: -2.5em; }
.contents-entry { position: relative; }
.contents-entry > .contents-number { display: inline-block; min-width: var(--contents-number, 0px); text-indent: 0; white-space: nowrap; }
.contents-entry::before { content: ""; position: absolute; left: 100%; bottom: 0.3em; width: 100vw; margin-left: 0.25em; border-bottom: 1px dotted currentColor; opacity: 0.6; }
.contents-entry::after { content: target-counter(attr(href url), page); float: right; width: 2.5em; margin-right: -2.5em; text-align: right; text-indent: 0; background: #fff; position: relative; z-index: 1; }
`;

/** What `hangContents` reads of a laid-out entry, in pixels. */
export interface ContentsMeasure {
  /** The width of an entry's number. */
  number(element: Element): number;
  /** The width of the space between a number and its text. */
  gap(element: Element): number;
}

const SPACE_FALLBACK = 4;

const laidOut: ContentsMeasure = {
  number: (element) => element.getBoundingClientRect().width,
  gap: (element) => {
    const space = element.nextSibling;
    if (!space || space.nodeType !== Node.TEXT_NODE || !space.textContent) return SPACE_FALLBACK;
    const range = document.createRange();
    range.setStart(space, 0);
    range.setEnd(space, 1);
    return range.getBoundingClientRect().width || SPACE_FALLBACK;
  },
};

/** Room between the number column and the text, beyond the space between them. */
const NUMBER_ROOM = 6;

/**
 * Gives each level of each contents of the copy the width of its number
 * column, measured on the drawn note, which is laid out at the width of the
 * paper (#545): a stylesheet cannot size a column to its widest cell when the
 * cells are not in one box. The copy is a deep clone, so its lists come in the
 * same order as the drawn ones.
 */
export function hangContents(
  drawn: ParentNode,
  copy: ParentNode,
  measure: ContentsMeasure = laidOut,
): void {
  const copies = [...copy.querySelectorAll('.contents-entries')];
  [...drawn.querySelectorAll('.contents-entries')].forEach((list, index) => {
    const numbers = [
      ...list.querySelectorAll(':scope > .contents-item > .contents-entry > .contents-number'),
    ];
    const target = copies[index] as HTMLElement | undefined;
    if (!target || numbers.length === 0) return;
    const column = Math.ceil(Math.max(...numbers.map(measure.number))) + NUMBER_ROOM;
    target.style.setProperty('--contents-number', `${column}px`);
    target.style.setProperty(
      '--contents-indent',
      `${column + Math.ceil(measure.gap(numbers[0] as Element))}px`,
    );
  });
}

/**
 * Each list of a contents on a page of its own, and the text after the
 * contents on the next (#542): a break before every list but the first, and
 * before whatever follows the contents, so a contents at the end of the note
 * leaves no blank page after it.
 */
const CONTENTS_PAGES = `
.contents-list + .contents-list { break-before: page; }
nav.contents + * { break-before: page; }
`;

/**
 * Tables printed as appendices at the end of the note (#494): each appendix on
 * a page of its own, a named page that turns as the notebook's style says, and
 * the reference left in a table's place says the page its appendix lands on,
 * counted by the paginator.
 */
export interface Appendices {
  readonly orientation: Orientation;
  /** What goes before the number of the page, in the reader's words: ", página ". */
  readonly pageWord: string;
}

function appendixRules({ orientation, pageWord }: Appendices): string {
  const word = pageWord.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `
@page appendix { size: A4 ${orientation}; margin: ${PAGE_MARGINS}; }
.table-appendix { page: appendix; break-before: page; }
.table-reference a::after { content: "${word}" target-counter(attr(href url), page); }
`;
}

interface Previewer {
  preview(
    content: Node,
    stylesheets: Array<string | Record<string, string>>,
    renderTo: HTMLElement,
  ): Promise<{ total: number }>;
  polisher: { destroy(): void };
}

let laid: Previewer | null = null;
/** The sheet of the appendices, set after the paginator's own rules (#494). */
let sheet: HTMLStyleElement | null = null;

/**
 * Paged.js turns the box a named page lays its content in, and leaves the
 * sheet under it the size of the first page; and the rules it inserts for the
 * print come after every stylesheet of the page, so they win over a named page
 * declared there. The appendices' sheet is therefore turned here, after the
 * lay-out, in a rule that comes last: the preview shows it turned, and
 * Chromium prints it on a page of that size, the server's PDF included.
 */
function turnAppendixSheet(appendices: Appendices | null): void {
  sheet?.remove();
  sheet = null;
  if (!appendices) return;
  const [width, height] =
    appendices.orientation === 'landscape' ? ['297mm', '210mm'] : ['210mm', '297mm'];
  sheet = document.createElement('style');
  sheet.dataset['appendixSheet'] = appendices.orientation;
  sheet.textContent = `
@page appendix-sheet { size: ${width} ${height}; margin: 0; }
.pagedjs_appendix_page {
  page: appendix-sheet !important;
  --pagedjs-width: ${width}; --pagedjs-height: ${height};
  --pagedjs-width-right: ${width}; --pagedjs-height-right: ${height};
  --pagedjs-width-left: ${width}; --pagedjs-height-left: ${height};
}
`;
  document.head.appendChild(sheet);
}
/** What the copy laid into the pages puts before every id of the note (#520). */
export const PRINTED_ID = 'printed-';

/** The attributes that name other elements by their ids, one or several. */
const ID_REFERENCES = ['aria-describedby', 'aria-labelledby'] as const;

/**
 * Gives the copy laid into the pages ids of its own (#520), and points every
 * link inside it that reaches one of them at the renamed one.
 *
 * The drawn note stays in the document, hidden from the print, with the same
 * ids; it comes first, and Chromium links a `#fragment` to the first element
 * of that id. So a footnote, a way back from one, or a heading named by a
 * link pointed at the hidden note, and the PDF got no destination for it.
 * Renamed, the ids of the pages are the only ones of their names, and each
 * link of the PDF lands on the page that shows its target. A link to anything
 * outside the note is left as it was.
 */
export function separateIds(content: ParentNode): void {
  const ids = new Set<string>();
  for (const element of content.querySelectorAll('[id]')) {
    ids.add(element.id);
    element.id = PRINTED_ID + element.id;
  }
  if (ids.size === 0) return;
  for (const link of content.querySelectorAll('a[href^="#"]')) {
    const fragment = link.getAttribute('href')?.slice(1) ?? '';
    if (ids.has(fragmentId(fragment))) link.setAttribute('href', `#${PRINTED_ID}${fragment}`);
  }
  for (const name of ID_REFERENCES) {
    for (const element of content.querySelectorAll(`[${name}]`)) {
      const named = (element.getAttribute(name) ?? '').split(/\s+/).filter(Boolean);
      element.setAttribute(name, named.map((id) => (ids.has(id) ? PRINTED_ID + id : id)).join(' '));
    }
  }
}

/** The id a fragment names, as the browser reads it: percent-decoded. */
function fragmentId(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** What `isTableTitle` reads of an element: enough to tell a title from a paragraph of text. */
export interface TitleCandidate {
  readonly tagName: string;
  readonly textContent: string | null;
  readonly children: ArrayLike<{ readonly tagName: string; readonly textContent: string | null }>;
}

/**
 * Whether an element stands as the title of the table right after it (#537):
 * a heading, or a paragraph that is only bold or italic words, as a person
 * writes `**Orçamento 2027**` over a table.
 */
export function isTableTitle(element: TitleCandidate): boolean {
  if (/^H[1-6]$/.test(element.tagName)) return true;
  if (element.tagName !== 'P') return false;
  const text = (element.textContent ?? '').trim();
  if (text === '' || element.children.length !== 1) return false;
  const only = element.children[0];
  return (
    only !== undefined &&
    ['STRONG', 'B', 'EM', 'I'].includes(only.tagName) &&
    (only.textContent ?? '').trim() === text
  );
}

/** The note's body: the inner `.markdown` the renderer lays the blocks in. */
function isBody(element: Element | null): boolean {
  return (
    element !== null &&
    element.classList.contains('markdown') &&
    element.parentElement?.closest('.markdown') !== null
  );
}

/**
 * The block of the note an overflow starts at: its ancestor right under the
 * note's body, or, when it starts between two blocks — in the body itself or
 * in the blank text between them — the block that comes next.
 */
function blockAt(overflow: Range): Element | null {
  let node: Node | null = overflow.startContainer;
  if (node instanceof Element && isBody(node)) node = node.childNodes[overflow.startOffset] ?? null;
  while (node && !(node instanceof Element) && isBody(node.parentElement)) node = node.nextSibling;
  let element: Element | null = node instanceof Element ? node : (node?.parentElement ?? null);
  while (element && !isBody(element.parentElement)) element = element.parentElement;
  return element;
}

/**
 * Where a page breaks when it would leave a table's head at its foot (#537):
 * the overflow starts at a table's block, or inside it, before any row of its
 * body ended on the page — so its header, or the title right above it, would
 * stand alone there. The break moves before the table, and before its title
 * when it has one, so they go to the next page with the first rows. A table
 * or a title that opens its page stays: moving it would only move the same
 * break along.
 */
export function keepTitleWithTable(overflow: Range): Range | undefined {
  const block = blockAt(overflow);
  const table = block?.matches('table') ? block : block?.querySelector('table');
  if (!block || !table) return undefined;
  // A row of the body is on the page only when it ends before the overflow:
  // an overflow inside the first row leaves the header alone under the title.
  const firstRow = table.querySelector('tbody tr');
  if (firstRow && overflow.comparePoint(firstRow, firstRow.childNodes.length) < 0) return undefined;
  const title = block.previousElementSibling;
  const moved = title && isTableTitle(title) ? title : block;
  if (!moved.previousElementSibling) return undefined;
  const range = overflow.cloneRange();
  range.setStartBefore(moved);
  return range;
}

let handlersRegistered = false;

let queue: Promise<unknown> = Promise.resolve();

/**
 * Lays the parts drawn in `source` into pages inside `target`, answering how
 * many pages they took. One lay-out runs at a time, and each replaces the one
 * before — its pages and the styles it inserted — so turning the sheet or
 * moving the properties never leaves the pages of an earlier choice behind.
 */
export function paginate(
  source: HTMLElement,
  target: HTMLElement,
  orientation: Orientation,
  appendices: Appendices | null = null,
  contentsPages = false,
): Promise<number> {
  const run = queue.then(async () => {
    const { Previewer, Handler, registerHandlers } = (await import('pagedjs')) as unknown as {
      Previewer: new () => Previewer;
      Handler: new (...args: unknown[]) => object;
      registerHandlers: (...handlers: unknown[]) => void;
    };
    if (!handlersRegistered) {
      // A table's title never ends a page above the table's rows (#537).
      class KeepTitleWithTable extends Handler {
        onOverflow(overflow: Range | undefined): Range | undefined {
          return overflow ? keepTitleWithTable(overflow) : undefined;
        }
      }
      registerHandlers(KeepTitleWithTable);
      handlersRegistered = true;
    }
    laid?.polisher.destroy();
    target.replaceChildren();

    const content = document.createDocumentFragment();
    for (const part of source.children) content.appendChild(part.cloneNode(true));
    separateIds(content);
    hangContents(source, content);

    const previewer = new Previewer();
    laid = previewer;
    turnAppendixSheet(null);
    const flow = await previewer.preview(
      content,
      [{ [window.location.href]: pageRules(orientation, appendices, contentsPages) }],
      target,
    );
    turnAppendixSheet(appendices);
    return flow.total;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Takes the pages and their styles away, when the page that drew them goes. */
export function unpaginate(target: HTMLElement | null): void {
  turnAppendixSheet(null);
  laid?.polisher.destroy();
  laid = null;
  target?.replaceChildren();
}
