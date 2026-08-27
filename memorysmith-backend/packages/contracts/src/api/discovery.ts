/**
 * DTOs of svc-discovery: the projections over the same events
 * (architecture-guide.md, section 11).
 *
 * A hit always carries the note it came from (RN-DSC-010): whoever consumes it
 * decides with the source in sight, which is the answer to plausible-but-wrong
 * retrieval. `section` is kept nullable so a future index that cuts notes into
 * parts can fill it without moving the contract.
 */

import { z } from 'zod';
import { instantSchema, slugSchema, ulidSchema } from '../common.js';

export const noteRefSchema = z.object({
  noteId: ulidSchema,
  title: z.string(),
  slug: slugSchema,
  folderId: ulidSchema,
});

/** BFS from a note: depth capped at 3, 200 nodes, cycles deduplicated. */
export const graphNodeSchema: z.ZodType<{
  note: z.infer<typeof noteRefSchema>;
  depth: number;
  children: unknown[];
}> = z.lazy(() =>
  z.object({
    note: noteRefSchema,
    depth: z.number().int().min(0).max(3),
    children: z.array(graphNodeSchema),
  }),
);

/**
 * The whole link graph of a vault. Edges are index pairs into `nodes`, because
 * a graph repeats every identifier twice per edge and an index is two bytes
 * where a ULID is twenty-six.
 */
export const vaultGraphSchema = z.object({
  nodes: z.array(noteRefSchema),
  edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
  pending: z.array(z.object({ from: z.number().int().nonnegative(), targetSlug: slugSchema })),
  /** True when the node ceiling cut the graph short. Never truncate silently. */
  truncated: z.boolean(),
});

export const backlinksSchema = z.object({
  note: noteRefSchema,
  backlinks: z.array(noteRefSchema),
});

export const brokenLinkSchema = z.object({
  fromNote: noteRefSchema,
  targetSlug: slugSchema,
});

export const vaultHealthSchema = z.object({
  brokenLinks: z.array(brokenLinkSchema),
  orphans: z.array(noteRefSchema),
  /** A link whose target does not exist YET is pending, not broken (RN-DSC-004). */
  pendingLinks: z.array(brokenLinkSchema),
});

export const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(['lexical']).default('lexical'),
  folderId: ulidSchema.optional(),
  k: z.number().int().min(1).max(50).default(10),
});

export const searchHitSchema = z.object({
  note: noteRefSchema,
  /** The heading a hit was cut at, when the index knows one. */
  section: z.string().nullable(),
  excerpt: z.string(),
  score: z.number(),
});

export const searchResultSchema = z.object({
  mode: z.enum(['lexical']),
  hits: z.array(searchHitSchema),
});

/** The curation panel: one Query over the STAT# items, no note is scanned. */
export const facetStatsSchema = z.object({
  facets: z.array(
    z.object({
      facet: z.string(),
      kind: z.enum(['date', 'boolean', 'enum', 'list']),
      values: z.array(z.object({ value: z.string(), count: z.number().int().nonnegative() })),
      discarded: z.boolean(),
    }),
  ),
  noteCount: z.number().int().nonnegative(),
  updatedAt: instantSchema,
});

export type NoteRefDto = z.infer<typeof noteRefSchema>;
export type GraphNodeDto = z.infer<typeof graphNodeSchema>;
export type VaultGraphDto = z.infer<typeof vaultGraphSchema>;
export type BacklinksDto = z.infer<typeof backlinksSchema>;
export type BrokenLinkDto = z.infer<typeof brokenLinkSchema>;
export type VaultHealthDto = z.infer<typeof vaultHealthSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchHitDto = z.infer<typeof searchHitSchema>;
export type SearchResultDto = z.infer<typeof searchResultSchema>;
export type FacetStatsDto = z.infer<typeof facetStatsSchema>;
