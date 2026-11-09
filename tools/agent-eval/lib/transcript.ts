/**
 * What a headless session said and did, read from the stream Claude Code prints
 * with `--output-format stream-json`, or from the events Codex prints with
 * `codex exec --json` (#406).
 */

export interface ToolUse {
  /** The tool as the connector names it, without the `mcp__<server>__` prefix. */
  readonly tool: string;
  readonly input: Readonly<Record<string, unknown>>;
  /** Which turn of the conversation it happened in: 0 is the request. */
  readonly turn: number;
}

export interface Transcript {
  /**
   * The tools the session had, as the init event of Claude Code declared them.
   * Codex declares none, so for it these are the tools it used: each tool of a
   * server as `mcp__<server>__<tool>`, and anything else by the kind of its item.
   */
  tools: string[] | null;
  readonly toolUses: ToolUse[];
  readonly texts: { readonly turn: number; readonly text: string }[];
  /** Everything the server answered, which is what a term may come from without leaking. */
  readonly toolResults: string[];
  costUsd: number;
  /** The tokens the executor spent, cached ones included. */
  tokens: number;
}

export interface TurnOutcome {
  readonly sessionId: string | null;
  /** The last message of the session in this turn. */
  readonly text: string;
  readonly isError: boolean;
  readonly costUsd: number;
}

export function emptyTranscript(): Transcript {
  return { tools: null, toolUses: [], texts: [], toolResults: [], costUsd: 0, tokens: 0 };
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
        into.tokens += tokensOf(record(event['usage']), [
          'input_tokens',
          'cache_creation_input_tokens',
          'cache_read_input_tokens',
          'output_tokens',
        ]);
        break;
    }
  }

  into.costUsd += costUsd;
  return { sessionId, text, isError, costUsd };
}

const tokensOf = (usage: Record<string, unknown>, fields: readonly string[]): number =>
  fields.reduce((total, field) => total + (Number(usage[field]) || 0), 0);

/** The items of Codex that are no tool, so using them is no tool used. */
const CODEX_NOT_TOOLS = new Set(['agent_message', 'reasoning', 'error', 'todo_list']);

/**
 * Reads the events of one turn of Codex into the transcript. It prints no
 * price, so the cost of the turn is null and its tokens are what it spent.
 */
export function readCodexTurn(
  lines: readonly string[],
  turn: number,
  into: Transcript,
): Omit<TurnOutcome, 'costUsd'> & { readonly costUsd: null } {
  let sessionId: string | null = null;
  let text = '';
  let isError = false;
  into.tools ??= [];
  const used = (name: string) => {
    if (!into.tools!.includes(name)) into.tools!.push(name);
  };

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const event = record(parsed);
    switch (event['type']) {
      case 'thread.started':
        sessionId = typeof event['thread_id'] === 'string' ? event['thread_id'] : sessionId;
        break;
      case 'item.completed': {
        const item = record(event['item']);
        const kind = String(item['type'] ?? '');
        if (kind === 'agent_message' && typeof item['text'] === 'string' && item['text']) {
          into.texts.push({ turn, text: item['text'] });
          text = item['text'];
        } else if (kind === 'mcp_tool_call') {
          const tool = String(item['tool'] ?? '');
          used(`mcp__${String(item['server'] ?? '')}__${tool}`);
          into.toolUses.push({ tool, input: record(item['arguments']), turn });
          const result = record(item['result']);
          const failure = record(item['error']);
          into.toolResults.push(
            item['result'] ? resultText(result['content']) : String(failure['message'] ?? ''),
          );
        } else if (kind && !CODEX_NOT_TOOLS.has(kind)) {
          used(kind);
        }
        break;
      }
      case 'turn.completed':
        into.tokens += tokensOf(record(event['usage']), ['input_tokens', 'output_tokens']);
        break;
      case 'turn.failed':
      case 'error': {
        isError = true;
        const failure = record(event['error']);
        text ||= String(failure['message'] ?? event['message'] ?? '');
        break;
      }
    }
  }

  return { sessionId, text, isError, costUsd: null };
}
