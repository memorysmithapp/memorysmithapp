import { useEffect, useRef, useState } from 'react';
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
  propertyPlacement,
  rememberPropertyPlacement,
  type PropertyPlacement,
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
 * with a bar that is never printed: where the properties of the note go, and
 * the button that prints. The dialog is not opened by itself — the person
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

  function choose(next: PropertyPlacement) {
    setPlacement(next);
    rememberPropertyPlacement(next);
  }

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
      <div className="print-page">
        <div className="print-toolbar" role="toolbar" aria-label={t('print.toolbar')}>
          <Segmented
            label={t('print.properties')}
            value={placement}
            onChange={choose}
            options={[
              { value: 'side', label: t('print.placement.side') },
              { value: 'cover', label: t('print.placement.cover') },
              { value: 'end', label: t('print.placement.end') },
              { value: 'none', label: t('print.placement.none') },
            ]}
          />
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
            {/* A cover is a sheet of its own: the name and the properties,
                and the text starts on the next one. */}
            {placement === 'cover' && box ? (
              <article className="print-sheet print-cover content-pane">
                {title}
                {box}
              </article>
            ) : null}
            <article
              className="print-sheet content-pane"
              ref={sheet}
              data-placement={placement}
              data-ready={drawn || undefined}
            >
              {/* Floated before the name, so the name and the text run
                  beside it in the top-right corner of the first page. */}
              {placement === 'side' && box ? <aside className="print-side">{box}</aside> : null}
              {placement === 'cover' && box ? null : title}
              <WritableContent
                raw={data.raw}
                notebookId={notebookId}
                baseRevision={data.revision}
                writable={false}
                write={() => Promise.reject(new Error('A page drawn for paper writes nothing.'))}
                invalidates={queryKeys.note(notebookId, noteId)}
              />
              {placement === 'end' && box ? (
                <section className="print-end">
                  <h2>{t('note.properties')}</h2>
                  {box}
                </section>
              ) : null}
            </article>
          </>
        )}
      </div>
    </NotebookIdProvider>
  );
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
