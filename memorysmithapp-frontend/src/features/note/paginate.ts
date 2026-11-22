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
 * contents lands on, at its right (#521). A block kept whole and a heading never alone at the foot of a page
 * are read from the stylesheet of the application, which applies to the copy.
 */
function pageRules(orientation: Orientation, appendices: Appendices | null): string {
  return `
@page { size: A4 ${orientation}; margin: ${PAGE_MARGINS}; }
.print-end { break-before: page; }
.contents-entry { display: flex; gap: 0.5em; }
.contents-entry::after { content: target-counter(attr(href url), page); margin-left: auto; }
${appendices ? appendixRules(appendices) : ''}`;
}

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
 * Where a page breaks when it would leave a table's title at its foot (#537):
 * the overflow starts inside a table, or at the block that holds it, before
 * any row of its body made it onto the page, and the block before is the
 * table's title, which then goes to the next page with the table. A title
 * that opens its page stays: moving it would only move the same break along.
 */
export function keepTitleWithTable(overflow: Range): Range | undefined {
  const block = blockAt(overflow);
  const table = block?.matches('table') ? block : block?.querySelector('table');
  if (!block || !table) return undefined;
  const firstRow = table.querySelector('tbody tr');
  if (firstRow && overflow.comparePoint(firstRow, 0) < 0) return undefined;
  const title = block.previousElementSibling;
  if (!title || !isTableTitle(title) || !title.previousElementSibling) return undefined;
  const moved = overflow.cloneRange();
  moved.setStartBefore(title);
  return moved;
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

    const previewer = new Previewer();
    laid = previewer;
    turnAppendixSheet(null);
    const flow = await previewer.preview(
      content,
      [{ [window.location.href]: pageRules(orientation, appendices) }],
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
