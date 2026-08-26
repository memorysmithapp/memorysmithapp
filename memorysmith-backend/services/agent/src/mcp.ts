/**
 * Minimal stateless MCP server over Streamable HTTP, existing only to prove the
 * authenticated round-trip of the CIMD spike (architecture-guide.md, section 25,
 * delivery 1). The real tool catalog arrives with delivery 8 and lives in
 * software-vision.md, section 9.
 */

import type { VerifiedAgentToken } from './auth.js';

const PROTOCOL_VERSION = '2025-06-18';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: string } };

/**
 * Every tool carries a human-readable title and a read-only or destructive
 * hint (software-vision.md, RN-AGT-009). The hints are what decide whether a
 * client runs the call outright or asks the user first, so a tool without them
 * costs friction on every invocation.
 */
const WHOAMI_TOOL = {
  name: 'whoami',
  title: 'Who am I',
  description:
    'Echoes the authenticated identity carried by the access token: the human subject, ' +
    'the OAuth client and the subscription the connector is bound to. Spike-only tool.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
};

function result(id: number | string | null, value: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result: value };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Handles one Streamable HTTP POST body. Returns null for notifications
 * (the transport answers 202 with no body).
 */
export function handleMcpRequest(
  body: unknown,
  token: VerifiedAgentToken,
): JsonRpcResponse | null {
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
        serverInfo: { name: 'memorysmith-mcp', version: '0.1.0' },
      });
    case 'notifications/initialized':
      return null;
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, { tools: [WHOAMI_TOOL] });
    case 'tools/call': {
      const name = request.params?.['name'];
      if (name !== 'whoami') {
        return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      }
      const identity = {
        sub: token.sub,
        username: token.username ?? null,
        client_id: token.clientId,
        subscription_id: token.subscriptionId ?? null,
        subscription_status: token.subscriptionStatus ?? null,
      };
      return result(id, {
        content: [{ type: 'text', text: JSON.stringify(identity, null, 2) }],
        isError: false,
      });
    }
    default:
      return rpcError(id, -32601, `Method not found: ${request.method}`);
  }
}
