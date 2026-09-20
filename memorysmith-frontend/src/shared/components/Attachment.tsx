import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rendersAs, type NotebookFileDto } from '@memorysmith/contracts';
import { fileKept, linkToFile } from '../api/source';
import { queryKeys } from '../api/query-keys';

/**
 * A file of the notebook, shown where a note referenced it (#166).
 *
 * **Two shapes and not three.** What a browser draws without executing
 * anything is drawn — an image, audio, video — and everything else, the PDF
 * included, is a **card** with what it is and two verbs. A PDF *can* be
 * framed, and that is exactly why it is not: half the browsers of a phone
 * ignore the frame and offer a download instead, and a surface that works on
 * the machine it was built on and comes out a grey rectangle on somebody
 * else's is worse than a card that behaves the same everywhere.
 *
 * The bytes come from a link that is minted when this renders and that points
 * at the object store, never at the API: it carries its own authorisation, so
 * an `<img>` can follow it, and a file somebody uploaded is served from an
 * origin that is not the one the product runs in.
 */
export function Attachment({ notebookId, name }: { notebookId: string; name: string }) {
  const { t } = useTranslation();
  const file = fileKept(notebookId, name);

  const link = useQuery({
    queryKey: queryKeys.fileLink(notebookId, file?.fileId),
    queryFn: () => linkToFile(notebookId, file?.fileId ?? ''),
    enabled: file !== null,
    // A link lasts an hour; asking again halfway through is cheaper than
    // finding out it expired while somebody was reading.
    staleTime: 30 * 60 * 1000,
  });

  // A name the notebook keeps nothing under is reported the way a pending
  // link is: a notebook is read most while it is being written (§5.5).
  if (!file) {
    return (
      <span className="attachment-missing" title={t('note.attachmentMissing')}>
        {name}
      </span>
    );
  }

  const url = link.data?.url;
  if (!url) return <span className="attachment-loading">{file.name}</span>;

  const shape = rendersAs(file.mimeType);
  if (shape === 'image') {
    return <img className="attachment-image" src={url} alt={file.description || file.name} />;
  }
  if (shape === 'audio') {
    return <audio className="attachment-player" controls src={url} />;
  }
  if (shape === 'video') {
    return <video className="attachment-player" controls src={url} />;
  }
  return <AttachmentCard file={file} url={url} />;
}

/** What is not drawn: what it is, how big it is, and two ways out of the page. */
function AttachmentCard({ file, url }: { file: NotebookFileDto; url: string }) {
  const { t } = useTranslation();
  return (
    <span className="attachment-card">
      <span className="attachment-card-body">
        <span className="attachment-card-name">{file.name}</span>
        <span className="attachment-card-note">
          {file.mimeType} · {readableBytes(file.bytes)}
        </span>
        {file.description.length > 0 && (
          <span className="attachment-card-note">{file.description}</span>
        )}
      </span>
      <span className="attachment-card-actions">
        <a href={url} target="_blank" rel="noreferrer">
          {t('note.attachmentOpen')}
        </a>
        <a href={url} download={file.name}>
          {t('note.attachmentDownload')}
        </a>
      </span>
    </span>
  );
}

/** A size a person reads, in the units a person uses. */
function readableBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
