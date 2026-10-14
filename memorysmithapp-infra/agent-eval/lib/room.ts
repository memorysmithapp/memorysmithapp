/**
 * The clean room (architecture-guide.md, section 19).
 *
 * The executor is a separate Claude Code process that knows nothing but the
 * request and what the connector serves it:
 *  - it runs in an empty directory created per run, outside any git
 *    repository, because Claude Code hands a session the status of the
 *    repository it runs in;
 *  - it loads no setting source, no skill and no built-in tool, so no
 *    `CLAUDE.md`, no memory and no file or web reading;
 *  - its only MCP server is the connector of the environment, authenticated by a
 *    header, from a configuration file beside the room and never in the
 *    repository.
 *
 * The simulated user is another process of the same kind with no MCP server at
 * all, reading only the sheet of its persona.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function insideGitRepository(directory: string): boolean {
  const probe = spawnSync('git', ['-C', directory, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  });
  return probe.status === 0 && probe.stdout.trim() === 'true';
}

/** Where rooms open: the first candidate that is not inside a git repository. */
export function roomsRoot(): string {
  const candidates = [
    process.env['AGENT_EVAL_ROOMS'],
    join(tmpdir(), 'memorysmith-eval'),
    process.platform === 'win32' ? 'C:\\Users\\Public\\memorysmith-eval' : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    mkdirSync(candidate, { recursive: true });
    if (!insideGitRepository(candidate)) return candidate;
  }
  throw new Error(
    'Every place a room could open is inside a git repository, whose status Claude Code would hand the executor. Set AGENT_EVAL_ROOMS to a directory outside one.',
  );
}

export const SIMULATED_USER_PREAMBLE = [
  'You are the person described below, talking to an assistant that is helping you.',
  'Reply to the last message of the assistant as that person would: briefly, and in the language of the description.',
  'Give only the material the description gives you; when asked for something it does not have, say you do not have it.',
  'Never say that you are playing a role.',
  '',
  '',
].join('\n');

export interface Room {
  readonly workdir: string;
  readonly executorConfig: string;
  readonly userConfig: string;
  readonly userPrompt: string | null;
  dispose(): void;
}

export function openRoom(input: {
  readonly root: string;
  readonly mcpUrl: string;
  readonly token: string;
  readonly persona: string | null;
}): Room {
  const base = mkdtempSync(join(input.root, 'room-'));
  const workdir = join(base, 'workdir');
  mkdirSync(workdir);
  const executorConfig = join(base, 'executor-mcp.json');
  writeFileSync(
    executorConfig,
    JSON.stringify({
      mcpServers: {
        memorysmith: {
          type: 'http',
          url: input.mcpUrl,
          headers: { Authorization: `Bearer ${input.token}` },
        },
      },
    }),
  );
  const userConfig = join(base, 'user-mcp.json');
  writeFileSync(userConfig, JSON.stringify({ mcpServers: {} }));
  return {
    workdir,
    executorConfig,
    userConfig,
    userPrompt: input.persona ? `${SIMULATED_USER_PREAMBLE}${input.persona}` : null,
    dispose: () => rmSync(base, { recursive: true, force: true }),
  };
}

export interface TurnRequest {
  readonly room: Room;
  readonly role: 'executor' | 'user';
  readonly model: string;
  readonly prompt: string;
  readonly resume: string | null;
  /** The room deliberately opened, which is how a run proves the leak check can fail. */
  readonly openedAt?: string;
}

const HEADLESS = ['--output-format', 'stream-json', '--verbose'];
const CLOSED = [
  '--tools',
  '',
  '--setting-sources',
  '',
  '--disable-slash-commands',
  '--strict-mcp-config',
];

export function claudeArguments(request: TurnRequest): { args: string[]; cwd: string } {
  const resume = request.resume ? ['--resume', request.resume] : [];
  const base = ['-p', request.prompt, '--model', request.model, ...HEADLESS];

  if (request.role === 'user') {
    return {
      cwd: request.room.workdir,
      args: [
        ...base,
        ...CLOSED,
        '--mcp-config',
        request.room.userConfig,
        '--system-prompt',
        request.room.userPrompt ?? SIMULATED_USER_PREAMBLE,
        ...resume,
      ],
    };
  }
  if (request.openedAt) {
    return {
      cwd: request.openedAt,
      args: [
        ...base,
        '--mcp-config',
        request.room.executorConfig,
        '--allowedTools',
        'mcp__memorysmith Read Grep Glob',
        '--permission-mode',
        'dontAsk',
        ...resume,
      ],
    };
  }
  return {
    cwd: request.room.workdir,
    args: [
      ...base,
      ...CLOSED,
      '--mcp-config',
      request.room.executorConfig,
      '--allowedTools',
      'mcp__memorysmith',
      '--permission-mode',
      'dontAsk',
      ...resume,
    ],
  };
}

/** One turn of one process, answering the lines of its stream. */
export function runClaude(request: TurnRequest, timeoutMs = 20 * 60_000): Promise<string[]> {
  const { args, cwd } = claudeArguments(request);
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (out += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (err += chunk));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) {
        reject(new Error(`claude exited with ${code}: ${err.slice(-800)}`));
        return;
      }
      resolve(out.split(/\r?\n/).filter((line) => line.trim().length > 0));
    });
  });
}
