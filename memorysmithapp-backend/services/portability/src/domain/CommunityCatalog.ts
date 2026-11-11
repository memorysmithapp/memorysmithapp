/**
 * The community catalog (#360): the models their owners published, found and
 * read by anybody, an account or none, and created from by whoever signs in.
 *
 * Publishing copies nothing (#356). A published model stays in its author's
 * subscription, its notebook where it is; what publishing writes is a small
 * entry at the level of the platform, the one way a public request reaches a
 * subscription, which maps a public identifier to the subscription and the
 * model notebook, and says what the catalog shows and is searched by (#358).
 * Whoever reads a published model reads its notebook as it stands, through the
 * entry, and every change its owner makes reaches them (#431). Its author
 * withdraws it, which deletes the entry, and the model answers as missing
 * from then on.
 */

import type { ParameterDeclaration } from './NotebookModel.js';

export interface CatalogEntry {
  readonly publicId: string;
  /** The subscription the model is in, which only this entry names (INV-02). */
  readonly subscriptionId: string;
  readonly notebookId: string;
  readonly ownerUserId: string;
  /** The display name of the account that published it, never its e-mail (#357). */
  readonly authorName: string;
  /** The e-mail of the account that published it; never shown (#358). */
  readonly authorEmail: string;
  readonly name: string;
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  /** The language the model is written in, as a BCP 47 tag. */
  readonly language: string;
  readonly basedOn: string | null;
  readonly publishedAt: string;
  /** When what the entry says of the model was last said again. */
  readonly updatedAt: string;
  /** What the model declares, which a notebook created from it fills in. */
  readonly parameters: readonly ParameterDeclaration[];
}

/**
 * What anybody sees of an entry: no subscription, no owner, no e-mail and no
 * key — only what the catalog shows and is searched by (#358).
 */
export interface PublicModel {
  readonly publicId: string;
  readonly name: string;
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  readonly language: string;
  readonly author: string;
  readonly basedOn: string | null;
  readonly licence: 'CC0-1.0';
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly parameters: readonly ParameterDeclaration[];
}

export function publicViewOf(entry: CatalogEntry): PublicModel {
  return {
    publicId: entry.publicId,
    name: entry.name,
    objective: entry.objective,
    description: entry.description,
    audience: entry.audience,
    language: entry.language,
    author: entry.authorName,
    basedOn: entry.basedOn,
    licence: 'CC0-1.0',
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
    parameters: entry.parameters,
  };
}

/** Whether an entry answers a search: every word in what the catalog is searched by (#358). */
export function matches(
  entry: CatalogEntry,
  query: { readonly text: string; readonly language: string | null },
): boolean {
  if (query.language && !sameLanguage(entry.language, query.language)) return false;
  const haystack = fold(
    [entry.name, entry.objective, entry.description, entry.audience, entry.authorName].join(' '),
  );
  return fold(query.text)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** `pt` finds `pt-BR`, and `pt-BR` finds `pt-br`. */
function sameLanguage(written: string, asked: string): boolean {
  const a = written.toLowerCase();
  const b = asked.toLowerCase();
  return a === b || a.startsWith(`${b}-`);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export interface CatalogStore {
  get(publicId: string): Promise<CatalogEntry | null>;
  /** Every published model. */
  list(): Promise<CatalogEntry[]>;
  put(entry: CatalogEntry): Promise<void>;
  remove(publicId: string): Promise<void>;
}
