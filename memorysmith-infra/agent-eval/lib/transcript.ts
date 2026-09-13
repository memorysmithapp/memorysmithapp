/**
 * What a headless session said and did, read from the stream Claude Code prints
 * with `--output-format stream-json`.
 */

export interface ToolUse {
  /** The tool as the connector names it, without the `mcp__<server>__` prefix. */
  readonly tool: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** Which turn of the conversation it happened in: 0 is the request. */
  readonly turn: number;
}

export interface Transcript {
  /** The tools the session had, as its init event declared them. */
  tools: string[] | null;
  readonly toolUses: ToolUse[];
  readonly texts: { readonly turn: number; readonly text: string }[];
  /** Everything the server answered, which is what a term may come from without leaking. */
  readonly toolResults: string[];
  costUsd: number;
}

export interface TurnOutcome {
  readonly sessionId: string | null;
  /** The last message of the session in this turn. */
  readonly text: string;
  readonly isError: boolean;
  readonly costUsd: number;
}

export function emptyTranscript(): Transcript {
  return { tools: null, toolUses: [], texts: [], toolResults: [], costUsd: 0 };
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const blocks = (event: Record<string, unknown>): Record<string, unknown>[] => {
  const content = record(event['message'])['content'];
  return Array.isArray(content) ? content.map(record) : [];
};

function resultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => String(record(part)['text'] ?? '')).join('\n');
}

/** Reads the lines one turn printed into the transcript, and says how the turn ended. */
export function readTurn(lines: readonly string[], turn: number, into: Transcript): TurnOutcome {
  let sessionId: string | null = null;
  let text = '';
  let isError = false;
  let costUsd = 0;

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const event = record(parsed);
    switch (event['type']) {
      case 'system':
        if (event['subtype'] === 'init') {
          if (into.tools === null && Array.isArray(event['tools'])) {
            into.tools = (event['tools'] as unknown[]).map(String);
          }
          sessionId = typeof event['session_id'] === 'string' ? event['session_id'] : sessionId;
        }
        break;
      case 'assistant':
        for (const block of blocks(event)) {
          if (block['type'] === 'text' && typeof block['text'] === 'string' && block['text']) {
            into.texts.push({ turn, text: block['text'] });
          }
          if (block['type'] === 'tool_use') {
            into.toolUses.push({
              tool: String(block['name'] ?? '').replace(/^mcp__.+?__/, ''),
              input: record(block['input']),
              turn,
            });
          }
        }
        break;
      case 'user':
        for (const block of blocks(event)) {
          if (block['type'] === 'tool_result') into.toolResults.push(resultText(block['content']));
        }
        break;
      case 'result':
        sessionId = typeof event['session_id'] === 'string' ? event['session_id'] : sessionId;
        text = String(event['result'] ?? '');
        isError = event['is_error'] === true;
        costUsd = Number(event['total_cost_usd'] ?? 0);
        break;
    }
  }

  into.costUsd += costUsd;
  return { sessionId, text, isError, costUsd };
}
