import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNote,
  getNotebookFiles,
  getNotebookNames,
  getNotebookStructure,
} from '../../shared/api/source';
import { identifierOf } from '../../shared/api/note-address';

import { queryKeys } from '../../shared/api/query-keys';
import { usePreferences } from '../../shared/store/preferences';
import { NotebookIdProvider } from '../../shared/components/notebook-id';
import { NoteContent, styleOfParts } from '../../shared/components/NoteContent';
import { NoteSkeleton } from '../../shared/components/skeletons';
import { orderedProperties } from '../../shared/components/PropertyValue';
import { DEFAULT_NOTEBOOK_STYLE } from '@memorysmithapp/contracts';
import { useNotebookId } from '../structure/route-ids';
import { paginate, unpaginate } from './paginate';
import { whenDrawn } from './drawn';

/**
 * A note alone, laid on A4 pages (#258): the page the server's browser opens
 * to make the note's PDF (#263, RN-PRT-031), and no longer a page of the
 * interface, which reaches the PDF through *Generate PDF* (#522).
 *
 * **The browser prints, and the product draws the paper.** What is printed is
 * what the reading surface drew — mathematics, diagrams, highlighted code and
 * callouts — where a generator of our own would have had to draw all of them a
 * second time, and every difference would be a defect. The server's browser
 * opens this page as the person who asked: one drawing, whoever prints it.
 *
 * Where the properties go, how a wide table fits and which way the sheet lies
 * are the notebook's style (#493), the same for everybody who prints the note,
 * the Reader of a share included. The pages are laid once everything that
 * arrives late has arrived — the names and the files the body resolves
 * against, a picture, a transclusion, a diagram — and `data-ready` says so to
 * the renderer, which prints nothing before it: printing before that prints a
 * page with holes.
 *
 * **The page lays the print.** The note is drawn off screen, at the
 * width of the paper less its margins — where a wide table is measured and a
 * diagram drawn — and then laid into A4 pages (paginate.ts), which are what the
 * tab shows and what the printer gets. On a phone the pages keep their size and
 * are scaled down to the width of the screen, as a reader of PDFs shows them.
 *
 * Paper is white whatever theme the reader chose, so the page turns the light
 * theme on while it is open and gives the choice back when it closes.
 */
