/**
 * What the screens read of shares (#256, RN-ACC-024 to RN-ACC-030), and what
 * every act on one has to read again.
 *
 * A share changes on both sides at once — the owner's list, the grantee's
 * Home, the notifications of whoever did not act — so every act invalidates
 * all of them, and the half-minute reading of the screens (#206) is what
 * brings the other side's act in.
 */

import type { ShareProfileDto } from '@memorysmithapp/contracts';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useLiveInterval } from '../../shared/api/live';
import { queryKeys } from '../../shared/api/query-keys';
import { listIncomingShares, listNotifications, listOwnShares } from '../../shared/api/source';

export function useIncomingShares() {
  return useQuery({
    queryKey: queryKeys.incomingShares(),
    queryFn: listIncomingShares,
    refetchInterval: useLiveInterval(),
  });
}

/** Only an owner shares, so only an owner asks (RN-ACC-024). */
export function useOwnShares(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.ownShares(),
    queryFn: listOwnShares,
    enabled,
    refetchInterval: useLiveInterval(),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: listNotifications,
    refetchInterval: useLiveInterval(),
  });
}

/** Everything a share is read from, read again after an act on one. */
export async function sharesChanged(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.ownShares() }),
    client.invalidateQueries({ queryKey: ['notebook-shares'] }),
    client.invalidateQueries({ queryKey: queryKeys.incomingShares() }),
    client.invalidateQueries({ queryKey: queryKeys.notifications() }),
  ]);
}

/** The three profiles of a share, from the one that grants least (RN-ACC-031). */
export const SHARE_PROFILES: readonly ShareProfileDto[] = [
  'reader',
  'content-editor',
  'notebook-editor',
];

/**
 * The profiles a notebook is shared with: a notebook declared as a model is
 * also shared as a model reader, who reaches the model and never the notebook
 * (#355).
 */
export function profilesFor(isModel: boolean): readonly ShareProfileDto[] {
  return isModel ? ['model-reader', ...SHARE_PROFILES] : SHARE_PROFILES;
}

/** The key a profile is named by in the strings of the interface. */
export function profileKey(profile: ShareProfileDto): string {
  switch (profile) {
    case 'model-reader':
      return 'modelReader';
    case 'content-editor':
      return 'contentEditor';
    case 'notebook-editor':
      return 'notebookEditor';
    case 'reader':
      return 'reader';
  }
}
