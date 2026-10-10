/**
 * The lines Powertools writes, as a test reads them. In development mode
 * (`POWERTOOLS_DEV`) the logger writes through the global console, which is
 * what a spy can catch; it is set before the first line creates the logger.
 */

import { vi } from 'vitest';

process.env['POWERTOOLS_DEV'] = 'true';
process.env['POWERTOOLS_SERVICE_NAME'] = 'TestFunction';

export type Line = Record<string, unknown>;

export function captureLines(): { lines: Line[]; restore: () => void } {
  const lines: Line[] = [];
  const keep = (text: unknown) => {
    lines.push(JSON.parse(String(text)) as Line);
  };
  const spies = [
    vi.spyOn(console, 'info').mockImplementation(keep),
    vi.spyOn(console, 'error').mockImplementation(keep),
    vi.spyOn(console, 'warn').mockImplementation(keep),
    vi.spyOn(console, 'debug').mockImplementation(keep),
    vi.spyOn(console, 'log').mockImplementation(keep),
  ];
  return { lines, restore: () => spies.forEach((spy) => spy.mockRestore()) };
}
