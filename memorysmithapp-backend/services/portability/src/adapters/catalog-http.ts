/**
 * The routes of the community catalog that no subscription is behind (#360).
 *
 * The public ones answer anybody, an account or none, and are served by a
 * handler of their own whose permissions reach the catalog entries and what a
 * model notebook is read with, and nothing written (#356, #431): every read
 * starts from an entry, the one way a public request reaches a subscription
 * (INV-02). Their answers may be kept at the edge for a minute; a withdrawal
 * empties it.

 */

import { Hono, type Context } from 'hono';
import { DomainError, httpStatusFor } from '@memorysmithapp/kernel';
import type {
  ReadCatalogContents,
  ReadCatalogHistory,
  ReadCatalogModel,
  SearchCatalog,
} from '../application/Catalog.js';
import { documentToDto } from './http.js';

/** How long the edge keeps a public answer (#356): short, so a change of the model shows soon. */
export const PUBLIC_MAX_AGE_SECONDS = 60;

/**
 * How long past that the edge still answers what it holds while it asks for a
 * fresh one (#420), so the person who arrives after the minute does not wait
 * for a function nobody called in a while. Publishing and withdrawing empty
 * the edge, so nothing withdrawn is answered from it.
 */
export const PUBLIC_STALE_SECONDS = 300;

/** The most models one page of the search answers (#432). */
export const MAX_PAGE = 50;

export interface PublicCatalogUseCases {
  readonly search: () => SearchCatalog;
  readonly readModel: () => ReadCatalogModel;
  readonly readContents: () => ReadCatalogContents;
  readonly readHistory: () => ReadCatalogHistory;
}

function fail(c: Context, error: DomainError): Response {
  return c.json({ code: error.code, message: error.message }, httpStatusFor(error) as 400);
}

function cached(c: Context, body: object): Response {
  c.header(
    'cache-control',
    `public, max-age=${PUBLIC_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_STALE_SECONDS}`,
  );
  return c.json(body, 200);
}

export function createPublicCatalogRoutes(useCases: PublicCatalogUseCases): Hono {
  const app = new Hono();

  app.get('/', async (c) => {
    const language = c.req.query('language')?.trim() || null;
    const asked = c.req.query('limit');
    const limit = asked === undefined ? undefined : Number(asked);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE)) {
      return fail(c, DomainError.validation(`A page holds from 1 to ${MAX_PAGE} models`));
    }
    const found = await useCases.search().execute({
      text: c.req.query('q') ?? '',
      language,
      limit,
      cursor: c.req.query('cursor') ?? null,
    });
    return cached(c, found);
  });

  app.get('/:p', async (c) => {
    const read = await useCases.readModel().execute(c.req.param('p'));
    return read.ok ? cached(c, read.value) : fail(c, read.error);
  });

  /** The model notebook as it stands, read whole (#431). */
  app.get('/:p/contents', async (c) => {
    const read = await useCases.readContents().execute(c.req.param('p'));
    if (!read.ok) return fail(c, read.error);
    const { model, document, references } = read.value;
    return cached(c, {
      model,
      objective: model.objective,
      description: model.description,
      audience: model.audience,
      parameters: model.parameters,
      basedOn: model.basedOn,
      ...documentToDto(document),
      references,
    });
  });

  /** What changed in it, the newest first: when and what, never who (#431). */
  app.get('/:p/history', async (c) => {
    const read = await useCases.readHistory().execute(c.req.param('p'));
    return read.ok ? cached(c, read.value) : fail(c, read.error);
  });

  return app;
}
