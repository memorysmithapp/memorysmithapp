import { QueryClient } from '@tanstack/react-query';
import { mayRefetch } from '../shared/api/live';

/**
 * What the screen holds, and when it asks again (#206).
 *
 * A write of the interface still invalidates what it wrote, at once, on
 * success and on conflict alike — that half of the policy stays. What changed
 * is the premise of the other half. It said nothing in a notebook changes
 * without somebody writing it HERE, so a query was never refetched on its own
 * (`staleTime: Infinity`); an agent writing through the connector and an import
 * running in the background both write elsewhere, and their writes reached the
 * screen only on a reload.
 *
 * So a read is fresh for half a minute, the window coming back and the network
 * coming back read again what went stale, and the queries a screen shows are
 * read again on an interval of their own (`useLiveInterval` in
 * `shared/api/live.ts`). None of it while a write of this page is waiting or
 * in flight.
 *
 * `retry: false` belongs to the older decision and stays: a failed read is
 * information — a session that ended, a note that is gone — and retrying it
 * silently turns a message into a wait.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: () => mayRefetch(),
      refetchOnReconnect: () => mayRefetch(),
    },
  },
});
