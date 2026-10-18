import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { captureLines, type Line } from './capture.js';
import {
  CORRELATION_HEADER,
  LOG_LINE_FIELDS,
  annotate,
  currentCorrelationId,
  observe,
  observeBatch,
  outcomeOfStatus,
  sanitize,
  startOfEvent,
  writeOperation,
} from '../src/index.js';
import { operationErrorHandler, operationLog } from '../src/hono.js';

let capture: ReturnType<typeof captureLines>;
beforeEach(() => {
  capture = captureLines();
});
afterEach(() => capture.restore());

function outsideTheAllowList(line: Line): string[] {
  return Object.keys(line).filter((key) => !LOG_LINE_FIELDS.has(key));
}

const SUBSCRIPTION = '01JABCDEFGHJKMNPQRSTVWXYZ0';
const EVENT = '01JABCDEFGHJKMNPQRSTVWXYZ1';

describe('the line of one operation', () => {
  it('carries the fields of the allow-list and the ones Powertools writes, and nothing else', () => {
    writeOperation({
      operation: 'create_note',
      outcome: 'ok',
      durationMs: 12.6,
      correlationId: 'corr-0001',
      subscriptionId: SUBSCRIPTION,
      userId: 'b4c8f1e2-0000-4000-8000-000000000001',
      channel: 'mcp',
      agentClient: 'Claude',
    });

    const [line] = capture.lines;
    expect(line).toMatchObject({
      level: 'INFO',
      message: 'operation',
      service: 'TestFunction',
      operation: 'create_note',
      outcome: 'ok',
      durationMs: 13,
      correlationId: 'corr-0001',
      subscriptionId: SUBSCRIPTION,
      userId: 'b4c8f1e2-0000-4000-8000-000000000001',
      channel: 'mcp',
      agentClient: 'Claude',
    });
    expect(typeof line!['timestamp']).toBe('string');
    expect(outsideTheAllowList(line!)).toEqual([]);
  });

  it('drops a field outside the allow-list, so content cannot ride in on one', () => {
    const smuggled = {
      operation: 'update_note',
      outcome: 'ok',
      durationMs: 1,
      noteName: 'Contratação Direta 2.0',
      body: '# A whole note',
      query: 'what somebody searched for',
      path: '/knowledge/notebooks/x/notes/y',
    } as unknown as Parameters<typeof writeOperation>[0];
    writeOperation(smuggled);

    const [line] = capture.lines;
    expect(outsideTheAllowList(line!)).toEqual([]);
    expect(JSON.stringify(line)).not.toMatch(/Contratação|whole note|searched|notebooks\/x/);
  });

  it('drops a value that does not have the shape of its field', () => {
    const line = sanitize({
      operation: 'a note named Contratação Direta 2.0, typed by someone',
      outcome: 'fine',
      durationMs: -3,
      subscriptionId: 'not an id, a sentence',
      errorCode: 'the note "X" already exists',
      errorFrames: ['Error: the note "X" already exists', 'at handler (index.mjs:1:2)'],
    });
    expect(line).toEqual({
      operation: 'unnamed',
      outcome: 'error',
      durationMs: 0,
      errorFrames: ['at handler (index.mjs:1:2)'],
    });
  });

  it('reads an outcome off an HTTP status', () => {
    expect([200, 204, 302, 400, 404, 409, 412, 413, 500].map(outcomeOfStatus)).toEqual([
      'ok',
      'ok',
      'ok',
      'refused',
      'refused',
      'conflict',
      'conflict',
      'refused',
      'error',
    ]);
  });
});

