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
 * The rules only the paginator reads: the page box, and the breaks between the
 * parts — the cover on a page of its own, the properties at the end on one of
 * theirs. A block kept whole and a heading never alone at the foot of a page
 * are read from the stylesheet of the application, which applies to the copy.
 */
function pageRules(orientation: Orientation, appendices: Appendices | null): string {
  return `
@page { size: A4 ${orientation}; margin: ${PAGE_MARGINS}; }
.print-cover { break-after: page; }
.print-end { break-before: page; }
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
    const { Previewer } = (await import('pagedjs')) as unknown as {
      Previewer: new () => Previewer;
    };
    laid?.polisher.destroy();
    target.replaceChildren();

    const content = document.createDocumentFragment();
    for (const part of source.children) content.appendChild(part.cloneNode(true));

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
