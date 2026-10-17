import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rendersAs, type NotebookFileDto, type NoteRefDto } from '@memorysmithapp/contracts';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { useDocumentTitle } from '../../shared/components/document-title';
import { getNotebookAttachments } from '../../shared/api/backend';
import { getNotebookFiles, linkToFile } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { noteAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { useLiveInterval } from '../../shared/api/live';
import { fileKind } from '../../shared/components/file-kind';
import { formatBytes } from '../../shared/components/StorageBar';
import { Modal } from '../../shared/components/Modal';
import { SkeletonBar, SkeletonRegion } from '../../shared/components/Skeleton';
import { DownloadIcon, FileIcon } from '../../shared/components/icons';
import { intlLocale } from '../../i18n/intl-locale';

/**
 * The files a notebook keeps, together (#307, RN-DSC-066).
 *
 * A file used to be seen only inside a note that draws it, so one no note
 * draws — a source PDF, the raw version of a figure — was found only by asking
 * an agent. Now that a person attaches and resizes files from the editor, the
 * notebook lists them on a page of its own: each with what it is, a preview
 * when it is an image, a download, and the notes that show it.
 *
 * What a file is comes from Knowledge, which keeps it; which notes show it
 * comes from Discovery, which reads the notes. The page only joins the two by
 * name, the address a note reaches a file by (§5.8). Nothing is changed from
 * here: it is a page to read, open to every role that reads the notebook.
 */
export function AttachmentsPage() {
  const { t, i18n } = useTranslation();
  // The language of the interface is `pt_BR`; `Intl` reads `pt-BR`.
  const locale = intlLocale(i18n.language);
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const live = useLiveInterval();
  const [zoom, setZoom] = useState<{ file: NotebookFileDto; url: string } | null>(null);

  useDocumentTitle(t('attachments.heading'), structure.notebook.name);

  const files = useQuery({
    queryKey: queryKeys.notebookFiles(notebookId),
    refetchInterval: live,
    queryFn: () => getNotebookFiles(notebookId),
  });
  const uses = useQuery({
    queryKey: queryKeys.notebookAttachments(notebookId),
    refetchInterval: live,
    queryFn: () => getNotebookAttachments(notebookId),
  });

  /** The notes showing each file, by its name in NFC, as Discovery compares it. */
  const showing = useMemo(
    () => new Map((uses.data ?? []).map((use) => [use.name.normalize('NFC'), use.notes] as const)),
    [uses.data],
  );
  const sorted = useMemo(
    () =>
      [...(files.data ?? [])].sort((left, right) => left.name.localeCompare(right.name, locale)),
    [files.data, locale],
  );

  return (
    <>
      <NotebookBar crumbs={[{ label: t('attachments.heading') }]} />
      <article className="content-pane attachments-page">
        <p className="page-intro">{t('attachments.intro')}</p>
        {files.isError ? (
          <p className="status">{t(messageKeyOf(files.error))}</p>
        ) : !files.data ? (
          <SkeletonRegion>
            <ul className="row-card attachment-list">
              {[0, 1, 2].map((index) => (
                <li key={index} className="attachment-row">
                  <SkeletonBar width="56px" height="56px" />
                  <span className="attachment-text">
                    <SkeletonBar width="40%" />
                    <SkeletonBar width="70%" height="0.8rem" />
                  </span>
                </li>
              ))}
            </ul>
          </SkeletonRegion>
        ) : sorted.length === 0 ? (
          <p>{t('attachments.none')}</p>
        ) : (
          <>
            <p className="attachment-count">{t('attachments.count', { count: sorted.length })}</p>
            <ul className="row-card attachment-list">
              {sorted.map((file) => (
                <AttachmentRow
                  key={file.fileId}
                  notebookId={notebookId}
                  file={file}
                  notes={uses.data ? (showing.get(file.name.normalize('NFC')) ?? []) : null}
                  usesFailed={uses.isError}
                  locale={locale}
                  onZoom={(url) => setZoom({ file, url })}
                />
              ))}
            </ul>
          </>
        )}
      </article>
      <Modal
        open={zoom !== null}
        title={zoom?.file.name ?? ''}
        {...(zoom?.file.description ? { subtitle: zoom.file.description } : {})}
        className="attachment-zoom-dialog"
        onClose={() => setZoom(null)}
      >
        {zoom ? (
          <img className="attachment-zoom" src={zoom.url} alt={zoom.file.description} />
        ) : null}
      </Modal>
    </>
  );
}

function AttachmentRow({
  notebookId,
  file,
  notes,
  usesFailed,
  locale,
  onZoom,
}: {
  notebookId: string;
  file: NotebookFileDto;
  /** `null` while Discovery has not answered. */
  notes: readonly NoteRefDto[] | null;
  usesFailed: boolean;
  locale: string;
  onZoom: (url: string) => void;
}) {
  const { t } = useTranslation();
  const image = rendersAs(file.mimeType) === 'image';
  const link = useQuery({
    queryKey: queryKeys.fileLink(notebookId, file.fileId),
    queryFn: () => linkToFile(notebookId, file.fileId),
    // A link lasts an hour; asking again halfway through is cheaper than
    // finding out it expired while somebody was reading.
    staleTime: 30 * 60 * 1000,
  });
  const download = t('attachments.download');

  return (
    <li className="attachment-row">
      {image && link.data ? (
        <button
          type="button"
          className="attachment-thumb"
          title={t('attachments.enlarge')}
          aria-label={`${t('attachments.enlarge')}: ${file.name}`}
          onClick={() => onZoom(link.data.url)}
        >
          <img src={link.data.url} alt={file.description} loading="lazy" />
        </button>
      ) : (
        <span className="attachment-thumb is-file" aria-hidden="true">
          <FileIcon width={22} height={22} />
        </span>
      )}
      <div className="attachment-text">
        <span className="attachment-name">{file.name}</span>
        <span className="attachment-meta">
          {fileKind(t, file.mimeType)} · {formatBytes(file.bytes, locale)}
        </span>
        {file.description ? <span className="attachment-desc">{file.description}</span> : null}
        <div className="attachment-notes">
          {notes === null ? (
            usesFailed ? (
              <span className="attachment-notes-none">{t('attachments.notesUnknown')}</span>
            ) : (
              <SkeletonBar width="9rem" height="0.8rem" />
            )
          ) : notes.length === 0 ? (
            <span className="attachment-notes-none">{t('attachments.shownByNone')}</span>
          ) : (
            <>
              <span className="attachment-notes-label">
                {t('attachments.shownBy', { count: notes.length })}
              </span>
              <ul className="attachment-note-links">
                {notes.map((note) => (
                  <li key={note.noteId}>
                    <Link to={noteAddress(notebookId, note.noteId)}>
                      {note.name || t('note.unnamed')}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      {link.data ? (
        <a
          className="button is-quiet is-small attachment-download"
          href={link.data.downloadUrl}
          download={file.name}
          title={download}
          aria-label={`${download}: ${file.name}`}
        >
          <DownloadIcon />
          <span className="attachment-download-label">{download}</span>
        </a>
      ) : null}
    </li>
  );
}
