/**
 * Notebook models (#344, #353): a notebook of its author's subscription,
 * declared as a model so that other notebooks are created from it, and the
 * frozen versions a notebook is created from.
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

/** One version, as its model lists it. */
export const modelVersionSchema = z.object({
  number: z.number().int().positive(),
  changelog: z.string(),
  createdAt: instantSchema,
  /** `running` while the snapshot is built, `ready` once it can be used. */
  status: z.enum(['running', 'ready', 'failed', 'cancelled']),
  bytes: z.number().int().nonnegative(),
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
  versions: z.array(modelVersionSchema),
});

export const modelListSchema = z.object({
  models: z.array(notebookModelSchema.omit({ versions: true }).extend({ name: z.string() })),
});

/** Creating a version freezes the model notebook as it is, with what changed since the last. */
export const createModelVersionRequestSchema = z.object({
  changelog: z.string().max(2000).default(''),
});

/**
 * A version, read whole (#353): what it froze of its model and every part of
 * the notebook it holds, which is what the owner reviews before distributing
 * it and what a notebook created from it starts as.
 */
export const modelVersionViewSchema = z.object({
  notebookId: ulidSchema,
  version: modelVersionSchema,
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
  files: z.array(
    z.object({ name: z.string(), mimeType: z.string(), bytes: z.number().int().nonnegative() }),
  ),
  /**
   * What the version writes against what it declares (#354): a reference no
   * parameter answers, which a notebook created from it would keep, and a
   * parameter no text uses.
   */
  references: z.object({ undeclared: z.array(z.string()), unused: z.array(z.string()) }),
});

/**
 * Creating an independent notebook from a version (#359): its name, the name
 * of the model filled in when empty, and a value for each parameter, keyed by
 * its name; one not given takes its default, and a required one is refused.
 */
export const createFromVersionRequestSchema = z.object({
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
  updatedAt: instantSchema,
  parameters: z.array(parameterDeclarationSchema),
  versions: z.array(
    z.object({
      number: z.number().int().positive(),
      changelog: z.string(),
      createdAt: instantSchema,
      bytes: z.number().int().nonnegative(),
    }),
  ),
});

export const catalogSearchSchema = z.object({ models: z.array(publicModelSchema) });

/** A published version, read whole: the snapshot and nothing else of its subscription. */
export const publicVersionViewSchema = modelVersionViewSchema
  .omit({ notebookId: true, version: true })
  .extend({
    model: publicModelSchema,
    version: publicModelSchema.shape.versions.element,
  });

/** A report of a published model, which only a person who signed in makes (#358). */
export const reportModelRequestSchema = z.object({ reason: z.string().min(1).max(1000) });

/** A report waiting for the operator, with the model it is about while it is published. */
export const catalogReportSchema = z.object({
  reportId: ulidSchema,
  publicId: ulidSchema,
  reason: z.string(),
  reportedAt: instantSchema,
  model: publicModelSchema.nullable(),
});

/** The operator withdraws a model, saying why: the author is told (#358). */
export const withdrawModelRequestSchema = z.object({ reason: z.string().min(1).max(2000) });

export type ParameterTypeDto = z.infer<typeof parameterTypeSchema>;
export type ParameterValueDto = z.infer<typeof parameterValueSchema>;
export type ParameterDeclarationDto = z.infer<typeof parameterDeclarationSchema>;
export type DeclareModelRequest = z.input<typeof declareModelRequestSchema>;
export type ModelVersionDto = z.infer<typeof modelVersionSchema>;
export type NotebookModelDto = z.infer<typeof notebookModelSchema>;
export type ModelListDto = z.infer<typeof modelListSchema>;
export type CreateModelVersionRequest = z.input<typeof createModelVersionRequestSchema>;
export type ModelVersionViewDto = z.infer<typeof modelVersionViewSchema>;
export type CreateFromVersionRequest = z.input<typeof createFromVersionRequestSchema>;
export type PublishModelRequest = z.input<typeof publishModelRequestSchema>;
export type PublicModelDto = z.infer<typeof publicModelSchema>;
export type CatalogSearchDto = z.infer<typeof catalogSearchSchema>;
export type PublicVersionViewDto = z.infer<typeof publicVersionViewSchema>;
export type CatalogReportDto = z.infer<typeof catalogReportSchema>;
