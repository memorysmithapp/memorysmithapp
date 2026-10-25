/**
 * The token the connector handed the suite, written by the setup that
 * connected it and read by every MCP case.
 * It sits beside the state of the run, which git ignores, and goes with it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE = join(dirname(fileURLToPath(import.meta.url)), '..', '.state');

/** Whose connector: the owner's, which every MCP case uses, or the other account's (#351). */
export type ConnectorAccount = 'owner' | 'other';

const fileOf = (account: ConnectorAccount): string =>
  join(STATE, account === 'owner' ? 'connector.json' : 'connector-other.json');

export interface ConnectorToken {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  /** The URL of the Client ID Metadata Document the suite connected as. */
  readonly clientId: string;
  readonly clientName: string;
}

export function writeConnectorToken(
  token: ConnectorToken,
  account: ConnectorAccount = 'owner',
): void {
  mkdirSync(STATE, { recursive: true });
  writeFileSync(fileOf(account), JSON.stringify(token, null, 2));
}

export function readConnectorToken(account: ConnectorAccount = 'owner'): ConnectorToken {
  return JSON.parse(readFileSync(fileOf(account), 'utf8')) as ConnectorToken;
}
