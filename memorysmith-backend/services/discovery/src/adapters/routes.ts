/**
 * HTTP surface of svc-discovery (architecture-guide.md, section 14.1):
 *
 *   GET  /notebooks/:v/graph
 *   GET  /notebooks/:v/notes/:n/graph?depth=
 *   GET  /notebooks/:v/notes/:n/backlinks
 *   GET  /notebooks/:v/notes/:n/links     where the links of a note go
 *   GET  /notebooks/:v/links/:target      what one wikilink target resolves to
 *   GET  /notebooks/:v/health
 *   GET  /notebooks/:v/facets
 *   POST /notebooks/:v/search   { query }   lexical, over names and folders
 *
 * Every route reads a projection. None of them touches a note, and none of
 * them is consulted by the Knowledge context (RN-DSC-017).
 */

import { Hono, type Context } from 'hono';
import {
  DomainError,
  httpStatusFor,
  type Result,
  type SubscriptionContext,
} from '@memorysmith/kernel';
import type {
  Backlinks,
  GetFacetStats,
  NoteLinks,
  RelatedNotes,
  ResolveLinkTarget,
  SearchNotes,
  NotebookGraphQuery,
  NotebookHealth,
} from '../application/queries.js';

export interface DiscoveryRequest {
  readonly subscription: SubscriptionContext;
  /**
   * Whether the caller may read that notebook. Discovery holds no notebook, so the
   * decision belongs to the context that owns it, and it arrives as a
   * question this request can ask (section 14.2).
   */
  readonly canRead: (notebookId: string) => Promise<boolean>;
}

export interface DiscoveryUseCases {
  readonly related: (request: DiscoveryRequest) => RelatedNotes;
  readonly backlinks: (request: DiscoveryRequest) => Backlinks;
  readonly noteLinks: (request: DiscoveryRequest) => NoteLinks;
  readonly resolveLinkTarget: (request: DiscoveryRequest) => ResolveLinkTarget;
  readonly health: (request: DiscoveryRequest) => NotebookHealth;
  readonly graph: (request: DiscoveryRequest) => NotebookGraphQuery;
  readonly search: (request: DiscoveryRequest) => SearchNotes;
  readonly facets: (request: DiscoveryRequest) => GetFacetStats;
}

type Variables = { discovery: DiscoveryRequest };

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function present<T, U>(c: Context, result: Result<T, DomainError>, map: (value: T) => U): Response {
  return result.ok ? c.json(map(result.value) as object, 200) : fail(c, result.error);
}

/** A notebook the caller cannot read is indistinguishable from a missing one. */
async function guard(request: DiscoveryRequest, notebookId: string): Promise<DomainError | null> {
  return (await request.canRead(notebookId)) ? null : DomainError.forbidden('Notebook not found');
}

export function createDiscoveryRoutes(useCases: DiscoveryUseCases): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>();

  /**
   * The whole link graph of the notebook. It is a different question from the
   * route below, which walks OUT from one note under a depth ceiling: here
   * there is no root, and the ceiling is on how many notes come back.
   */
  app.get('/notebooks/:v/graph', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const graph = await useCases.graph(request).execute({ notebookId });
    return present(c, graph, (value) => value);
  });

  app.get('/notebooks/:v/notes/:n/graph', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const depth = Number(c.req.query('depth') ?? '2');
    const tree = await useCases.related(request).execute({
      notebookId,
      noteId: c.req.param('n') ?? '',
      ...(Number.isFinite(depth) ? { depth } : {}),
    });
    return present(c, tree, (node) => node);
  });

  /** Every target a note writes and what each reaches (RN-AGT-034). */
  app.get('/notebooks/:v/notes/:n/links', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const found = await useCases
      .noteLinks(request)
      .execute({ notebookId, noteId: c.req.param('n') ?? '' });
    return present(c, found, (links) => ({ links }));
  });

  app.get('/notebooks/:v/notes/:n/backlinks', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const found = await useCases
      .backlinks(request)
      .execute({ notebookId, noteId: c.req.param('n') ?? '' });
    return present(c, found, (backlinks) => ({ backlinks }));
  });

  /**
   * The target is percent-decoded by the router before it reaches here, which
   * is the first of the three steps §5.2 fixes; the other two — NFC and
   * case-exact — belong to the resolver, so both surfaces compare the same
   * way (RN-DSC-056).
   */
  app.get('/notebooks/:v/links/:target', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const resolved = await useCases
      .resolveLinkTarget(request)
      .execute({ notebookId, target: c.req.param('target') ?? '' });
    return present(c, resolved, (answer) => answer);
  });

  app.get('/notebooks/:v/health', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const health = await useCases.health(request).execute({ notebookId });
    // Once, under the name RN-DSC-004 gives them: this route used to answer the
    // same list twice, the second time as broken links, which nothing here is.
    return present(c, health, (value) => ({
      orphans: value.orphans,
      pendingLinks: value.pending,
    }));
  });

  app.get('/notebooks/:v/facets', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const stats = await useCases.facets(request).execute({ notebookId });
    return present(c, stats, (value) => value);
  });

  app.post('/notebooks/:v/search', async (c) => {
    const request = c.get('discovery');
    const notebookId = c.req.param('v') ?? '';
    const denied = await guard(request, notebookId);
    if (denied) return fail(c, denied);

    const body = (await c.req.json().catch(() => ({}))) as {
      query?: string;
      k?: number;
    };
    const found = await useCases.search(request).execute({
      notebookId,
      query: String(body.query ?? ''),
      ...(typeof body.k === 'number' ? { k: body.k } : {}),
    });
    return present(c, found, (hits) => ({ mode: 'lexical', hits }));
  });

  return app;
}
