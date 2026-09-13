/**
 * Calling the product API, for the commands that operate an environment
 * through it rather than behind it.
 *
 * Everything goes through the API on purpose: a command that wrote into
 * DynamoDB or S3 by hand would produce a notebook with no revisions, no domain
 * events and no audit trail, the three things that make a write of this product
 * a write of this product. The cost is one call per note, and it is the right
 * cost.
 */

type Sleep = (milliseconds: number) => Promise<void>;

const wait: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class ProductApi {
  constructor(
    private readonly origin: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: Sleep = wait,
  ) {}

  /**
   * One call, answering the parsed body, or null for an empty one, and
   * throwing with the answer of the API.
   *
   * A notebook of six hundred notes is six hundred calls, and one throttle or
   * one bad gateway in the middle of it would throw the whole run away. Only
   * 429 and 5xx are asked again, three times at most: a 4xx is an answer, and
   * repeating it would only ask the same wrong question again.
   */
  async call<T = unknown>(method: string, path: string, token: string, body?: unknown): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const response = await this.fetchImpl(`${this.origin}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const content = await response.text();
      if (response.ok) return (content ? JSON.parse(content) : null) as T;

      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt >= 4) {
        throw new Error(`${method} ${path} answered ${response.status}: ${content}`);
      }
      await this.sleep(1000 * 2 ** attempt);
    }
  }
}
