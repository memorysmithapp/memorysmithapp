/**
 * The log of the connector (section 17, #269): a tool call is one line named
 * after its tool, and the call it makes to the core carries the same
 * correlation id, so the line of the core and the events it caused are found
 * from the tool call.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLines } from '@memorysmithapp/observability/testing';
import {
  CORRELATION_HEADER,
  LOG_LINE_FIELDS,
  openScope,
  runInScope,
} from '@memorysmithapp/observability';
import { HttpKnowledgeGateway } from '../src/adapters/http-gateways.js';
import { handleMcpRequest } from '../src/mcp.js';
import type { McpToolAdapter, ToolResult } from '../src/mcp/tools.js';
import type { VerifiedAgentToken } from '../src/auth.js';
import type { AgentCaller } from '../src/mcp/gateway.js';
import { createApp } from '../src/app.js';
import type { AgentConfig } from '../src/config.js';

const SUBSCRIPTION = '01JBQ2X0000000000000000000';
const NOTEBOOK = '01JBQ2X0000000000000000001';

const caller = {
  userId: 'user-1',
  subscriptionId: SUBSCRIPTION,
  bearerToken: 'access.jwt',
} as AgentCaller;

const token: VerifiedAgentToken = {
  sub: 'user-1',
  clientId: 'proxy-client',
  subscriptionId: SUBSCRIPTION,
  payload: {},
};

/** Answers every call to the core, and keeps the headers it was sent. */
function coreAnswering(body: unknown): Array<Record<string, string>> {
  const sent: Array<Record<string, string>> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
      sent.push(init?.headers ?? {});
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return sent;
}

function toolsAnswering(answer: ToolResult): McpToolAdapter {
  return { call: async () => answer } as unknown as McpToolAdapter;
}

let capture: ReturnType<typeof captureLines>;
beforeEach(() => {
  capture = captureLines();
});
afterEach(() => {
  capture.restore();
  vi.unstubAllGlobals();
});

describe('the call to the core carries the id of the tool call', () => {
  it('in the header of a call through the API', async () => {
    const sent = coreAnswering({ notebooks: [] });
    await runInScope(openScope('mcp-request-0001'), () =>
      new HttpKnowledgeGateway('https://api.example').deleteNotebook(caller, NOTEBOOK),
    );
    expect(sent[0]?.[CORRELATION_HEADER]).toBe('mcp-request-0001');
    expect(sent[0]?.['authorization']).toBe('Bearer access.jwt');
  });

  it('in the header of the call that reads the Notebook Context', async () => {
    const sent = coreAnswering('# Notebook Context');
    await runInScope(openScope('mcp-request-0002'), () =>
      new HttpKnowledgeGateway('https://api.example').notebookContext(caller, NOTEBOOK),
    );
    expect(sent[0]?.[CORRELATION_HEADER]).toBe('mcp-request-0002');
  });

  it('and in no header outside a request', async () => {
    const sent = coreAnswering({});
    await new HttpKnowledgeGateway('https://api.example').deleteNotebook(caller, NOTEBOOK);
    expect(sent[0]).not.toHaveProperty(CORRELATION_HEADER);
  });
});

describe('the line of a tool call', () => {
  async function call(name: string, answer: ToolResult) {
    const scope = openScope('mcp-request-0003');
    await runInScope(scope, () =>
      handleMcpRequest(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } },
        token,
        toolsAnswering(answer),
      ),
    );
    return scope.annotations;
  }

  it('is named after its tool, and a refusal by its code alone', async () => {
    const annotations = await call('create_note', {
      content: [
        {
          type: 'text',
          text: 'ALREADY_EXISTS: this folder already holds a note named "Contratação Direta 2.0"',
        },
      ],
      isError: true,
    });
    expect(annotations).toEqual({
      operation: 'create_note',
      outcome: 'conflict',
      errorCode: 'ALREADY_EXISTS',
    });
  });

  it('never carries a tool name the catalogue does not hold', async () => {
    const annotations = await call('Contratação Direta 2.0', {
      content: [{ type: 'text', text: 'UNKNOWN_TOOL: there is no tool named …' }],
      isError: true,
    });
    expect(annotations).toEqual({
      operation: 'tools/call unknown tool',
      outcome: 'refused',
      errorCode: 'UNKNOWN_TOOL',
    });
  });

  it('is ok when the tool answered', async () => {
    const annotations = await call('read_note', {
      content: [{ type: 'text', text: '# A whole note' }],
      isError: false,
    });
    expect(annotations).toEqual({ operation: 'read_note' });
  });
});

describe('the line of a request to the connector', () => {
  const config = {
    publicOrigin: 'https://mcp.example',
    siteOrigin: 'https://app.example',
    cognitoDomain: 'https://auth.example',
    cognitoIssuer: 'https://issuer.example',
    proxyClientId: 'proxy-client',
    stateSecretId: 'secret',
    apiOrigin: 'https://api.example',
  } as unknown as AgentConfig;

  it('is written for a request refused before any tool, on the mcp channel', async () => {
    const app = createApp(
      config,
      async () => 'k'.repeat(32),
      toolsAnswering({ content: [], isError: false }),
      { bind: async () => undefined, rebind: async () => undefined },
    );
    const response = await app.request(
      '/mcp',
      { method: 'POST' },
      {
        event: { requestContext: { requestId: 'Mcp-Gateway-Id=' } },
      },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get(CORRELATION_HEADER)).toBe('Mcp-Gateway-Id=');
    expect(capture.lines).toEqual([
      expect.objectContaining({
        operation: 'POST /mcp',
        outcome: 'refused',
        status: 401,
        channel: 'mcp',
        correlationId: 'Mcp-Gateway-Id=',
      }),
    ]);
    const keys = Object.keys(capture.lines[0]!);
    expect(keys.filter((key) => !LOG_LINE_FIELDS.has(key))).toEqual([]);
  });
});
