import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
import { WritableContent } from '../../shared/components/WritableContent';
import { NoteSkeleton } from '../../shared/components/skeletons';
import {
  PropertyValue,
  orderedProperties,
  propertyLabel,
  propertyType,
} from '../../shared/components/PropertyValue';
import { Segmented } from '../../shared/components/Segmented';
import {
  orientation as recalledOrientation,
  propertyPlacement,
  rememberOrientation,
  rememberPropertyPlacement,
  rememberTableFit,
  tableFit,
  type Orientation,
  type PropertyPlacement,
  type TableFit,
} from '../../shared/store/print-layout';
import { useNotebookId } from '../structure/route-ids';
import {
  CloseIcon,
  CoverPageIcon,
  EndPageIcon,
  LandscapeIcon,
  NoPropertiesIcon,
  PortraitIcon,
  PrinterIcon,
  ShrinkIcon,
  WrapTextIcon,
} from '../../shared/components/icons';
import { paginate, unpaginate } from './paginate';

/**
 * A note alone, drawn for paper (#258).
 *
 * **The browser prints, and the product draws the paper.** No PDF is made
 * here: the print dialog of every browser already saves one, and what it
 * saves is what the reading surface drew — mathematics, diagrams, highlighted
 * code and callouts — where a generator of our own would have had to draw all
 * of them a second time, and every difference would be a defect.
 *
 * The page opens in a tab of its own, outside the frame of the application,
 * with a bar that is never printed: where the properties of the note go, how a
 * wide table fits, which way the sheet lies, and the button that prints. The dialog is not opened by itself — the person
 * chooses first — and the button waits until everything that arrives late has
 * arrived: the names and the files the body resolves against, a picture, a
 * transclusion, a diagram. Printing before that prints a page with holes.
 *
 * **The tab is a preview of the print.** The note is drawn off screen, at the
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
  const [placement, setPlacement] = useState<PropertyPlacement>(propertyPlacement);
  const [fit, setFit] = useState<TableFit>(tableFit);
  const [orientation, setOrientation] = useState<Orientation>(recalledOrientation);

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
      void paginate(drawnNote, target, orientation).then(
        (total) => alive && setPages(total),
        () => alive && setPages(0),
      );
    });
    return () => {
      alive = false;
    };
  }, [drawn, placement, fit, orientation, revision]);

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

  const title = data ? (
    <h1 className={data.name === null ? 'note-unnamed' : undefined}>{name}</h1>
  ) : null;
  const shown = placement === 'none' ? [] : properties;
  const box =
    shown.length > 0 ? (
      <PropertiesBox properties={shown} lists={lists} notebookId={notebookId} />
    ) : null;

  const choice = (icon: ReactNode, label: string) => ({ icon, label });

  return (
    <NotebookIdProvider notebookId={notebookId}>
      <div className="print-page" data-orientation={orientation}>
        <div className="print-toolbar" role="toolbar" aria-label={t('print.toolbar')}>
          <div className="print-choice">
            <span className="print-choice-label" aria-hidden="true">
              {t('print.properties')}
            </span>
            <Segmented
              label={t('print.properties')}
              value={placement}
              onChange={(next) => {
                setPlacement(next);
                setPages(null);
                rememberPropertyPlacement(next);
              }}
              options={[
                { value: 'cover', ...choice(<CoverPageIcon />, t('print.placement.cover')) },
                { value: 'end', ...choice(<EndPageIcon />, t('print.placement.end')) },
                { value: 'none', ...choice(<NoPropertiesIcon />, t('print.placement.none')) },
              ]}
            />
          </div>
          <div className="print-choice">
            <span className="print-choice-label" aria-hidden="true">
              {t('print.tables')}
            </span>
            <Segmented
              label={t('print.tables')}
              value={fit}
              onChange={(next) => {
                setFit(next);
                setPages(null);
                rememberTableFit(next);
              }}
              options={[
                { value: 'wrap', ...choice(<WrapTextIcon />, t('print.fit.wrap')) },
                { value: 'shrink', ...choice(<ShrinkIcon />, t('print.fit.shrink')) },
              ]}
            />
          </div>
          <div className="print-choice">
            <span className="print-choice-label" aria-hidden="true">
              {t('print.orientation')}
            </span>
            <Segmented
              label={t('print.orientation')}
              value={orientation}
              onChange={(next) => {
                setOrientation(next);
                setPages(null);
                rememberOrientation(next);
              }}
              options={[
                { value: 'portrait', ...choice(<PortraitIcon />, t('print.orient.portrait')) },
                { value: 'landscape', ...choice(<LandscapeIcon />, t('print.orient.landscape')) },
              ]}
            />
          </div>
          <p className="print-hint">{t('print.hint')}</p>
          <div className="print-actions">
            <button
              type="button"
              className="button is-quiet"
              title={t('common.close')}
              onClick={() => window.close()}
            >
              <CloseIcon />
              <span className="print-action-label">{t('common.close')}</span>
            </button>
            <button
              type="button"
              className="button is-primary"
              title={t('print.print')}
              disabled={pages === null || pages === 0}
              onClick={() => window.print()}
            >
              <PrinterIcon />
              <span className="print-action-label">{t('print.print')}</span>
            </button>
          </div>
        </div>

        {/* The note as the reading surface draws it, at the width of the
            paper less its margins: what the pages are laid from, never seen. */}
        <div className="print-source" ref={source} aria-hidden="true">
          {data && ready ? (
            <>
              {placement === 'cover' && box ? (
                <article
                  key="cover"
                  className="print-part print-properties print-cover content-pane"
                >
                  {box}
                  {title}
                </article>
              ) : null}
              <article
                key="body"
                className="print-part content-pane"
                data-placement={placement}
                data-tables={fit}
              >
                {placement === 'cover' && box ? null : title}
                <WritableContent
                  raw={data.raw}
                  notebookId={notebookId}
                  baseRevision={data.revision}
                  writable={false}
                  write={() => Promise.reject(new Error('A page drawn for paper writes nothing.'))}
                  invalidates={queryKeys.note(notebookId, noteId)}
                />
              </article>
              {placement === 'end' && box ? (
                <article key="end" className="print-part print-properties print-end content-pane">
                  <h2>{name}</h2>
                  {box}
                </article>
              ) : null}
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
function fitTables(root: HTMLElement | null, fit: TableFit): void {
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

/** The properties of a note as the reading surface draws them, open and still. */
function PropertiesBox({
  properties,
  lists,
  notebookId,
}: {
  properties: ReadonlyArray<readonly [string, string]>;
  lists: Set<string>;
  notebookId: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="properties-box">
      <div className="metadata-container">
        {properties.map(([key, value]) => (
          <div
            className="metadata-property"
            data-property-type={propertyType(value, lists.has(key))}
            key={key}
          >
            <span className="metadata-property-key">{propertyLabel(key, t)}</span>
            <span className="metadata-property-value">
              <PropertyValue value={value} list={lists.has(key)} notebookId={notebookId} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Resolves once what arrives after the text has arrived, or after ten seconds
 * — a picture that never loads may not keep the dialog from ever opening.
 *
 * Drawn means: no request in flight (a link to a file, a transcluded note),
 * every picture decoded or failed, no diagram still drawing, and the fonts in.
 * It has to hold twice in a row, because a request that ends can start the
 * next one — a transclusion arrives and asks for the picture it embeds.
 */
async function whenDrawn(root: HTMLElement | null, client: QueryClient): Promise<void> {
  const deadline = Date.now() + 10_000;
  await document.fonts.ready;
  let quiet = 0;
  while (Date.now() < deadline) {
    const settled =
      client.isFetching() === 0 &&
      !root?.querySelector('.mermaid-loading, .attachment-loading, .skeleton') &&
      [...(root?.querySelectorAll('img') ?? [])].every((image) => image.complete);
    quiet = settled ? quiet + 1 : 0;
    if (quiet >= 2) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}
