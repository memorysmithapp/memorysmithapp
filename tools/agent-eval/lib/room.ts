/**
 * The clean room.
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
 *
 * The executor may also be Codex (#406), chosen by the round as `codex` or
 * `codex:<model>`, in the same empty directory and closed the same way: no
 * user configuration, no rules, no project document, a read-only sandbox, and
 * every feature that reaches beyond the connector turned off — the shell, the
 * apps of the ChatGPT account (which would reach production), plugins, skills,
 * the web, images, memories and other agents. What remains of its own is a
 * JavaScript runtime with no file system, through which it calls the
 * connector. The simulated user stays Claude Code, so what changes between
 * columns of the scorecard is the executor alone.
 *
 * What none of those flags removes is the account Claude Code is signed in
 * with: a session of a claude.ai account is handed the e-mail address of that
 * account as context, whatever it loads (#313). Both processes therefore run
 * under the configuration directory `AGENT_EVAL_CLAUDE_CONFIG_DIR` names, when
 * it is set, which is a directory signed in with an account kept for the
 * evaluation, and `accountInRoom` says before a round which address, if any,
 * the room carries, so the leak check can hold the executor to it.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { END_OF_CONVERSATION } from './turns.js';

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
  // The connector of staging tells the executor that what it writes there is
  // disposable, and a careful executor asks first (#312).
  'You are trying the service out: if the assistant warns that it is a test environment, or that what it writes may be discarded, say that is fine and ask it to go ahead.',
  'Never say that you are playing a role.',
  // Whether the assistant waits for an answer is for the person to read, not
  // the round (#408).
  `When the last message of the assistant asks nothing of you and waits for no answer, because it says the work is done and offers at most something optional, reply with exactly ${END_OF_CONVERSATION} and nothing else. When it asks, proposes or offers to go on once you agree, in whatever words, answer it.`,
  '',
  '',
].join('\n');

export interface Room {
  readonly workdir: string;
  readonly executorConfig: string;
  readonly userConfig: string;
  readonly userPrompt: string | null;
  /** The configuration directory of Claude Code both processes run under, or null for the operator's own. */
  readonly claudeConfigDir?: string | null;
  /** The connector of the run and its token, which Codex takes by configuration rather than by file. */
  readonly mcpUrl?: string;
  readonly token?: string;
  /** The `CODEX_HOME` a Codex executor runs under, or null for the operator's own. */
  readonly codexHome?: string | null;
  dispose(): void;
}

/** The configuration directory a room runs under, from the environment of the round. */
export function roomConfigDir(env: NodeJS.ProcessEnv = process.env): string | null {
  return env['AGENT_EVAL_CLAUDE_CONFIG_DIR']?.trim() || null;
}

/** The environment of a process of the room. */
export function roomEnvironment(
  claudeConfigDir: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return claudeConfigDir ? { ...env, CLAUDE_CONFIG_DIR: claudeConfigDir } : env;
}

/** The `CODEX_HOME` a Codex executor runs under, from the environment of the round. */
export function roomCodexHome(env: NodeJS.ProcessEnv = process.env): string | null {
  return env['AGENT_EVAL_CODEX_HOME']?.trim() || null;
}

/** Which program plays the executor: `codex` or `codex:<model>` is Codex, any other name a model of Claude Code. */
export function executorOf(name: string): { kind: 'claude' | 'codex'; model: string | null } {
  const [head, ...rest] = name.split(':');
  if (head === 'codex') return { kind: 'codex', model: rest.join(':') || null };
  return { kind: 'claude', model: name };
}

/** Says, before a round, that the `CODEX_HOME` of the room is signed in. */
export function codexSignedIn(codexHome: string | null): void {
  const probe = spawnSync('codex', ['login', 'status'], {
    encoding: 'utf8',
    env: codexHome ? { ...process.env, CODEX_HOME: codexHome } : process.env,
  });
  if (probe.error || probe.status !== 0) {
    throw new Error(
      codexHome
        ? `${codexHome} is signed in to no Codex account: sign it in with CODEX_HOME=${codexHome} codex login.`
        : 'Codex is signed in to no account: sign it in with codex login.',
    );
  }
}

/**
 * The e-mail address of the account a process of the room is signed in with,
 * which Claude Code hands it as context, or null when it carries none.
 */
