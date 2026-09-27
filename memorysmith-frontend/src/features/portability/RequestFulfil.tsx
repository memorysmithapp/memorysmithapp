import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TransferDto } from '@memorysmith/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { FileDrop } from '../../shared/components/FileDrop';
import { fileKind } from '../../shared/components/file-kind';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { AttachRefusal, attachFile, type AttachPhase } from '../note/attach';
import { ATTACH_PORTS } from '../note/attach-ports';

/**
 * Where the person gives the file an agent asked for (#253, RN-PRT-030,
 * RN-KNW-055).
 *
 * The file goes through the door the note editor uses — hashed a slice at a
 * time, sent in parts by URL, resumed from what arrived if the connection
 * dropped — and is kept **under the name the request gives**, in its notebook,
 * whatever the file is called on the disk: the embed the agent wrote draws it
 * without anybody touching the note.
 */
export function RequestFulfil({
  transfer,
  onKept,
}: {
  transfer: TransferDto;
  /** The file is kept and the request ended: the list is asked again. */
  onKept: () => void;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const request = transfer.request;
  const [state, setState] = useState<
    AttachPhase | { phase: 'done'; name: string } | { phase: 'failed'; message: string } | null
  >(null);
  const busy = state?.phase === 'hashing' || state?.phase === 'sending';

  if (!request || !transfer.notebookId) return null;
  const notebookId = transfer.notebookId;

  async function give(file: File): Promise<void> {
    if (!request) return;
    setState({ phase: 'hashing', read: 0, total: file.size });
    try {
      const kept = await attachFile(
        ATTACH_PORTS,
        {
          notebookId,
          file,
          purpose: request.purpose,
          request: { transferId: transfer.transferId, mimeType: request.mimeType },
        },
        undefined,
        setState,
      );
      setState({ phase: 'done', name: kept.name });
      void client.invalidateQueries({ queryKey: queryKeys.notebookFiles(notebookId) });
      void client.invalidateQueries({ queryKey: queryKeys.subscriptionUsage() });
      onKept();
    } catch (error) {
      const reason = (error as { details?: { reason?: string } }).details?.reason;
      setState({
        phase: 'failed',
        message:
          error instanceof AttachRefusal
            ? t(`editor.attachRefusal.${error.reason}`)
            : reason === 'REQUEST_TYPE_MISMATCH'
              ? t('transfers.requestWrongType', { kind: fileKind(t, request.mimeType) })
              : t(messageKeyOf(error)),
      });
    }
  }

  const percent = (read: number, total: number) =>
    new Intl.NumberFormat(intlLocale(i18n.language), { style: 'percent' }).format(
      total > 0 ? read / total : 0,
    );

  return (
    <div className="request-fulfil">
      <p className="request-fulfil-lead">
        {t('transfers.requestKeptAs', { name: transfer.fileName ?? '' })}
      </p>
      <FileDrop onFile={(file) => void give(file)} disabled={busy} accept={request.mimeType} />
      {state ? (
        <p
          className={`request-fulfil-status${state.phase === 'failed' ? ' is-failure' : ''}`}
          role="status"
        >
          {state.phase === 'hashing'
            ? t('transfers.requestHashing', { percent: percent(state.read, state.total) })
            : state.phase === 'sending'
              ? t('editor.attachSending', { sent: state.sent, total: state.total })
              : state.phase === 'done'
                ? t('transfers.requestDone', { name: state.name })
                : state.message}
        </p>
      ) : null}
    </div>
  );
}
