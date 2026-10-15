/**
 * What a line of the log may say, and nothing else (architecture-guide.md,
 * section 17).
 *
 * A log is a copy of whatever it holds, kept a month and read by whoever
 * operates the account. So a line carries identifiers and measurements, and
 * never content: no note name, notebook name, file name, path, query text or
 * body ever reaches it, because the backend does not interpret content (rule 5)
 * and a log would be the one place it kept a copy anyway.
 *
 * The rule is held by code rather than by care: every line is built from the
 * allow-list below, a key outside it is dropped before the logger sees it, and
 * a value is kept only when it has the shape its field declares. A test fails
 * when a line carries anything else.
 */

/** Through what the operation came: the interface, or an agent's connector. */
export const CHANNELS = ['web', 'mcp'] as const;
export type Channel = (typeof CHANNELS)[number];

/** How an operation ended. */
export const OUTCOMES = ['ok', 'refused', 'conflict', 'error'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The fields of an operation line, and the only ones a line of ours may carry. */
export const OPERATION_FIELDS = [
  'operation',
  'outcome',
  'durationMs',
  'correlationId',
  'subscriptionId',
  'userId',
  'channel',
  'agentClient',
  'status',
  'eventId',
  'errorName',
  'errorCode',
  'errorFrames',
] as const;

/** What Powertools writes on every line by itself. */
export const LOGGER_FIELDS = [
  'level',
  'message',
  'timestamp',
  'service',
  'sampling_rate',
  'xray_trace_id',
  'cold_start',
  'function_arn',
  'function_memory_size',
  'function_name',
  'function_request_id',
] as const;

/** Every key a written line may hold. */
export const LOG_LINE_FIELDS: ReadonlySet<string> = new Set<string>([
  ...OPERATION_FIELDS,
  ...LOGGER_FIELDS,
]);

/** The message of every operation line: constant, so it can never carry a value. */
export const OPERATION_MESSAGE = 'operation';

export interface OperationLine {
  /** The MCP tool, the HTTP route template, or the event or job kind of a worker. */
  readonly operation: string;
  readonly outcome: Outcome;
  readonly durationMs: number;
  readonly correlationId?: string;
  readonly subscriptionId?: string;
  readonly userId?: string;
  readonly channel?: Channel;
  /** The `clientName` of the Authorship, when an agent wrote through a connector. */
  readonly agentClient?: string;
  /** The HTTP status answered, on a line of an HTTP API. */
  readonly status?: number;
  /** The event a worker handled. */
  readonly eventId?: string;
  /** The class of what was thrown, never its message, which may quote content. */
  readonly errorName?: string;
  /** The code of the error taxonomy (section 15), or of a failure a worker names. */
  readonly errorCode?: string;
  /** Where it was thrown: the frames of the stack, and not the line holding the message. */
  readonly errorFrames?: readonly string[];
}

export type OperationField = (typeof OPERATION_FIELDS)[number];

/** An identifier: a ULID, a UUID, a Cognito `sub`, a request id. */
const IDENTIFIER = /^[A-Za-z0-9._:=+-]{1,128}$/;
/** A route template, a tool name or an event type, which code chose and nobody typed. */
const OPERATION = /^[A-Za-z0-9 _:/.{}|*@-]{1,160}$/;
/** A code of the taxonomy, or a failure a worker names. */
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The name of an error class. */
const ERROR_NAME = /^[A-Za-z_$][A-Za-z0-9_$.]{0,63}$/;
/** One frame of a stack: `at` a function and a place in the bundle. */
const FRAME = /^at [^\n]{1,300}$/;
/** The name a connector gave itself, without what would break a line. */
const CONTROL = /\p{Cc}/gu;
const MAX_FRAMES = 12;

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && IDENTIFIER.test(value) ? value : undefined;
}

/**
 * The line as it is written: every key outside the allow-list dropped, and
 * every value that does not have the shape of its field dropped too. Nothing
 * here throws, because a log line that throws takes the request with it.
 */
export function sanitize(input: Readonly<Record<string, unknown>>): OperationLine {
  const line: Record<string, unknown> = {};
  const operation = input['operation'];
  line['operation'] =
    typeof operation === 'string' && OPERATION.test(operation) ? operation : 'unnamed';
  const outcome = input['outcome'];
  line['outcome'] = (OUTCOMES as readonly unknown[]).includes(outcome) ? outcome : 'error';
  const duration = input['durationMs'];
  line['durationMs'] =
    typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? Math.round(duration)
      : 0;

  for (const key of ['correlationId', 'subscriptionId', 'userId', 'eventId'] as const) {
    const value = identifier(input[key]);
    if (value !== undefined) line[key] = value;
  }
  const channel = input['channel'];
  if ((CHANNELS as readonly unknown[]).includes(channel)) line['channel'] = channel;
  const agentClient = input['agentClient'];
  if (typeof agentClient === 'string' && agentClient.length > 0) {
    line['agentClient'] = agentClient.replace(CONTROL, ' ').slice(0, 200);
  }
  const status = input['status'];
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status < 600) {
    line['status'] = status;
  }
  const errorName = input['errorName'];
  if (typeof errorName === 'string' && ERROR_NAME.test(errorName)) line['errorName'] = errorName;
  const errorCode = input['errorCode'];
  if (typeof errorCode === 'string' && CODE.test(errorCode)) line['errorCode'] = errorCode;
  const frames = input['errorFrames'];
  if (Array.isArray(frames)) {
    const kept = frames
      .filter((frame): frame is string => typeof frame === 'string' && FRAME.test(frame))
      .slice(0, MAX_FRAMES);
    if (kept.length > 0) line['errorFrames'] = kept;
  }
  return line as unknown as OperationLine;
}

/** How an HTTP answer ended, read from its status. */
export function outcomeOfStatus(status: number): Outcome {
  if (status < 400) return 'ok';
  if (status === 409 || status === 412) return 'conflict';
  if (status < 500) return 'refused';
  return 'error';
}

/** How an operation ended, read from the code of the taxonomy it was refused with. */
export function outcomeOfCode(code: string): Outcome {
  switch (code) {
    case 'CONFLICT':
    case 'PRECONDITION_FAILED':
    case 'ALREADY_EXISTS':
      return 'conflict';
    case 'INTERNAL':
      return 'error';
    default:
      return 'refused';
  }
}

/**
 * What a line says about something thrown: its class, its code when it has one
 * of the taxonomy, and where it was thrown. Never its message, which is where
 * content would come in — a refusal quoting the name it refused, a parser
 * quoting the line it could not read.
 */
export function errorFieldsOf(
  error: unknown,
): Pick<OperationLine, 'errorName' | 'errorCode' | 'errorFrames'> {
  if (!(error instanceof Error)) return { errorName: typeof error };
  const code = (error as { code?: unknown }).code;
  const frames = (error.stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
  return {
    errorName: error.name,
    ...(typeof code === 'string' && CODE.test(code) ? { errorCode: code } : {}),
    ...(frames.length > 0 ? { errorFrames: frames.slice(0, MAX_FRAMES) } : {}),
  };
}