describe('observe, the wrapper of a worker', () => {
  it('writes one line with the duration, under the id it was handed', async () => {
    let seen: string | undefined;
    await observe({ operation: 'NoteCreated', correlationId: 'corr-0002' }, async () => {
      seen = currentCorrelationId();
      annotate({ subscriptionId: SUBSCRIPTION });
    });
    expect(seen).toBe('corr-0002');
    expect(capture.lines).toHaveLength(1);
    expect(capture.lines[0]).toMatchObject({
      operation: 'NoteCreated',
      outcome: 'ok',
      correlationId: 'corr-0002',
      subscriptionId: SUBSCRIPTION,
    });
  });

  it('writes a throw as an error, with the class and frames and never the message', async () => {
    await expect(
      observe({ operation: 'print' }, async () => {
        throw new Error('the note "Contratação Direta 2.0" could not be drawn');
      }),
    ).rejects.toThrow();
    const [line] = capture.lines;
    expect(line).toMatchObject({ level: 'ERROR', outcome: 'error', errorName: 'Error' });
    expect(typeof line!['correlationId']).toBe('string');
    expect(JSON.stringify(line)).not.toContain('Contratação');
    expect(outsideTheAllowList(line!)).toEqual([]);
  });

  it('writes one line per item of a batch, each under the id of its own envelope', async () => {
    const envelopes = [
      {
        eventId: EVENT,
        type: 'NoteCreated',
        subscriptionId: SUBSCRIPTION,
        correlationId: 'corr-0003',
        authorship: {
          userId: 'user-1',
          agent: { clientId: 'https://claude.ai', clientName: 'Claude' },
        },
        payload: { name: 'Contratação Direta 2.0' },
      },
      { eventId: EVENT, type: 'FolderAdded', subscriptionId: SUBSCRIPTION, payload: {} },
    ];
    await observeBatch(
      envelopes,
      (each) => startOfEvent(each),
      async () => undefined,
    );
    expect(capture.lines.map((line) => line['operation'])).toEqual(['NoteCreated', 'FolderAdded']);
    expect(capture.lines[0]).toMatchObject({
      correlationId: 'corr-0003',
      eventId: EVENT,
      userId: 'user-1',
      channel: 'mcp',
      agentClient: 'Claude',
    });
    expect(capture.lines[1]!['correlationId']).toBeUndefined();
    expect(JSON.stringify(capture.lines)).not.toContain('Contratação');
  });
});

describe('the middleware of an HTTP API', () => {
  function app(): Hono {
    const hono = new Hono();
    hono.use('*', operationLog());
    hono.onError(operationErrorHandler);
    hono.get('/knowledge/notebooks/:notebookId/notes/:noteId', (c) => {
      annotate({ subscriptionId: SUBSCRIPTION, channel: 'web' });
      return c.json({ correlationId: currentCorrelationId() });
    });
    hono.post('/knowledge/notebooks/:notebookId/notes', (c) => c.json({}, 409));
    hono.get('/boom', () => {
      throw new Error('a message quoting Contratação Direta 2.0');
    });
    return hono;
  }

  it('names the route by its template and never by the path it was called on', async () => {
    const response = await app().request('/knowledge/notebooks/NB1/notes/N1');
    const [line] = capture.lines;
    expect(line).toMatchObject({
      operation: 'GET /knowledge/notebooks/:notebookId/notes/:noteId',
      outcome: 'ok',
      status: 200,
      subscriptionId: SUBSCRIPTION,
      channel: 'web',
    });
    expect(JSON.stringify(line)).not.toContain('NB1');
    // The scope reaches the handler, and the id is answered back.
    const body = (await response.json()) as { correlationId: string };
    expect(body.correlationId).toBe(line!['correlationId']);
    expect(response.headers.get(CORRELATION_HEADER)).toBe(line!['correlationId']);
  });

  it('keeps the id an upstream hop handed in its header', async () => {
    await app().request('/knowledge/notebooks/NB1/notes', {
      method: 'POST',
      headers: { [CORRELATION_HEADER]: 'mcp-request-0001' },
    });
    expect(capture.lines[0]).toMatchObject({
      correlationId: 'mcp-request-0001',
      outcome: 'conflict',
      status: 409,
    });
  });

  it('takes the id API Gateway gave the request when none was handed', async () => {
    await app().request(
      '/knowledge/notebooks/NB1/notes/N1',
      {},
      {
        event: { requestContext: { requestId: 'Ab1cDEfGhIJKlmN=' } },
      },
    );
    expect(capture.lines[0]!['correlationId']).toBe('Ab1cDEfGhIJKlmN=');
  });

  it('writes a throw on the line of its request, without its message', async () => {
    const response = await app().request('/boom');
    expect(response.status).toBe(500);
    expect(capture.lines).toHaveLength(1);
    expect(capture.lines[0]).toMatchObject({ outcome: 'error', status: 500, errorName: 'Error' });
    expect(JSON.stringify(capture.lines)).not.toContain('Contratação');
    expect(outsideTheAllowList(capture.lines[0]!)).toEqual([]);
  });
});
