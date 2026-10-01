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

import type { Orientation } from '../../shared/store/print-layout';

/** The sheet and its margins: the same numbers the stylesheet lays the drawn note at. */
export const PAGE_MARGINS = '18mm 16mm 20mm';

/**
 * The rules only the paginator reads: the page box, and the breaks between the
 * parts — the cover on a page of its own, the properties at the end on one of
 * theirs. A block kept whole and a heading never alone at the foot of a page
 * are read from the stylesheet of the application, which applies to the copy.
 */
function pageRules(orientation: Orientation): string {
  return `
@page { size: A4 ${orientation}; margin: ${PAGE_MARGINS}; }
.print-cover { break-after: page; }
.print-end { break-before: page; }
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
    const flow = await previewer.preview(
      content,
      [{ [window.location.href]: pageRules(orientation) }],
      target,
    );
    return flow.total;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Takes the pages and their styles away, when the page that drew them goes. */
export function unpaginate(target: HTMLElement | null): void {
  laid?.polisher.destroy();
  laid = null;
  target?.replaceChildren();
}
