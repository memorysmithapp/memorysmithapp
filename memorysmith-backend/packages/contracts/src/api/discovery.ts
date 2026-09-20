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
import { instantSchema, ulidSchema } from '../common.js';

/**
 * A note as the projections name it. There is no slug: a link resolves against
 * the name (RN-DSC-041) and the interface addresses a note by its identifier
 * (RN-DSC-045), so what travels is what each of the two reads.
 */
export const noteRefSchema = z.object({
  noteId: ulidSchema,
  name: z.string(),
  aliases: z.array(z.string()),
  folderId: ulidSchema,
});

/**
 * What one wikilink target resolves to: every note whose name matches it or —
 * when none does — every note carrying it as an alias, with which of the two
 * answered. The two are not equally durable, and the interface says so
 * (RN-DSC-046, RN-DSC-053).
 */
export const resolvedTargetSchema = z.object({
  target: z.string().min(1),
  kind: z.enum(['note', 'attachment', 'pending']),
  by: z.enum(['name', 'alias']).nullable(),
  notes: z.array(noteRefSchema),
});

/**
 * What the notebook answers to: every note with the name it states and the
 * spellings it declares. A reading surface reads it once and draws every link
 * of a page by what it REACHES (RN-DSC-046).
 */
export const notebookNamesSchema = z.object({ notes: z.array(noteRefSchema) });

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
 * A node of the whole-notebook graph: the note, plus the portrait the facet
 * projection keeps of it, so a reader can color the graph by an attribute the
 * notebook itself declares. The values were classified BY SHAPE (RN-DSC-019), so
 * the backend still interprets nothing: what an attribute means is a decision
 * of whoever authored the notebook. A note with no frontmatter carries `{}`.
 */
export const graphNoteRefSchema = noteRefSchema.extend({
  facets: z.record(z.string(), z.array(z.string())),
});

/**
 * The whole link graph of a notebook. Edges are index pairs into `nodes`, because
 * a graph repeats every identifier twice per edge and an index is two bytes
 * where a ULID is twenty-six.
 */
export const notebookGraphSchema = z.object({
  nodes: z.array(graphNoteRefSchema),
  edges: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])),
  pending: z.array(
    z.object({ from: z.number().int().nonnegative(), targetName: z.string().min(1) }),
  ),
  /** True when the node ceiling cut the graph short. Never truncate silently. */
  truncated: z.boolean(),
});

export const backlinksSchema = z.object({
  note: noteRefSchema,
  backlinks: z.array(noteRefSchema),
});

/**
 * Where the links of a note go (RN-AGT-034): every target it writes, the notes
 * each reaches with the folder trail of each, and whether a name or an alias
 * answered. `by` is null for a pending target, which reaches no note yet.
 */
export const noteLinksSchema = z.object({
  links: z.array(
    z.object({
      target: z.string().min(1),
      by: z.enum(['name', 'alias']).nullable(),
      notes: z.array(noteRefSchema.extend({ folderTrail: z.array(z.string()) })),
    }),
  ),
});

/** A link from a note to a name no note carries yet (RN-DSC-004). */
export const pendingLinkSchema = z.object({
  fromNote: noteRefSchema,
  targetName: z.string().min(1),
});

/**
 * What a notebook reports about its own links. There is no list of broken
 * links, because nothing in a notebook is ever broken: a link whose target does
 * not exist yet is pending (RN-DSC-004), and deleting a note returns the links
 * that pointed at it to pending (RN-DSC-005).
 */
export const notebookHealthSchema = z.object({
  orphans: z.array(noteRefSchema),
  pendingLinks: z.array(pendingLinkSchema),
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
export type NotebookNamesDto = z.infer<typeof notebookNamesSchema>;
export type ResolvedTargetDto = z.infer<typeof resolvedTargetSchema>;
export type GraphNodeDto = z.infer<typeof graphNodeSchema>;
export type GraphNoteRefDto = z.infer<typeof graphNoteRefSchema>;
export type NotebookGraphDto = z.infer<typeof notebookGraphSchema>;
export type BacklinksDto = z.infer<typeof backlinksSchema>;
export type NoteLinksDto = z.infer<typeof noteLinksSchema>;
export type PendingLinkDto = z.infer<typeof pendingLinkSchema>;
export type NotebookHealthDto = z.infer<typeof notebookHealthSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchHitDto = z.infer<typeof searchHitSchema>;
export type SearchResultDto = z.infer<typeof searchResultSchema>;
export type FacetStatsDto = z.infer<typeof facetStatsSchema>;
