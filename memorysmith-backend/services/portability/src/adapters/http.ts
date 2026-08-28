/**
 * HTTP surface of svc-portability (architecture-guide.md, sections 14.1, 16):
 *
 *   POST /vaults/:v/export   ->  a ready archive and a short-lived link
 *
 * The export is answered as a LINK and never as a body. A vault of two
 * thousand notes is megabytes of Markdown, and a synchronous response has a
 * ceiling that a large vault would hit exactly when the export matters most.
 * The link points at one object, expires in fifteen minutes and is the only
 * way to reach it: the bucket blocks public access.
 *
 * Portability holds no vault, so whether the caller may read it is answered by
 * the context that owns it, exactly as Discovery does (section 14.2).
 */

import { Hono, type Context } from 'hono';
import {
  DomainError,
  httpStatusFor,
  Instant,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type { ExportVault } from '../application/ExportVault.js';

export interface PortabilityRequest {
  readonly subscription: SubscriptionContext;
  readonly canRead: (vaultId: string) => Promise<boolean>;
}

export interface PortabilityUseCases {
  readonly exportVault: (request: PortabilityRequest) => ExportVault;
}

type Variables = { portability: PortabilityRequest };

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function present<T, U>(c: Context, result: Result<T, DomainError>, map: (value: T) => U): Response {
  return result.ok ? c.json(map(result.value) as object, 200) : fail(c, result.error);
}

export function createPortabilityRoutes(
  useCases: PortabilityUseCases,
): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  app.post('/vaults/:v/export', async (c) => {
    const request = c.get('portability');
    const vaultId = c.req.param('v') ?? '';
    // A vault the caller cannot read is indistinguishable from a missing one.
    if (!(await request.canRead(vaultId))) {
      return fail(c, DomainError.forbidden('Vault not found'));
    }

    const job = await useCases.exportVault(request).execute({ vaultId, now: Instant.now() });
    return present(c, job, (value) => ({
      exportId: value.exportId,
      vaultId: value.vaultId,
      status: value.status,
      requestedAt: Instant.now().toISOString(),
      downloadUrl: value.downloadUrl,
      expiresAt: value.expiresAt,
      noteCount: value.noteCount,
      bytes: value.bytes,
    }));
  });

  return app;
}
