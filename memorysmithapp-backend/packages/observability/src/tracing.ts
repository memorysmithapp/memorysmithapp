/**
 * The trace of an operation (#271): where the time of one call went, as X-Ray
 * draws it, with the same identifiers the line of the log carries.
 *
 * Every function runs with active tracing (`ServiceLambda`), so Lambda opens a
 * segment per invocation. That segment cannot be annotated, so each operation
 * opens a subsegment of its own, named after it, and the annotations go there:
 * a trace is then searched by what it did — `annotation.flow = "write"`,
 * `annotation.correlationId = "…"` — and not only by its id.
 *
 * The Tracer captures HTTPS and `fetch` globally, so the calls to DynamoDB, S3,
 * SQS and EventBridge show as subsegments named by their host, and a call from
 * the connector to the core carries the trace header. The HTTP API in between
 * opens no trace of its own, so the core starts a new one: the two are linked by
 * the correlation id they both carry, as the asynchronous half is, since a
 * DynamoDB stream propagates no trace at all.
 *
 * Annotations are identifiers only, under the rule of the log (`./fields`), and
 * outside Lambda the Tracer is disabled, so nothing here runs in a test.
 */

import { Tracer } from '@aws-lambda-powertools/tracer';
import type { OperationLine } from './fields.js';

/** The business flow an operation belongs to, which a trace is filtered by. */
export const FLOWS = [
  'onboarding',
  'connect-agent',
  'write',
  'file-upload',
  'share',
  'export',
  'import',
  'print',
] as const;
export type Flow = (typeof FLOWS)[number];

/**
 * In order: the first that matches decides. An operation is an MCP tool, the
 * template of an HTTP route, or the event or job a worker handles.
 */
const FLOW_OF: ReadonlyArray<readonly [RegExp, Flow]> = [
  // Asking for a subscription and the first steps after it; a refresh of a
  // token or a read of the session happens on every visit, and is no step.
  [/^POST .*\/(subscriptions|requests|password|session\/welcomed)\b|^Subscription/, 'onboarding'],
  [/^whoami$|\/authorize\b|\/callback\b|\/token\b|\/connector\b|oauth|^Connector/, 'connect-agent'],
  [
    /file_upload|send_file_part|^(keep|request|delete)_file$|\/uploads\b|\/files\b|^NotebookFile|^Upload/,
    'file-upload',
  ],
  [/\/shares?\b|\/shared\b|^Share|^Notebook(Shared|Unshared)/, 'share'],
  [/\/export\b|^Export|export/i, 'export'],
  [/\/imports?\b|^Import|import/i, 'import'],
  [/\/pdf\b|\/prints?\b|\/previews?\b|^Print|^Preview/, 'print'],
  [
    /^(create|update|delete|move|reorder)_|^set_(note_order|guidance|template)$|^(PUT|POST|PATCH|DELETE) .*\/notebooks\b|^(Note|Notebook|Folder|Guidance|Template)[A-Z]/,
    'write',
  ],
];

/** The flow of an operation, or undefined when it belongs to none. */
export function flowOf(operation: string): Flow | undefined {
  return FLOW_OF.find(([pattern]) => pattern.test(operation))?.[1];
}

/** What a subsegment of an operation is annotated with: the line's identifiers and its flow. */
export type TraceAnnotations = Readonly<Record<string, string>>;

export function traceAnnotationsOf(
  line: Pick<
    OperationLine,
    'operation' | 'outcome' | 'correlationId' | 'subscriptionId' | 'channel' | 'agentClient'
  >,
): TraceAnnotations {
  const flow = flowOf(line.operation);
  const annotations: Record<string, string> = {
    operation: line.operation,
    outcome: line.outcome,
  };
  if (flow) annotations['flow'] = flow;
  if (line.correlationId) annotations['correlationId'] = line.correlationId;
  if (line.subscriptionId) annotations['subscriptionId'] = line.subscriptionId;
  if (line.channel) annotations['channel'] = line.channel;
  if (line.agentClient) annotations['agentClient'] = line.agentClient;
  return annotations;
}

/**
 * Created when the module loads, before any client of the AWS SDK sends a
 * request, so the global capture of HTTPS is in place for the first one.
 */
const tracer = new Tracer();

/** The subsegment of one operation, or null where nothing is traced. */
export interface OperationTrace {
  /** Annotates the subsegment and closes it, giving the segment back. */
  end(annotations: TraceAnnotations, error?: unknown): void;
  /** One more subsegment under this one, annotated and closed at once: an item of a batch. */
  mark(name: string, annotations: TraceAnnotations): void;
}

/**
 * Opens the subsegment of an operation and makes it the current one. A trace
 * never takes the operation down with it: whatever the SDK of X-Ray throws is
 * swallowed, and the operation runs untraced.
 */
export function startTrace(name: string): OperationTrace | null {
  if (!tracer.isTracingEnabled()) return null;
  try {
    const parent = tracer.getSegment();
    if (!parent) return null;
    const subsegment = parent.addNewSubsegment(`## ${name}`);
    tracer.setSegment(subsegment);
    const annotate = (
      target: { addAnnotation(key: string, value: string): void },
      annotations: TraceAnnotations,
    ) => {
      for (const [key, value] of Object.entries(annotations)) target.addAnnotation(key, value);
    };
    return {
      end(annotations, error) {
        try {
          annotate(subsegment, annotations);
          if (error instanceof Error) subsegment.addError(error);
          subsegment.close();
          tracer.setSegment(parent);
        } catch {
          // Untraced, never broken.
        }
      },
      mark(markName, annotations) {
        try {
          const item = subsegment.addNewSubsegment(`## ${markName}`);
          annotate(item, annotations);
          item.close();
        } catch {
          // Untraced, never broken.
        }
      },
    };
  } catch {
    return null;
  }
}
