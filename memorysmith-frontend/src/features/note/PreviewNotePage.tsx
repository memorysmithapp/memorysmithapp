import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNote,
  getNotebookFiles,
  getNotebookNames,
  getNotebookStructure,
} from '../../shared/api/source';
import { noteNameOf, splitFrontmatter } from '../../shared/api/markdown';
import { blockOf, isBlockAnchor, sectionOf } from '../../shared/api/transclusion';
import { queryKeys } from '../../shared/api/query-keys';
import { usePreferences } from '../../shared/store/preferences';
import { NotebookIdProvider } from '../../shared/components/notebook-id';
import { WritableContent } from '../../shared/components/WritableContent';
import {
  PropertyValue,
  orderedProperties,
  propertyLabel,
  propertyType,
} from '../../shared/components/PropertyValue';
import { useNotebookId } from '../structure/route-ids';
import { whenDrawn } from './drawn';

/**
 * Where the renderer of the server leaves what it asks this page to draw
 * (#260, RN-PRT-032), beside the session of the person it draws for.
 */
export const PREVIEW_STORAGE_KEY = 'memorysmith.preview';

/**
 * What a preview draws: a note already written, by its identifier, or a draft
 * not written yet, by its content — exactly one — with the folder a draft
 * would be written in, and a part, as a transclusion addresses one after its
 * `#`: `Section`, or `^block`.
 */
