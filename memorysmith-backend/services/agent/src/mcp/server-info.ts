/**
 * Who this connector says it is, in the handshake (RN-AGT-040).
 *
 * A client lists a connector by what the server declares, and a server that
 * declares only a name and a version leaves each client to make up the rest:
 * one showed the symbol on a white plate, the other a placeholder of its own.
 * Revision 2025-11-25 of the protocol gives the
 * `Implementation` a title, a description, icons and a website, and the
 * connector fills all four.
 */

import { isProduction, type Deployment } from '@memorysmith/contracts';

export const SERVER_NAME = 'memorysmith-mcp';

const TITLE = 'MemorySmith.app';

const DESCRIPTION = 'Structured knowledge, natively readable and writable by humans and agents.';

export interface ServerIcon {
  readonly src: string;
  readonly mimeType: string;
  readonly sizes: readonly string[];
}

export interface ServerInfo {
  readonly name: string;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly icons?: readonly ServerIcon[];
  readonly websiteUrl?: string;
}

/**
 * The title names the environment outside production (RN-AGT-026), because a person
 * choosing between two connectors in a client's list has nothing else to tell
 * them apart by: the agent is told through the instructions and `whoami`, the
 * person through this.
 *
 * The icons are PNG, which is what a client that renders icons MUST accept;
 * an SVG is only a SHOULD, and one that can carry script. They are served by
 * the site of the same environment, a domain a client can tie to this server,
 * and with no site origin the connector declares neither icons nor website
 * rather than one that points somewhere else.
 */
export function serverInfo(deployment: Deployment, siteOrigin?: string): ServerInfo {
  const title = isProduction(deployment) ? TITLE : `${TITLE} (${deployment.environment})`;
  return {
    name: SERVER_NAME,
    title,
    version: deployment.version,
    description: DESCRIPTION,
    ...(siteOrigin
      ? {
          icons: [48, 192].map((side) => ({
            src: `${siteOrigin}/symbol-${side}.png`,
            mimeType: 'image/png',
            sizes: [`${side}x${side}`],
          })),
          websiteUrl: siteOrigin,
        }
      : {}),
  };
}
