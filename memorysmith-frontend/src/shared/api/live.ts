import { useWriteStatus } from '../store/write-status';

/**
 * How what is on the screen follows what somebody else wrote (#206).
 *
 * The interface used to read once and never again, on the premise that
 * nothing in a notebook changes without somebody writing it here. Somebody
 * does write it elsewhere — an agent through the connector, an import running
 * in the background — and those writes reached the screen only on a reload.
 *
 * So the queries a screen SHOWS are read again every half minute while the tab
 * is visible, and every query is read again when the window comes back and
 * when the network does. Never while a write of this page is waiting or in
 * flight: a read landing between a tick and its write would take the tick off
 * the screen and base the next write on a revision the person never saw.
 */
export const LIVE_MS = 30_000;

/** Whether a read may land now, which is never while a write is pending. */
export function mayRefetch(): boolean {
  const { state } = useWriteStatus.getState();
  return state !== 'unsaved' && state !== 'saving';
}

/**
 * The interval of a query the screen shows: half a minute, or nothing while a
 * write is pending. It is a hook so the query picks the interval up again the
 * moment the write lands.
 */
export function useLiveInterval(paused = false): number | false {
  const pending = useWriteStatus((s) => s.state === 'unsaved' || s.state === 'saving');
  return pending || paused ? false : LIVE_MS;
}
