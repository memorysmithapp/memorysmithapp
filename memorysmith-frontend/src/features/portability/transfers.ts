import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransferDto, TransferListDto } from '@memorysmith/contracts';
import { downloadTransfer, listTransfers } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';

/**
 * The transfers of whoever is signed in, and how the interface follows one that
 * is still running (RN-PRT-019, RN-PRT-020).
 *
 * A transfer is a job somebody else finishes, so the only way to know it ended
 * is to ask. It is polled **while something is running and never otherwise**:
 * a page that polls a list that cannot change is a page that costs a request
 * every few seconds for nothing.
 */
const POLL_MS = 2_000;

export const TRANSFERS_KEY = queryKeys.transfers();

export function useTransfers(enabled = true) {
  return useQuery({
    queryKey: TRANSFERS_KEY,
    queryFn: listTransfers,
    enabled,
    refetchInterval: (query) =>
      (query.state.data as TransferListDto | undefined)?.transfers.some(
        (transfer) => transfer.status === 'running',
      )
        ? POLL_MS
        : false,
  });
}

/** Asks the list again at once, which is what a start or a deletion changes. */
export function useRefreshTransfers(): () => void {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: TRANSFERS_KEY });
}

/**
 * Hands the browser the archive of a transfer. The link is minted at this
 * moment and lives fifteen minutes: navigating to it saves the file and leaves
 * the application where it was, because the object answers with a content
 * disposition of attachment.
 */
export async function saveArchive(transferId: string): Promise<void> {
  const link = await downloadTransfer(transferId);
  window.location.assign(link.downloadUrl);
}

/**
 * What a transfer IS, in one line: the notebook, and the file it becomes or
 * came from (#155). A row used to carry the name of the notebook and nothing
 * else, so an export and an import of the same notebook read the same.
 */
export function lineOf(
  transfer: TransferDto,
  say: (key: string, values: Record<string, unknown>) => string,
): string {
  // Once. It used to name the notebook and then the file named after it, which
  // is the same words twice over three lines of a panel (#160). The file is
  // the second line of the row, where it belongs.
  return say(`transfers.line.${transfer.kind}`, { notebook: transfer.notebookName });
}

/** The file a transfer is about, for the line under the name, or nothing. */
export function fileOf(
  transfer: TransferDto,
  say: (key: string, values: Record<string, unknown>) => string,
): string | null {
  return transfer.fileName ? say('transfers.fromFile', { file: transfer.fileName }) : null;
}

/**
 * What a transfer that ENDED produced, which is not the same question for the
 * two kinds. An export is bytes the subscription keeps (RN-SUB-021); an import
 * keeps nothing — the upload is discarded the moment it ends (RN-PRT-014) — so
 * its size is always zero, and `0 B` beside an export of 1 MB reads as a job
 * that did nothing, while it had written a whole notebook (#155).
 */
export function outcomeOf(
  transfer: TransferDto,
  say: (key: string, values?: Record<string, unknown>) => string,
  size: (bytes: number) => string,
): string {
  if (transfer.kind === 'export') return size(transfer.bytes);
  return transfer.done > 0
    ? say('transfers.wrote', { count: transfer.done })
    : say('transfers.wroteNothing');
}

/** How far a running transfer got, as a fraction, or `null` when it cannot say. */
export function progressOf(transfer: TransferDto): number | null {
  if (transfer.status !== 'running' || transfer.total <= 0) return null;
  return Math.min(1, transfer.done / transfer.total);
}
