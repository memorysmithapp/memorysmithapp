import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { rendersAs, type FileLinkDto, type NotebookFileDto } from '@memorysmith/contracts';
import { fileKept, linkToFile } from '../api/source';
import { queryKeys } from '../api/query-keys';

/**
 * A file of the notebook, shown where a note referenced it (#166).
 *
 * **Two shapes and not three.** What a browser draws without executing
 * anything is drawn — an image, audio, video — and everything else, the PDF
 * included, is a **card** with what it is and what can be done with it. A PDF
 * *can* be framed, and that is exactly why it is not: half the browsers of a
 * phone ignore the frame and offer a download instead, and a surface that
 * works on the machine it was built on and comes out a grey rectangle on
 * somebody else's is worse than a card that behaves the same everywhere.
 *
 * A new tab is not a frame, which is why the card still offers to **open**
 * what a browser opens — the PDF — and offers only the download for the three
 * Office documents, which no browser shows (#171).
 *
 * The bytes come from a link that is minted when this renders and that points
 * at the object store, never at the API: it carries its own authorisation, so
 * an `<img>` can follow it, and a file somebody uploaded is served from an
 * origin that is not the one the product runs in.
 */
export function Attachment({
  notebookId,
  name,
  width = null,
  height = null,
}: {
  notebookId: string;
  name: string;
  /**
   * What the pipe declared, in CSS pixels (§3.14, #173). A width alone keeps
   * the aspect ratio; a width and a height set both. They are written as
   * attributes rather than as style, so the browser reserves the box before
   * the bytes arrive and the note stops reflowing as pictures land.
   */
  width?: number | null;
  height?: number | null;
}) {
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

  const address = link.data;
  if (!address) return <span className="attachment-loading">{file.name}</span>;

  const url = address.url;
  /**
   * A dimension is only ever a dimension of something with one: an audio
   * player has no width the author is talking about, and a card is text.
   *
   * The attributes reserve the box before the bytes arrive. A **height** also
   * travels as a style, because the reading surface sets `height: auto` on an
   * image — which is right when only a width was asked for, and is what an
   * author is overruling when they write `200x60`: two numbers mean both, and
   * deforming the picture is the thing they asked for (§3.14).
   *
   * A width larger than the column is still capped by `max-width`, and that
   * one stays: an image wider than the page it is on is a worse answer than
   * an image smaller than the number.
   */
  const sized = {
    ...(width === null ? {} : { width }),
    ...(height === null ? {} : { height, style: { height: `${height}px` } }),
  };
  const shape = rendersAs(file.mimeType);
  if (shape === 'image') {
    return (
      <img className="attachment-image" src={url} alt={file.description || file.name} {...sized} />
    );
  }
  if (shape === 'audio') {
    return <audio className="attachment-player" controls src={url} />;
  }
  if (shape === 'video') {
    return <video className="attachment-player" controls src={url} {...sized} />;
  }
  return <AttachmentCard file={file} link={address} />;
}

/**
 * What is not drawn: what it is, how big it is, and the ways out of the page.
 *
 * **Open is offered only where it opens something** (#171). The two verbs used
 * to hang off one address, signed as an attachment for every card, so opening
 * a PDF opened a tab that downloaded it and closed — and for a `.docx` no
 * browser would have shown anything anyway. The API now answers where the file
 * is shown and where it is saved, and says which of the two shows anything; a
 * card that shows nothing offers the one verb it can keep.
 */
function AttachmentCard({ file, link }: { file: NotebookFileDto; link: FileLinkDto }) {
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
        {link.opens && (
          <a href={link.url} target="_blank" rel="noreferrer">
            {t('note.attachmentOpen')}
          </a>
        )}
        <a href={link.downloadUrl} download={file.name}>
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
