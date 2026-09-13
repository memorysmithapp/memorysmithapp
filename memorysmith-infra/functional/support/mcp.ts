/**
 * The connector as an agent reaches it: the official MCP SDK over Streamable
 * HTTP, with the token the OAuth flow handed the suite (architecture-guide.md,
 * section 13). Every tool call records how long it took.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { recordLatency } from './api.js';

export interface ToolAnswer {
  readonly text: string;
  readonly isError: boolean;
}

export async function connectAgent(mcp: string, token: string): Promise<Client> {
  const client = new Client({ name: 'memorysmith-functional', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL('/mcp', mcp), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    }),
  );
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolAnswer> {
  const started = performance.now();
  const result = await client.callTool({ name, arguments: args });
  recordLatency(`tool ${name}`, performance.now() - started);

  const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
  return {
    text: content
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('\n'),
    isError: result.isError === true,
  };
}

/** The JSON a tool answered, or the error it answered instead, thrown. */
export function parsed<T>(answer: ToolAnswer): T {
  if (answer.isError) throw new Error(`The tool answered an error: ${answer.text}`);
  return JSON.parse(answer.text) as T;
}
