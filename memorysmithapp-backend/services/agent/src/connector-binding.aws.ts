/**
 * The SigV4 signer of the connector binding route (architecture-guide.md,
 * sections 13.3 and 14.1).
 *
 * The route of Access is authorized by IAM at the gateway, and only the role of
 * this function may invoke it, so the proxy signs with the credentials the
 * runtime puts in the environment of the function.
 *
 * Like secrets.aws.ts, nothing on the HTTP surface imports this file: the Lambda
 * entrypoint wires it in.
 */

import { createHash, createHmac, type Hash, type Hmac } from 'node:crypto';
import { SignatureV4 } from '@smithy/signature-v4';
import type { RequestSigner } from './connector-binding.js';

type SourceData = string | ArrayBuffer | ArrayBufferView;

function bytes(data: SourceData): Buffer {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  return Buffer.from(data);
}

/**
 * SHA-256 over the crypto of the runtime, in the shape the signer builds: a hash
 * when constructed bare, and an HMAC when constructed with a key.
 */
class Sha256 {
  private digestor: Hash | Hmac;

  constructor(private readonly secret?: SourceData) {
    this.digestor = this.fresh();
  }

  update(data: SourceData): void {
    this.digestor.update(bytes(data));
  }

  async digest(): Promise<Uint8Array> {
    return new Uint8Array(this.digestor.digest());
  }

  reset(): void {
    this.digestor = this.fresh();
  }

  private fresh(): Hash | Hmac {
    return this.secret === undefined
      ? createHash('sha256')
      : createHmac('sha256', bytes(this.secret));
  }
}

export function sigV4Signer(env: NodeJS.ProcessEnv = process.env): RequestSigner {
  const signer = new SignatureV4({
    service: 'execute-api',
    region: env['AWS_REGION'] ?? 'us-east-1',
    credentials: async () => ({
      accessKeyId: env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: env['AWS_SECRET_ACCESS_KEY'] ?? '',
      ...(env['AWS_SESSION_TOKEN'] ? { sessionToken: env['AWS_SESSION_TOKEN'] } : {}),
    }),
    sha256: Sha256,
  });

  return async (request) => {
    const signed = await signer.sign({
      method: request.method,
      protocol: request.url.protocol,
      hostname: request.url.hostname,
      path: request.url.pathname,
      query: {},
      headers: { ...request.headers, host: request.url.host },
      body: request.body,
    });
    // The host was signed, and fetch sends it from the URL itself.
    const { host: _signedHost, ...headers } = signed.headers;
    return headers;
  };
}
