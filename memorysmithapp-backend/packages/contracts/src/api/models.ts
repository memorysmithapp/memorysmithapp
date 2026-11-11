/**
 * Notebook models (#344, #431): a notebook of its author's subscription,
 * declared as a model so that other notebooks are created from it, read as it
 * stands whenever one is, with the history of its changes.
 *
 * The model is the notebook itself; what is declared here is what the
 * notebook cannot say about itself — what it is for, who it is for, the
 * parameters a notebook created from it fills in, and an optional credit.
 */

import { z } from 'zod';
import { instantSchema, ulidSchema } from '../common.js';

/** The types of a parameter: the kinds of attribute of the specification (§6.3). */
export const parameterTypeSchema = z.enum(['text', 'list', 'boolean', 'date']);

/** A value: text and dates are strings, a list is several, a boolean is one. */
export const parameterValueSchema = z.union([z.string(), z.array(z.string()), z.boolean()]);

/**
 * A parameter, declared once: every `{{name}}` of the model receives the same
 * value. It is required, or it has a default valid for its type, which may be
 * empty, so a notebook created from the model keeps no reference.
 */
export const parameterDeclarationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).default(''),
  example: z.string().max(200).default(''),
  type: parameterTypeSchema,
  required: z.boolean(),
  default: parameterValueSchema.nullable().default(null),
});

/** What the owner declares a model with, and declares again to change it. */
export const declareModelRequestSchema = z.object({
  objective: z.string().min(1).max(500),
  description: z.string().max(500).default(''),
  audience: z.string().max(300).default(''),
  parameters: z.array(parameterDeclarationSchema).max(50).default([]),
  /** An optional credit, shown with the model when filled in, never required. */
  basedOn: z.string().max(200).nullable().default(null),
});

export const notebookModelSchema = z.object({
  notebookId: ulidSchema,
  objective: z.string(),
  description: z.string(),
  audience: z.string(),
  parameters: z.array(parameterDeclarationSchema),
  basedOn: z.string().nullable(),
  declaredAt: instantSchema,
  updatedAt: instantSchema,
  /**
   * `CC0-1.0` once its owner accepted it, on its first distribution; null while
   * it was never distributed (#357).
   */
  licence: z.literal('CC0-1.0').nullable(),
  /** The e-mail of the owner who shared it, or null for a model of one's own (#355). */
  sharedBy: z.string().nullable(),
  /** What it is published as in the community catalog, or null (#360). */
  publication: z
    .lazy(() => publicModelSchema)
    .nullable()
    .optional(),
});

export const modelListSchema = z.object({
  models: z.array(notebookModelSchema.extend({ name: z.string() })),
});

/**
 * What a model notebook holds, read as it stands now (#431): every part a
 * notebook created from it starts as, which is what its owner, a model reader
 * and the community read of it.
 */
export const modelContentsSchema = z.object({
  notebookId: ulidSchema,
  objective: z.string(),
  description: z.string(),
  audience: z.string(),
  parameters: z.array(parameterDeclarationSchema),
  basedOn: z.string().nullable(),
  notebook: z.object({
    name: z.string(),
    description: z.string(),
    guidance: z.string().nullable(),
  }),
  folders: z.array(
    z.object({
      folderId: z.string(),
      parentFolderId: z.string().nullable(),
      name: z.string(),
      description: z.string(),
      template: z.string().nullable(),
    }),
  ),
  notes: z.array(z.object({ noteId: z.string(), folderId: z.string(), body: z.string() })),
  files: z.array(z.object({ name: z.string(), mimeType: z.string() })),
  /** The tables of the model, each with its columns and how many rows it holds (#366). */
  tables: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        columns: z.array(z.string()),
        rows: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  /** The dashboards of the model (#368). */
  dashboards: z.array(z.object({ name: z.string(), description: z.string() })).default([]),
  /**
   * What the model writes against what it declares (#354): a reference no
   * parameter answers, which a notebook created from it would keep, and a
   * parameter no text uses.
   */
  references: z.object({ undeclared: z.array(z.string()), unused: z.array(z.string()) }),
});