export interface PreviewRequest {
  readonly noteId: string | null;
  readonly content: string | null;
  readonly folderId: string | null;
  readonly part: string | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The request the storage holds, or null when it holds none this page can draw. */
export function readPreviewRequest(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): PreviewRequest | null {
  try {
    const kept = JSON.parse(storage?.getItem(PREVIEW_STORAGE_KEY) ?? 'null') as Record<
      string,
      unknown
    > | null;
    if (!kept || typeof kept !== 'object') return null;
    const request = {
      noteId: text(kept['noteId']),
      content: text(kept['content']),
      folderId: text(kept['folderId']),
      // With or without the `#` a transclusion writes before it.
      part: text(text(kept['part'])?.replace(/^#/, '')),
    };
    return (request.noteId === null) === (request.content === null) ? null : request;
  } catch {
    return null;
  }
}

/** What the page draws of a note: the whole of it, one part, or nothing it can find. */
export type PreviewDrawing =
  | {
      readonly kind: 'whole';
      readonly name: string | null;
      readonly properties: ReadonlyArray<readonly [string, string]>;
      readonly lists: ReadonlySet<string>;
      readonly raw: string;
    }
  | { readonly kind: 'part'; readonly raw: string }
  | { readonly kind: 'missing'; readonly part: string };

/**
 * A whole note is drawn as its page draws it: its name, its properties and its
 * body. A part is drawn as a transclusion of it is, alone, cut out of the body
 * by the same rule — a heading and what is under it, or the block carrying the
 * identifier.
 */
export function previewOf(raw: string, part: string | null, name: string | null): PreviewDrawing {
  const { frontmatter, lists, body } = splitFrontmatter(raw);
  if (part === null) {
    return {
      kind: 'whole',
      name,
      properties: orderedProperties(
        Object.entries(frontmatter).filter(([, value]) => value !== ''),
      ),
      lists,
      raw,
    };
  }
  const cut = isBlockAnchor(part) ? blockOf(body, part.slice(1)) : sectionOf(body, part);
  return cut === null ? { kind: 'missing', part } : { kind: 'part', raw: cut };
}

/** The note or the part as the reading surface of the note page draws it. */
export function NotePreview({
  notebookId,
  drawing,
  invalidates,
}: {
  notebookId: string;
  drawing: PreviewDrawing;
  invalidates: ReturnType<typeof queryKeys.note>;
}) {
  const { t } = useTranslation();
  if (drawing.kind === 'missing') {
    return (
      <p className="embed-missing">{t('note.embedSectionMissing', { section: drawing.part })}</p>
    );
  }
  const content = (
    <WritableContent
      raw={drawing.raw}
      notebookId={notebookId}
      baseRevision={null}
      writable={false}
      write={() => Promise.reject(new Error('A preview writes nothing.'))}
      invalidates={invalidates}
    />
  );
  if (drawing.kind === 'part') return content;
  return (
    <>
      <h1 className={drawing.name === null ? 'note-unnamed' : undefined}>
        {drawing.name ?? t('note.unnamed')}
      </h1>
      {drawing.properties.length > 0 ? (
        <details className="properties-box" open>
          <summary>{t('note.properties')}</summary>
          <div className="metadata-container">
            {drawing.properties.map(([key, value]) => (
              <div
                className="metadata-property"
                data-property-type={propertyType(value, drawing.lists.has(key))}
                key={key}
              >
                <span className="metadata-property-key">{propertyLabel(key, t)}</span>
                <span className="metadata-property-value">
                  <PropertyValue
                    value={value}
                    list={drawing.lists.has(key)}
                    notebookId={notebookId}
                  />
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {content}
    </>
  );
}

/**
 * A note, a draft or a part of either, drawn for an agent to see (#260,
 * RN-PRT-032).
 *
 * It is opened by the renderer of the server, never from the interface: the
 * renderer puts the session of the person the connector acts for and what to
 * draw in the storage of the browser, opens this page at the reading width,
 * and captures `.note-preview` once it says it is ready. So what the agent
 * sees is what the person reads — the same reading surface, resolving links
 * and embeds against the same notebook — in the light theme, outside the
 * frame of the application, which an agent has no use for.
 *
 * A draft is drawn in the notebook it would be written in, so `[[a note]]`
 * reaches what it would reach there. Resolving a link reads the whole
 * notebook, so the folder of a draft decides nothing of the drawing, and it is
 * checked to be a folder of the notebook all the same: a draft meant for a
 * folder that is not there is not a draft that can be written.
 *
 * When there is nothing to draw, the element says why in `data-failure`,
 * which the renderer answers with: the note or the folder is not there to read
 * (`NOT_FOUND`), or the note holds no such part (`PART_NOT_FOUND`).
 */
export function PreviewNotePage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const [request] = useState(() => readPreviewRequest());
  const setPaper = usePreferences((s) => s.setPaper);
  const client = useQueryClient();
  const drawn = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);

  // An image an agent reads is the light theme, whatever the person chose.
  useEffect(() => {
    setPaper(true);
    return () => setPaper(false);
  }, [setPaper]);

  // What the body resolves against is read before it is drawn: a link drawn
  // before the names arrive is drawn as pending.
  const enabled = notebookId !== '' && request !== null;
  const noteId = request?.noteId ?? null;
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
    enabled: enabled && noteId !== null,
  });

  const queries = noteId === null ? [structure, names, files] : [structure, names, files, note];
  const loaded = enabled && queries.every((query) => query.isSuccess);
  const folderMissing =
    loaded &&
    request.folderId !== null &&
    !structure.data?.folders.some(
      (folder) => folder.id.toUpperCase() === request.folderId?.toUpperCase(),
    );
  const raw = noteId === null ? (request?.content ?? null) : (note.data?.raw ?? null);
  const drawing =
    loaded && raw !== null && !folderMissing
      ? previewOf(raw, request.part, noteId === null ? noteNameOf(raw) : (note.data?.name ?? null))
      : null;

  const failure =
    !enabled || queries.some((query) => query.isError) || folderMissing
      ? 'NOT_FOUND'
      : drawing?.kind === 'missing'
        ? 'PART_NOT_FOUND'
        : null;

  // Drawn once: what the page was asked to draw never changes while it is open.
  const drawable = drawing !== null && drawing.kind !== 'missing';
  useEffect(() => {
    if (!drawable) return;
    let alive = true;
    void whenDrawn(drawn.current, client).then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [drawable, client]);

  return (
    <NotebookIdProvider notebookId={notebookId}>
      <div className="preview-page">
        <article
          ref={drawn}
          className="note-preview content-pane"
          data-ready={ready && failure === null ? 'true' : undefined}
          data-failure={failure ?? undefined}
        >
          {failure === 'NOT_FOUND' ? (
            <p className="status">{t('common.notFound')}</p>
          ) : drawing ? (
            <NotePreview
              notebookId={notebookId}
              drawing={drawing}
              invalidates={queryKeys.note(notebookId, noteId)}
            />
          ) : null}
        </article>
      </div>
    </NotebookIdProvider>
  );
}
