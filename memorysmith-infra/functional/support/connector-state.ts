/**
 * The token the connector handed the suite, written by the setup that
 * connected it and read by every MCP case (architecture-guide.md, section 19).
 * It sits beside the state of the run, which git ignores, and goes with it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONNECTOR = join(dirname(fileURLToPath(import.meta.url)), '..', '.state', 'connector.json');

export interface ConnectorToken {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  /** The URL of the Client ID Metadata Document the suite connected as. */
  readonly clientId: string;
  readonly clientName: string;
}

export function writeConnectorToken(token: ConnectorToken): void {
  mkdirSync(dirname(CONNECTOR), { recursive: true });
  writeFileSync(CONNECTOR, JSON.stringify(token, null, 2));
}

export function readConnectorToken(): ConnectorToken {
  return JSON.parse(readFileSync(CONNECTOR, 'utf8')) as ConnectorToken;
}
