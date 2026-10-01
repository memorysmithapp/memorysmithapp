import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
 * Paper is white whatever theme the reader chose, so the page turns the light
 * theme on while it is open and gives the choice back when it closes.
 */
export function PrintNotePage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const noteId = identifierOf(useParams().noteId);
  const setPaper = usePreferences((s) => s.setPaper);
  const client = useQueryClient();
  const sheet = useRef<HTMLElement>(null);
  const [drawn, setDrawn] = useState(false);
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
    void whenDrawn(sheet.current, client).then(() => {
      if (alive) setDrawn(true);
    });
    return () => {
      alive = false;
    };
  }, [ready, client]);

  /**
   * A table that shrinks is measured on the sheet as the screen draws it, and
   * the sheet is the width of the paper less its margins, in the type the paper
   * is printed in, so what fits here fits there.
   */
  useLayoutEffect(() => {
    fitTables(sheet.current, fit);
  }, [fit, orientation, placement, drawn, note.data]);

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

  return (
    <NotebookIdProvider notebookId={notebookId}>
      {/* The sheet the browser lays the page on. It is a rule of the page and
          not of the stylesheet, because the person turns it. */}
      <style>{`@page { size: A4 ${orientation}; margin: 18mm 16mm 20mm; }`}</style>
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
                rememberPropertyPlacement(next);
              }}
              options={[
                { value: 'cover', label: t('print.placement.cover') },
                { value: 'end', label: t('print.placement.end') },
                { value: 'none', label: t('print.placement.none') },
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
                rememberTableFit(next);
              }}
              options={[
                { value: 'wrap', label: t('print.fit.wrap') },
                { value: 'shrink', label: t('print.fit.shrink') },
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
                rememberOrientation(next);
              }}
              options={[
                { value: 'portrait', label: t('print.orient.portrait') },
                { value: 'landscape', label: t('print.orient.landscape') },
              ]}
            />
          </div>
          <p className="print-hint">{t('print.hint')}</p>
          <button type="button" className="button is-quiet" onClick={() => window.close()}>
            {t('common.close')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={!drawn}
            onClick={() => window.print()}
          >
            {t('print.print')}
          </button>
        </div>
        {!ready || !data ? (
          <article className="print-sheet content-pane">
            <NoteSkeleton />
          </article>
        ) : (
          <>
            {/* The properties take a sheet of their own, before the text or
                after it, with the name of the note above them. */}
            {placement === 'cover' && box ? (
              <article className="print-sheet print-properties print-cover content-pane">
                {title}
                {box}
              </article>
            ) : null}
            <article
              className="print-sheet content-pane"
              ref={sheet}
              data-placement={placement}
              data-tables={fit}
              data-ready={drawn || undefined}
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
              <article className="print-sheet print-properties print-end content-pane">
                <h2>{name}</h2>
                {box}
              </article>
            ) : null}
          </>
        )}
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
 * only the drawn table knows how much wider than the sheet it is.
 */
function fitTables(root: HTMLElement | null, fit: TableFit): void {
  if (!root) return;
  for (const table of root.querySelectorAll<HTMLTableElement>('table')) {
    table.style.fontSize = '';
    table.classList.remove('is-wrapped');
    if (fit !== 'shrink') continue;
    const room = table.parentElement?.clientWidth ?? 0;
    if (room <= 0 || table.scrollWidth <= room) continue;
    // The type shrinks and the padding of the cells does not, so one
    // measurement undershoots: measure again until it fits or reaches the floor.
    let scale = 1;
    for (let pass = 0; pass < 6 && table.scrollWidth > room; pass++) {
      scale = Math.max(SMALLEST_TABLE, scale * (room / table.scrollWidth) * 0.98);
      table.style.fontSize = `${Math.floor(scale * 100)}%`;
      if (scale === SMALLEST_TABLE) break;
    }
    if (table.scrollWidth > room) table.classList.add('is-wrapped');
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
