import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveInterval } from '../../shared/api/live';
import { useWriteStatus } from '../../shared/store/write-status';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNote, getTemplate } from '../../shared/api/source';
import type { FolderNode } from '../../shared/types/api';
import { NoteContent } from '../../shared/components/NoteContent';
import { NoteSkeleton } from '../../shared/components/skeletons';
import { useDocumentTitle } from '../../shared/components/document-title';
import { updateNote } from '../../shared/api/source';

import { orderedProperties } from '../../shared/components/PropertyValue';
import { HistoryIcon, PrinterIcon } from '../../shared/components/icons';
import { NoteHistoryDialog } from './NoteHistory';
import { queryKeys } from '../../shared/api/query-keys';
import { useNoteEditSession } from './edit-session';
import { newSessionId } from './note-saves';
import { folderTrailForNote } from '../structure/trail';
import { BarButton, BarLink, NotebookBar, folderCrumbs } from '../structure/NotebookBreadcrumb';
import { pdfAddress } from '../../shared/api/note-address';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';

export function NotePage({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  /** Whether an edit session is open, which pauses the reading of the note (#206). */
  const sessionOpen = useRef(false);
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  /**
   * Whether the history is open (#226). The history is mounted only while it
   * is: mounted eagerly, it asked the trail for every note anybody opened,
   * which is a request nobody wanted and, for the length of one defect, the
   * render that took the page down.
   */
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyButton = useRef<HTMLButtonElement>(null);

  /**
   * The note follows what somebody else writes (#206) — an agent through the
   * connector, most of the time — except while it is being edited here: the
   * editor holds the text it opened with, and a read landing under it would
   * swap the page the person is typing over.
   */
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.note(notebookId, noteId),
    queryFn: () => getNote(notebookId, noteId),
    refetchInterval: useLiveInterval(sessionOpen.current),
  });
  /**
   * Editing the note in place (#300): the switch at the top right of the note
   * opens an edit session for whoever may write, and a reader gets *Show* and
   * *Copy Markdown* there and no switch.
   */
  // A note is content: a content editor of a share writes it too (#350).
  const writable = structure.permissions.writeContent;
  /**
   * The context a save declares it was written against (RN-KNW-061): the
   * Guidance and the structure this page loaded, and the Template of the
   * note's folder, read here for the purpose.
   */
  const folder = data ? folderOf(structure.folders, data.folderId) : undefined;
  const template = useQuery({
    queryKey: queryKeys.template(notebookId, folder?.id),
    queryFn: () => getTemplate(notebookId, folder?.id ?? ''),
    enabled: writable && Boolean(folder?.hasTemplate),
  });
  const context =
    folder && (!folder.hasTemplate || template.data)
      ? {
          guidance: structure.guidanceRevision,
          template: folder.hasTemplate ? (template.data?.revision ?? null) : null,
          structure: structure.structureRevision,
        }
      : null;
  const { editing, open } = useNoteEditSession({
    notebookId,
    note: writable ? data : undefined,
    context,
  });
  sessionOpen.current = open;
  /**
   * The session the ticks of this visit carry (RN-AUD-013): ticking five boxes
   * is five revisions, and the history shows them as one entry.
   */
  const tickSession = useMemo(() => newSessionId(), [noteId]);

  /**
   * And when it does change under the reader, the page says so instead of
   * swapping the text silently. A revision this page wrote itself — an edit
   * session or a ticked box — is not news: a session marks its saves, and a
   * box leaves the write status saying it saved.
   */
  const seenRevision = useRef<string | null>(null);
  const ownWrite = useRef(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  useEffect(() => {
    if (open) ownWrite.current = true;
  }, [open]);
  useEffect(() => {
    seenRevision.current = null;
    setChangedElsewhere(false);
  }, [noteId]);
  useEffect(() => {
    if (!data) return;
    const before = seenRevision.current;
    seenRevision.current = data.revision;
    if (before === null || before === data.revision) return;
    const state = useWriteStatus.getState().state;
    if (!ownWrite.current && state === 'idle') setChangedElsewhere(true);
    ownWrite.current = false;
  }, [data]);

  // The tab names the note, with the same unnamed label the listing shows when
  // the note states no name (RN-DSC-058, RN-KNW-036).
  useDocumentTitle(data ? (data.name ?? t('note.unnamed')) : null, structure.notebook.name);

  // The trail of a note stops at the folder that holds it: the name of the
  // note is the title of the page, and the bar never repeats it (#225).
  const crumbs = folderCrumbs(notebookId, folderTrailForNote(structure.folders, noteId));

  if (isPending) {
    return (
      <>
        <NotebookBar crumbs={crumbs} />
        <NoteSkeleton />
      </>
    );
  }
  if (isError || !data) {
    return (
      <>
        <NotebookBar crumbs={crumbs} />
        <p className="status">{t('common.notFound')}</p>
      </>
    );
  }

  // The reserved keys first, in the order of the specification, then what the
  // notebook invented, in the order the note wrote it (RN-DSC-051). `name` is
  // drawn above as the name of the note and never as a property.
  const reading = editing?.mode !== 'edit';
  const properties = orderedProperties(
    Object.entries(data.frontmatter).filter(([, value]) => value !== ''),
  );
  const lists = new Set(data.listProperties);

  const title = (
    <>
      {/**
       * The frame draws the name of the note, ALWAYS, and every heading of
       * the body is an ordinary heading of the note, always (RN-DSC-054).
       * A heading never names a note, so there is nothing to decide here:
       * when the frontmatter states no name, the frame says so where the
       * name would be (RN-KNW-036).
       */}
      {/* In edit mode the editor draws the name as its title field. */}
      {reading ? (
        <h1 className={data.name === null ? 'note-title note-unnamed' : 'note-title'}>
          {data.name ?? t('note.unnamed')}
        </h1>
      ) : null}

      {changedElsewhere && reading && (
        <p className="note-changed" role="status">
          <span>{t('note.changedElsewhere')}</span>
          <button type="button" className="link-button" onClick={() => setChangedElsewhere(false)}>
            {t('note.changedElsewhereDismiss')}
          </button>
        </p>
      )}
    </>
  );
  // The renderer places the name and the properties, as a note's `properties`
  // block or the notebook's style says (#530); in edit mode the editor draws
  // the name as its title field and the properties as a form.
  const header = {
    title,
    properties: reading ? properties : [],
    lists,
    notebookId,
  };

  return (
    <>
      <NotebookBar crumbs={crumbs}>
        {/* What happened to this note, and the line each author left about
            it (RN-AUD-012): a question somebody asks, so it opens on demand. */}
        <BarButton
          ref={historyButton}
          icon={<HistoryIcon />}
          label={t('history.short')}
          title={t('history.heading')}
          onClick={() => setHistoryOpen(true)}
        />
        {/* The note's PDF, in a tab of its own that becomes the file (#522):
            every role that reads it prints it, from the browser's viewer. */}
        <BarLink
          icon={<PrinterIcon />}
          label={t('print.short')}
          title={t('print.open')}
          to={pdfAddress(notebookId, noteId)}
        />
      </NotebookBar>
      <article className="content-pane is-wide">
        <NoteContent
          raw={data.raw}
          notebookId={notebookId}
          noteId={data.id}
          baseRevision={data.revision}
          writable={writable}
          write={({ raw, baseRevision, keepalive }) =>
            updateNote(
              notebookId,
              data.id,
              { content: raw, baseRevision: baseRevision ?? '', session: tickSession },
              { keepalive: keepalive ?? false },
            )
          }
          invalidates={queryKeys.note(notebookId, noteId)}
          {...(editing ? { editing } : {})}
          header={header}
        />
      </article>
      <NoteHistoryDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        noteName={data.name ?? t('note.unnamed')}
        notebookId={notebookId}
        noteId={noteId}
        updatedAt={data.updatedAt}
        returnFocus={historyButton}
      />
    </>
  );
}

/** The folder of the tree with this identifier, at any depth. */
function folderOf(folders: readonly FolderNode[], folderId: string): FolderNode | undefined {
  for (const folder of folders) {
    if (folder.id === folderId) return folder;
    const found = folderOf(folder.children, folderId);
    if (found) return found;
  }
  return undefined;
}
