/**
 * Stateless MCP server over Streamable HTTP.
 *
 * The catalog it serves is the public contract of the product
 * (software-vision.md, section 9.1); the translation into use cases happens in
 * mcp/tools.ts, which is the anticorruption layer. This file knows JSON-RPC
 * and nothing else, so a change of protocol stops here.
 */

import type { VerifiedAgentToken } from './auth.js';
import { TOOL_CATALOG } from './mcp/catalog.js';
import type { McpToolAdapter } from './mcp/tools.js';
import type { AgentCaller } from './mcp/gateway.js';
import type { Deployment } from '@memorysmith/contracts';
import { PRODUCTION_DEFAULT } from './mcp/environment.js';
import { serverInstructions } from './mcp/instructions.js';
import { serverInfo } from './mcp/server-info.js';

/**
 * The revisions this server speaks, newest first. 2025-11-25 is the one that
 * gives the `Implementation` its title, description, icons and website; the
 * one before it, which this server spoke alone until then, differs from it in
 * nothing a server offering only tools does.
 */
const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18'] as const;

/**
 * The revision a client asked for when this server speaks it, and otherwise
 * the newest: the specification lets a client disconnect from an answer it does
 * not support, so a client that still asks for an older revision is answered
 * in it rather than told a newer one.
 */
function negotiatedVersion(requested: unknown): string {
  return typeof requested === 'string' &&
    (PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : PROTOCOL_VERSIONS[0];
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: string } };

function result(id: number | string | null, value: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result: value };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * The caller, resolved from the token. The human is always identified, because
 * even when the agent is the one writing, the authorization belongs to whoever
 * connected (RN-AGT-001). The subscription is the one fixed at consent and
 * does not change for the life of this token (RN-SUB-014).
 */
export function callerFrom(
  token: VerifiedAgentToken,
  bearerToken: string,
): (AgentCaller & { bearerToken: string }) | null {
  if (!token.subscriptionId) return null;
  const email = token.payload['email'];
  return {
    userId: token.sub,
    ...(typeof email === 'string' ? { email } : {}),
    subscriptionId: token.subscriptionId,
    // Forwarded to the internal API, so the subscription that reaches the core
    // is the one the token carries, and the connector is the one the proxy
    // bound the token to.
    bearerToken,
  };
}

export async function handleMcpRequest(
  body: unknown,
  token: VerifiedAgentToken,
  tools: McpToolAdapter,
  bearerToken = '',
  deployment: Deployment = PRODUCTION_DEFAULT,
  siteOrigin?: string,
): Promise<JsonRpcResponse | null> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return rpcError(null, -32600, 'Invalid request');
  }
  const request = body as JsonRpcRequest;
  const id = request.id ?? null;

  switch (request.method) {
    case 'initialize': {
      // Who this is and the version this deployment runs, and outside
      // production the environment in the title and the warning that what is
      // written here is disposable (RN-AGT-026, RN-AGT-040). In every environment the
      // instructions send the agent to whoami and index the skills, because
      // they are read before the first tool is chosen (RN-AGT-028). The whole
      // Implementation goes in any revision: a field a client's revision does
      // not name is one it ignores.
      return result(id, {
        protocolVersion: negotiatedVersion(request.params?.['protocolVersion']),
        capabilities: { tools: {} },
        serverInfo: serverInfo(deployment, siteOrigin),
        instructions: serverInstructions(deployment),
      });
    }

    case 'notifications/initialized':
      return null;

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, { tools: TOOL_CATALOG });

    case 'tools/call': {
      const name = request.params?.['name'];
      if (typeof name !== 'string') {
        return rpcError(id, -32602, 'A tool call requires a name');
      }
      const caller = callerFrom(token, bearerToken);
      if (!caller) {
        // A token with no subscription claim cannot reach a notebook, and the
        // failure is structural rather than a permission check (RN-SUB-016).
        return result(id, {
          content: [
            {
              type: 'text',
              text:
                'This connector is not bound to a subscription. Authorize it again from an ' +
                'account whose subscription is active.',
            },
          ],
          isError: true,
        });
      }
      const args = (request.params?.['arguments'] ?? {}) as Record<string, unknown>;
      return result(id, await tools.call(name, args, caller));
    }

    default:
      return rpcError(id, -32601, `Method not found: ${request.method}`);
  }
}
