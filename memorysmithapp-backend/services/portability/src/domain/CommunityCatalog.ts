/**
 * The community catalog (#360): the models their owners published, found and
 * read by anybody, an account or none, and created from by whoever signs in.
 *
 * Publishing copies nothing (#356). A published model stays in its author's
 * subscription, its versions where they were frozen; what publishing writes is
 * a small entry at the level of the platform, the one way a public request
 * reaches a subscription, which maps a public identifier to the subscription,
 * the model and the retained versions, and says what the catalog shows and is
 * searched by (#358). Withdrawing deletes the entry, and the model answers as
 * missing from then on.
 *
 * The entry points at the model, not at one version: it lists every version
 * the author retains, the newest first, and a model with none left is
 * withdrawn.
 */

import type { ParameterDeclaration } from './NotebookModel.js';

/** A retained version, as the catalog lists it and reads it from. */
export interface CatalogVersion {
  readonly number: number;
  readonly changelog: string;
  readonly createdAt: string;
  readonly bytes: number;
  /** Where its snapshot is, under the prefix of the models of its subscription. */
  readonly key: string;
  readonly versionId: string | null;
  /** What the version declared, which a notebook created from it fills in. */
  readonly parameters: readonly ParameterDeclaration[];
}

export interface CatalogEntry {
  readonly publicId: string;
  /** The subscription the model is in, which only this entry names (INV-02). */
  readonly subscriptionId: string;
  readonly notebookId: string;
  readonly ownerUserId: string;
  /** The display name of the account that published it, never its e-mail (#357). */
  readonly authorName: string;
  /** Where the author is told of a withdrawal by the operator; never shown (#358). */
  readonly authorEmail: string;
  readonly name: string;
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  /** The language the model is written in, as a BCP 47 tag. */
  readonly language: string;
  readonly basedOn: string | null;
  readonly publishedAt: string;
  /** The versions retained, the newest first; never empty while published. */
  readonly versions: readonly CatalogVersion[];
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
  /** The date of the latest version. */
  readonly updatedAt: string;
  readonly parameters: readonly ParameterDeclaration[];
  readonly versions: ReadonlyArray<{
    readonly number: number;
    readonly changelog: string;
    readonly createdAt: string;
    readonly bytes: number;
  }>;
}

export function publicViewOf(entry: CatalogEntry): PublicModel {
  const latest = entry.versions[0];
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
    updatedAt: latest?.createdAt ?? entry.publishedAt,
    parameters: latest?.parameters ?? [],
    versions: entry.versions.map(({ number, changelog, createdAt, bytes }) => ({
      number,
      changelog,
      createdAt,
      bytes,
    })),
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

/** A report of a published model, for the operator of the platform (#358). */
export interface CatalogReport {
  readonly reportId: string;
  readonly publicId: string;
  readonly reason: string;
  readonly reporterUserId: string;
  readonly reportedAt: string;
}

export interface CatalogStore {
  get(publicId: string): Promise<CatalogEntry | null>;
  /** Every published model. */
  list(): Promise<CatalogEntry[]>;
  put(entry: CatalogEntry): Promise<void>;
  remove(publicId: string): Promise<void>;
}

export interface CatalogReports {
  add(report: CatalogReport): Promise<void>;
  list(): Promise<CatalogReport[]>;
  remove(reportId: string): Promise<void>;
}