/**
 * One change of a model notebook, as its history lists it (#431): when, who
 * through which connector, what it was about and the line its author left. An
 * edit session is one change, with how many saves it held and since when.
 */
export const modelChangeSchema = z.object({
  occurredAt: instantSchema,
  since: instantSchema,
  saves: z.number().int().positive(),
  type: z.string(),
  subject: z.string(),
  subjectId: z.string(),
  /** The name of what changed, when the change says it. */
  name: z.string().nullable(),
  /** The connector that wrote it, or null for a person in the interface. */
  agent: z.string().nullable(),
  message: z.string().nullable(),
});

/** The history of a model, the newest change first, and whether older ones were left out. */
export const modelHistorySchema = z.object({
  changes: z.array(modelChangeSchema),
  truncated: z.boolean(),
});

/**
 * Creating an independent notebook from a model (#359, #431): its name, the
 * name of the model filled in when empty, and a value for each parameter,
 * keyed by its name; one not given takes its default, and a required one is
 * refused.
 */
export const createFromModelRequestSchema = z.object({
  name: z.string().max(120).default(''),
  values: z.record(z.string(), parameterValueSchema).default({}),
});

/** Publishing a model to the community (#360): its language, and CC0 1.0 once. */
export const publishModelRequestSchema = z.object({
  language: z.string().min(2).max(35),
  acceptLicence: z.boolean().default(false),
});

/**
 * A published model, as anybody sees it (#360): no subscription, no owner and
 * no e-mail, only what the catalog shows and is searched by (#358).
 */
export const publicModelSchema = z.object({
  publicId: ulidSchema,
  name: z.string(),
  objective: z.string(),
  description: z.string(),
  audience: z.string(),
  language: z.string(),
  /** The display name of the account that published it, never its e-mail (#357). */
  author: z.string(),
  basedOn: z.string().nullable(),
  licence: z.literal('CC0-1.0'),
  publishedAt: instantSchema,
  /** When what the catalog says of it was last said again. */
  updatedAt: instantSchema,
  parameters: z.array(parameterDeclarationSchema),
});

/**
 * What a search of the catalog finds, the newest published first (#432): one
 * page when a limit was asked, and where the next one starts, null on the last.
 */
export const catalogSearchSchema = z.object({
  models: z.array(publicModelSchema),
  next: z.string().nullable(),
  /** How many models the search found, across every page (#438). */
  total: z.number().int().nonnegative(),
});

/** A published model, read whole as it stands now, and nothing else of its subscription (#431). */
export const publicModelContentsSchema = modelContentsSchema
  .omit({ notebookId: true })
  .extend({ model: publicModelSchema });

/** The history of a published model: when and what, never who (#431). */
export const publicModelHistorySchema = z.object({
  changes: z.array(modelChangeSchema.omit({ agent: true })),
  truncated: z.boolean(),
});

export type ParameterTypeDto = z.infer<typeof parameterTypeSchema>;
export type ParameterValueDto = z.infer<typeof parameterValueSchema>;
export type ParameterDeclarationDto = z.infer<typeof parameterDeclarationSchema>;
export type DeclareModelRequest = z.input<typeof declareModelRequestSchema>;
export type NotebookModelDto = z.infer<typeof notebookModelSchema>;
export type ModelListDto = z.infer<typeof modelListSchema>;
export type ModelContentsDto = z.infer<typeof modelContentsSchema>;
export type ModelChangeDto = z.infer<typeof modelChangeSchema>;
export type ModelHistoryDto = z.infer<typeof modelHistorySchema>;
export type CreateFromModelRequest = z.input<typeof createFromModelRequestSchema>;
export type PublishModelRequest = z.input<typeof publishModelRequestSchema>;
export type PublicModelDto = z.infer<typeof publicModelSchema>;
export type CatalogSearchDto = z.infer<typeof catalogSearchSchema>;
export type PublicModelContentsDto = z.infer<typeof publicModelContentsSchema>;
export type PublicModelHistoryDto = z.infer<typeof publicModelHistorySchema>;
