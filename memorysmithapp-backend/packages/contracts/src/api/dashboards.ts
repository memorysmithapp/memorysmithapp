/**
 * The Dashboards of a notebook (#368): a definition an agent writes — a
 * layout, filters and components drawn from the Tables — checked whole by
 * Knowledge, which names what it refuses. Here it is an object.
 */

import { z } from 'zod';
import { authorshipSchema, instantSchema, ulidSchema } from '../common.js';

export const dashboardDefinitionDocument = z.record(z.string(), z.unknown());

export const notebookDashboardSchema = z.object({
  dashboardId: ulidSchema,
  notebookId: ulidSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  /** The definition, each component naming its table by name. */
  definition: dashboardDefinitionDocument,
  updatedAt: instantSchema,
  authorship: authorshipSchema,
});

export const dashboardListSchema = z.object({ dashboards: z.array(notebookDashboardSchema) });

export const createDashboardRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).default(''),
  definition: dashboardDefinitionDocument,
});

export const updateDashboardRequestSchema = z.object({
  name: z.string().min(1).max(120).nullable().default(null),
  description: z.string().max(500).nullable().default(null),
  definition: dashboardDefinitionDocument.nullable().default(null),
});

/** A mark clicked on a chart, which narrows the other components (#369). */
export const dashboardCrossFilterSchema = z.object({
  component: z.string().min(1).max(64),
  key: z.string().max(500),
});

/** The periods chosen on the dashboard, by filter, and the page of each table component. */
export const dashboardDataRequestSchema = z.object({
  filters: z.record(z.string(), z.string().nullable()).default({}),
  pages: z.record(z.string(), z.number().int().positive()).default({}),
  cross: dashboardCrossFilterSchema.nullable().default(null),
});

/** What one component draws now, by its kind; `status` says when it cannot. */
export const componentDataSchema = z
  .object({
    id: z.string(),
    status: z.enum(['ok', 'missing-table', 'refused']),
    kind: z.enum(['text', 'value', 'groups', 'rows', 'matrix']).optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const dashboardDataSchema = z.object({
  dashboard: notebookDashboardSchema,
  /** When the tables were read, which the dashboard says. */
  readAt: instantSchema,
  components: z.array(componentDataSchema),
});

export type NotebookDashboardDto = z.infer<typeof notebookDashboardSchema>;
export type DashboardListDto = z.infer<typeof dashboardListSchema>;
export type CreateDashboardRequest = z.infer<typeof createDashboardRequestSchema>;
export type UpdateDashboardRequest = z.infer<typeof updateDashboardRequestSchema>;
export type DashboardCrossFilter = z.infer<typeof dashboardCrossFilterSchema>;
export type DashboardDataRequest = z.infer<typeof dashboardDataRequestSchema>;
export type ComponentDataDto = z.infer<typeof componentDataSchema>;
export type DashboardDataDto = z.infer<typeof dashboardDataSchema>;