export function accountInRoom(claudeConfigDir: string | null): string | null {
  let printed: string;
  try {
    printed = execFileSync('claude', ['auth', 'status'], {
      encoding: 'utf8',
      env: roomEnvironment(claudeConfigDir),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // Signed in to nothing, it exits non-zero and still prints its status.
    printed = String((error as { stdout?: unknown }).stdout ?? '');
  }
  let status: { loggedIn?: boolean; email?: unknown } = {};
  try {
    status = JSON.parse(printed) as typeof status;
  } catch {
    // Read as signed in to nothing below.
  }
  if (!status.loggedIn) {
    throw new Error(
      claudeConfigDir
        ? `${claudeConfigDir} is signed in to no account: sign it in with CLAUDE_CONFIG_DIR=${claudeConfigDir} claude auth login.`
        : 'Claude Code is signed in to no account.',
    );
  }
  return typeof status.email === 'string' && status.email ? status.email : null;
}

export function openRoom(input: {
  readonly root: string;
  readonly mcpUrl: string;
  readonly token: string;
  readonly persona: string | null;
  readonly claudeConfigDir?: string | null;
  readonly codexHome?: string | null;
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
    claudeConfigDir: input.claudeConfigDir ?? null,
    mcpUrl: input.mcpUrl,
    token: input.token,
    codexHome: input.codexHome ?? null,
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
  return runProcess('claude', args, cwd, roomEnvironment(request.room.claudeConfigDir), timeoutMs);
}

/** The variable the token of the connector reaches Codex through, never its command line. */
export const CODEX_TOKEN_VARIABLE = 'MEMORYSMITH_EVAL_TOKEN';

/**
 * What Codex has beyond the connector, all turned off in the room. `apps`
 * matters most: the apps of a ChatGPT account include the MemorySmith
 * connector of production, if the account added it.
 */
export const CODEX_FEATURES_OFF = [
  'apps',
  'plugins',
  'remote_plugin',
  'shell_tool',
  'unified_exec',
  'browser_use',
  'browser_use_external',
  'computer_use',
  'in_app_browser',
  'image_generation',
  'view_image',
  'skill_search',
  'skill_mcp_dependency_install',
  'tool_suggest',
  'memories',
  'multi_agent',
  'goals',
  'hooks',
  'sleep_tool',
];

/** The features an opened room gives back to Codex, so AE-00 can fail. */
const CODEX_OPENED_KEEPS_OFF = ['apps', 'plugins', 'remote_plugin', 'memories'];

export function codexArguments(request: TurnRequest): {
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
} {
  const { room } = request;
  if (!room.mcpUrl || !room.token) throw new Error('The room carries no connector for Codex.');
  const model = executorOf(request.model).model;
  const off = request.openedAt ? CODEX_OPENED_KEEPS_OFF : CODEX_FEATURES_OFF;
  const args = [
    'exec',
    ...(request.resume ? ['resume', request.resume] : []),
    '--json',
    '--skip-git-repo-check',
    '--ignore-user-config',
    '--ignore-rules',
    ...(model ? ['-m', model] : []),
    '-c',
    'sandbox_mode="read-only"',
    '-c',
    'web_search="disabled"',
    '-c',
    `project_doc_max_bytes=${request.openedAt ? 32768 : 0}`,
    ...off.flatMap((feature) => ['--disable', feature]),
    '-c',
    `mcp_servers.memorysmith.url=${JSON.stringify(room.mcpUrl)}`,
    '-c',
    `mcp_servers.memorysmith.bearer_token_env_var="${CODEX_TOKEN_VARIABLE}"`,
    '-c',
    'mcp_servers.memorysmith.default_tools_approval_mode="approve"',
    // A reply of the person may begin with a dash.
    '--',
    request.prompt,
  ];
  return {
    args,
    cwd: request.openedAt ?? room.workdir,
    env: {
      ...process.env,
      ...(room.codexHome ? { CODEX_HOME: room.codexHome } : {}),
      [CODEX_TOKEN_VARIABLE]: room.token,
    },
  };
}

/** One turn of a Codex executor, answering the lines of its events. */
export function runCodex(request: TurnRequest, timeoutMs = 20 * 60_000): Promise<string[]> {
  const { args, cwd, env } = codexArguments(request);
  return runProcess('codex', args, cwd, env, timeoutMs);
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    // Codex reads a prompt from its standard input when that is open.
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
        reject(new Error(`${command} exited with ${code}: ${err.slice(-800)}`));
        return;
      }
      resolve(out.split(/\r?\n/).filter((line) => line.trim().length > 0));
    });
  });
}
