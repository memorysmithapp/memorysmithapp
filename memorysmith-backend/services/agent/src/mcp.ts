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
import pkg from '../package.json' with { type: 'json' };

const PROTOCOL_VERSION = '2025-06-18';

/**
 * The version the handshake announces, derived from the service manifest and
 * never written beside it: a literal here would still say 0.2.0 three releases
 * later. It is the same discipline RN-AGT-013 imposes on the whoami help.
 */
const SERVER_VERSION = pkg.version;

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
    clientId: token.clientId,
    clientName: token.username ?? token.clientId,
    subscriptionId: token.subscriptionId,
    // Forwarded to the internal API, so the subscription and the agent
    // identity that reach the core are the ones the token itself carries.
    bearerToken,
  };
}

export async function handleMcpRequest(
  body: unknown,
  token: VerifiedAgentToken,
  tools: McpToolAdapter,
  bearerToken = '',
): Promise<JsonRpcResponse | null> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return rpcError(null, -32600, 'Invalid request');
  }
  const request = body as JsonRpcRequest;
  const id = request.id ?? null;

  switch (request.method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'memorysmith-mcp', version: SERVER_VERSION },
      });

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
        // A token with no subscription claim cannot reach a vault, and the
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