export function PrintNotePage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const noteId = identifierOf(useParams().noteId);
  const setPaper = usePreferences((s) => s.setPaper);
  const client = useQueryClient();
  const source = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  /** The pages of the choices in force, or null while they are being laid. */
  const [pages, setPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setPaper(true);
    return () => setPaper(false);
  }, [setPaper]);

  // What the body resolves against is read into the page before it is drawn:
  // a picture drawn before the files arrive is drawn as a file that is missing.
  const enabled = notebookId !== '' && noteId !== null;
  const structure = useQuery({
    queryKey: queryKeys.notebookStructure(notebookId),
    queryFn: () => getNotebookStructure(notebookId),
    enabled,
  });
  const names = useQuery({
    queryKey: queryKeys.notebookNames(notebookId),
    queryFn: () => getNotebookNames(notebookId),
    enabled,
  });
  const files = useQuery({
    queryKey: queryKeys.notebookFiles(notebookId),
    queryFn: () => getNotebookFiles(notebookId),
    enabled,
  });
  const note = useQuery({
    queryKey: queryKeys.note(notebookId, noteId),
    queryFn: () => getNote(notebookId, noteId ?? ''),
    enabled,
  });

  // How the note is laid is the notebook's style (#493).
  const style = structure.data?.style ?? DEFAULT_NOTEBOOK_STYLE;
  // Where the notebook prints the properties of a note with no block of its
  // own (#530): what the drawn note says it is laid by, and laid again when it changes.
  const printedProperties =
    style.properties.print === 'none'
      ? 'none'
      : (style.properties.print?.place ?? style.properties.place ?? 'start');
  const drawingKey = JSON.stringify([style.properties, style.contents]);
  const fit = style.printTables === 'shrink' ? 'shrink' : 'wrap';
  const orientation = style.orientation;
  // Each table at the end, on a page of its own that turns as the style says (#494).
  const asAppendices = style.printTables === 'appendices';
  const appendixOrientation = style.appendixOrientation ?? orientation;
  const pageWord = t('print.appendixPage');

  const failed = !enabled || [structure, names, files, note].some((query) => query.isError);
  const ready = !failed && [structure, names, files, note].every((query) => query.isSuccess);
  const name = note.data ? (note.data.name ?? t('note.unnamed')) : null;

  /**
   * The title of the tab is what a browser names the PDF after, so it is the
   * name of the note and nothing else — not the product, not the environment.
   */
  useEffect(() => {
    if (!name) return;
    const before = document.title;
    document.title = name;
    return () => {
      document.title = before;
    };
  }, [name]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void whenDrawn(source.current, client).then(() => {
      if (alive) setDrawn(true);
    });
    return () => {
      alive = false;
    };
  }, [ready, client]);

  /**
   * The pages, laid again whenever what they show changes: the note, where its
   * properties go, how its tables fit, which way the sheet lies. A table that
   * shrinks is measured on the drawn note first, at the width the pages give it,
   * so what fits there fits on the page.
   */
  const revision = note.data?.revision;
  useEffect(() => {
    if (!drawn || !source.current || !preview.current) return;
    let alive = true;
    setPages(null);
    const drawnNote = source.current;
    const target = preview.current;
    // The choices just made are drawn in the next frame, and laid after it.
    requestAnimationFrame(() => {
      if (!alive) return;
      fitTables(drawnNote, fit);
      markPropertiesAtTheEnd(drawnNote);
      void paginate(
        drawnNote,
        target,
        orientation,
        asAppendices ? { orientation: appendixOrientation, pageWord } : null,
      ).then(
        (total) => alive && setPages(total),
        () => alive && setPages(0),
      );
    });
    return () => {
      alive = false;
    };
  }, [drawn, drawingKey, fit, orientation, asAppendices, appendixOrientation, pageWord, revision]);

  useEffect(() => () => unpaginate(preview.current), []);

  /**
   * On a screen narrower than the sheet, the pages are scaled down to its
   * width rather than reflowed: a page of A4 shows what a page of A4 holds.
   */
  useEffect(() => {
    const area = preview.current;
    if (!area) return;
    const sheetWidth = (orientation === 'landscape' ? 297 : 210) * (96 / 25.4);
    const measure = () => setScale(Math.min(1, (area.clientWidth - 16) / sheetWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [orientation]);

  if (failed) return <p className="status">{t('common.notFound')}</p>;

  const data = note.data;
  const properties = data
    ? orderedProperties(Object.entries(data.frontmatter).filter(([, value]) => value !== ''))
    : [];
  const lists = new Set(data?.listProperties ?? []);

  // The renderer places the name and the properties, as the note's
  // `properties` block, else the notebook's style, says for print (#530).
  const header = {
    title: data ? (
      <h1 className={data.name === null ? 'note-title note-unnamed' : 'note-title'}>{name}</h1>
    ) : null,
    properties,
    lists,
    notebookId,
    still: true,
  };

  return (
    <NotebookIdProvider notebookId={notebookId}>
      <div
        className="print-page"
        // The style reaches what the page lays apart from the note — the
        // properties on the last page — and the pages the
        // paginator copies them into, from here (#493, #497).
        style={styleOfParts(style)}
        data-orientation={orientation}
        {...(asAppendices ? { 'data-appendix-orientation': appendixOrientation } : {})}
      >
        {/* The note as the reading surface draws it, at the width of the
            paper less its margins: what the pages are laid from, never seen. */}
        <div className="print-source" ref={source} aria-hidden="true">
          {data && ready ? (
            <>
              <article
                key="body"
                className="print-part content-pane"
                data-placement={printedProperties}
                data-tables={fit}
              >
                <NoteContent
                  raw={data.raw}
                  notebookId={notebookId}
                  noteId={data.id}
                  baseRevision={data.revision}
                  writable={false}
                  write={() => Promise.reject(new Error('A page drawn for paper writes nothing.'))}
                  invalidates={queryKeys.note(notebookId, noteId)}
                  actions={false}
                  printing
                  tablesAsAppendices={asAppendices}
                  header={header}
                />
              </article>
            </>
          ) : null}
        </div>

        {pages === null ? (
          <div className="print-waiting">
            <NoteSkeleton />
          </div>
        ) : null}
        <div
          className="print-preview"
          ref={preview}
          data-pages={pages ?? undefined}
          data-ready={pages ? 'true' : undefined}
          style={{ '--preview-scale': scale } as CSSProperties}
        />
      </div>
    </NotebookIdProvider>
  );
}

/**
 * How small a table may shrink before it wraps instead: below this the type
 * stops being read, and a table that does not fit at it wraps its text.
 */
const SMALLEST_TABLE = 0.6;

/**
 * Fits every table of the sheet to its width. Wrapping is the stylesheet's
 * (`data-tables="wrap"`); shrinking is measured, a table at a time, because
 * only the drawn table knows how much wider than the sheet it is. Whatever is
 * still wider than the sheet after either breaks inside its words, which is
 * the last resort: it is what split "Kind" into three lines when it was the
 * first.
 */
function fitTables(root: HTMLElement | null, fit: 'wrap' | 'shrink'): void {
  if (!root) return;
  for (const table of root.querySelectorAll<HTMLTableElement>('table')) {
    table.style.fontSize = '';
    table.classList.remove('is-wrapped', 'is-broken');
    const room = table.parentElement?.clientWidth ?? 0;
    if (room <= 0) continue;
    const fits = () => table.scrollWidth <= room;
    if (fit === 'shrink' && !fits()) {
      // The type shrinks and the padding of the cells does not, so one
      // measurement undershoots: measure again until it fits or reaches the floor.
      let scale = 1;
      for (let pass = 0; pass < 6 && !fits(); pass++) {
        scale = Math.max(SMALLEST_TABLE, scale * (room / table.scrollWidth) * 0.98);
        table.style.fontSize = `${Math.floor(scale * 100)}%`;
        if (scale === SMALLEST_TABLE) break;
      }
      if (!fits()) table.classList.add('is-wrapped');
    }
    if (!fits()) table.classList.add('is-broken');
  }
}

/**
 * The properties the renderer drew at the end of the note (#530) open a page
 * of their own, as a colophon: they are what is left after the body, its
 * footnotes and its appendices aside.
 */
function markPropertiesAtTheEnd(root: HTMLElement | null): void {
  if (!root) return;
  for (const part of root.querySelectorAll<HTMLElement>('.note-properties')) {
    let next = part.nextElementSibling;
    while (next && !next.textContent?.trim()) next = next.nextElementSibling;
    const last = next === null || next.matches('.footnotes, .table-appendix, [role="status"]');
    part.classList.toggle('print-end', last && part.previousElementSibling !== null);
  }
}
