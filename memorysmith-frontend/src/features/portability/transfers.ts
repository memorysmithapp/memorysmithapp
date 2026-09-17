import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransferDto, TransferListDto } from '@memorysmith/contracts';
import { downloadTransfer, listTransfers } from '../../shared/api/source';

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

export const TRANSFERS_KEY = ['transfers'] as const;

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

/** How far a running transfer got, as a fraction, or `null` when it cannot say. */
export function progressOf(transfer: TransferDto): number | null {
  if (transfer.status !== 'running' || transfer.total <= 0) return null;
  return Math.min(1, transfer.done / transfer.total);
}
