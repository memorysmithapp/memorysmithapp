/**
 * What a trace is annotated with (#271): the flow an operation belongs to, and
 * the identifiers of its line, never anything else. Outside Lambda the Tracer
 * is disabled, so opening a trace answers nothing and an operation runs as it
 * always did.
 */

import { describe, expect, it } from 'vitest';
import { flowOf, startTrace, traceAnnotationsOf } from '../src/tracing.js';
import { observe } from '../src/operation.js';

describe('the flow of an operation', () => {
  it.each([
    ['create_note', 'write'],
    ['update_note', 'write'],
    ['set_guidance', 'write'],
    ['PUT /knowledge/notebooks/:notebookId/notes/:noteId', 'write'],
    ['NoteUpdated', 'write'],
    ['begin_file_upload', 'file-upload'],
    ['PUT /portability/uploads/:uploadId/parts/:part', 'file-upload'],
    ['POST /knowledge/notebooks/:notebookId/files', 'file-upload'],
    ['POST /access/notebooks/:notebookId/shares', 'share'],
    ['POST /portability/notebooks/:notebookId/export', 'export'],
    ['POST /portability/imports', 'import'],
    ['POST /knowledge/notebooks/:notebookId/notes/:noteId/pdf', 'print'],
    ['POST /access/subscriptions', 'onboarding'],
    ['whoami', 'connect-agent'],
    ['GET /authorize', 'connect-agent'],
  ])('%s is %s', (operation, flow) => {
    expect(flowOf(operation)).toBe(flow);
  });

  it.each([
    'read_note',
    'GET /knowledge/notebooks/:notebookId/notes/:noteId',
    'GET /access/session',
    'TokenGeneration',
  ])('%s belongs to no flow', (operation) => {
    expect(flowOf(operation)).toBeUndefined();
  });
});

describe('the annotations of a trace', () => {
  it('are the identifiers of the line and its flow, and nothing else', () => {
    expect(
      traceAnnotationsOf({
        operation: 'create_note',
        outcome: 'ok',
        correlationId: 'c0ffee00-0000-4000-8000-000000000000',
        subscriptionId: '01SUBSCRIPTION0000000000AA',
        channel: 'mcp',
        agentClient: 'claude-ai',
      }),
    ).toEqual({
      operation: 'create_note',
      outcome: 'ok',
      flow: 'write',
      correlationId: 'c0ffee00-0000-4000-8000-000000000000',
      subscriptionId: '01SUBSCRIPTION0000000000AA',
      channel: 'mcp',
      agentClient: 'claude-ai',
    });
  });
});

describe('outside Lambda', () => {
  it('opens no trace, and an operation still runs and answers', async () => {
    expect(startTrace('create_note')).toBeNull();
    await expect(observe({ operation: 'create_note' }, async () => 42)).resolves.toBe(42);
  });
});
