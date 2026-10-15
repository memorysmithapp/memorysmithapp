/**
 * The API of the product as a case calls it: plain HTTP, a bearer token, and
 * nothing of the product imported (architecture-guide.md, section 19).
 *
 * Every call records how long it took, under the route it reached and not the
 * identifiers it carried, so the report can put the calls of one route together.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPORT_DIRECTORY } from './state.js';

export interface Answer<T> {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;
}

/** An identifier of the product is a ULID; in a latency line it is just `:id`. */
export function operationOf(method: string, path: string): string {
  const route = path.replace(/\?.*$/, '').replace(/\/[0-9A-HJKMNP-TV-Z]{26}(?=\/|$)/g, '/:id');
  return `${method} ${route}`;
}

export function recordLatency(operation: string, milliseconds: number): void {
  mkdirSync(REPORT_DIRECTORY, { recursive: true });
  appendFileSync(
    join(REPORT_DIRECTORY, 'latencies.jsonl'),
    `${JSON.stringify({ operation, milliseconds: Math.round(milliseconds) })}\n`,
  );
}

export class Api {
  constructor(
    private readonly origin: string,
    private readonly token: string | null = null,
  ) {}

  /** The same API, called as someone else. */
  as(token: string | null): Api {
    return new Api(this.origin, token);
  }

  async call<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Answer<T>> {
    const started = performance.now();
    const response = await fetch(`${this.origin}${path}`, {
      method,
      headers: {
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    recordLatency(operationOf(method, path), performance.now() - started);

    const json = (response.headers.get('content-type') ?? '').includes('json');
    return {
      status: response.status,
      headers: response.headers,
      body: (json && text ? JSON.parse(text) : text) as T,
    };
  }

  /** A call that has to succeed, and says what came back when it does not. */
  async ok<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
    const answer = await this.call<T>(method, path, body);
    if (answer.status < 200 || answer.status >= 300) {
      throw new Error(
        `${method} ${path} answered ${answer.status}: ${JSON.stringify(answer.body)}`,
      );
    }
    return answer.body;
  }
}
