import { z } from 'zod';

/**
 * How a notebook's notes are drawn and printed, set once for all of them (#493).
 *
 * The face and the alignments reach the renderer as the note's defaults, which
 * a `:::{style}` block of a note overrides for its passage (§7.16 of the
 * specification). The print settings decide the print page for everybody who
 * prints a note of the notebook, the Reader of a share included, in the
 * browser and in the PDF the server makes (RN-PRT-031).
 *
 * A notebook that never set one has the default: sans serif, aligned left,
 * every property at the top, no contents, tables wrapping their text,
 * portrait.
 */

export const STYLE_FONTS = ['sans', 'serif'] as const;
export const STYLE_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
/** How the headings of a note are numbered: not at all, or 1, 1.1, 1.2 (#535). */
export const STYLE_NUMBERINGS = ['none', 'decimal'] as const;
/** Where a note's properties are drawn: below its title, or at its end (#530). */
export const PROPERTIES_PLACES = ['start', 'end'] as const;
export const PROPERTIES_LIMITS = { keys: 50, keyLength: 64, titleLength: 120 } as const;
export const PRINT_ORIENTATIONS = ['portrait', 'landscape'] as const;
export const PRINT_TABLES = ['wrap', 'shrink', 'appendices'] as const;

export type StyleFont = (typeof STYLE_FONTS)[number];
export type StyleAlignment = (typeof STYLE_ALIGNMENTS)[number];
export type StyleNumbering = (typeof STYLE_NUMBERINGS)[number];
export type PropertiesPlace = (typeof PROPERTIES_PLACES)[number];
export type PrintOrientation = (typeof PRINT_ORIENTATIONS)[number];
export type PrintTables = (typeof PRINT_TABLES)[number];

/** What a list of a contents, or the drawing of properties, is titled with: a text of up to 120 characters. */
const titleSchema = z.string().trim().min(1).max(PROPERTIES_LIMITS.titleLength);

/**
 * One layer of how a note's properties are drawn (#530, RN-KNW-096): the keys
 * drawn in their order (absent, every key, the reserved ones first), the title
 * over them, whether they start folded, and where they go — at the top, below
 * the title, or at the end of the note.
 */
const propertiesLayerSchema = z
  .object({
    keys: z
      .array(z.string().trim().min(1).max(PROPERTIES_LIMITS.keyLength))
      .min(1)
      .max(PROPERTIES_LIMITS.keys)
      .optional(),
    title: titleSchema.optional(),
    fold: z.enum(['open', 'closed']).optional(),
    place: z.enum(PROPERTIES_PLACES).optional(),
  })
  .strict();

/** A medium's layer, or `none`: nothing drawn there. */
const propertiesMediumSchema = z.union([z.literal('none'), propertiesLayerSchema]);

/** A null a client wrote for "not set" is left out, as the structure leaves out what is not set. */
function withoutNulls(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, each]) => each !== null)
      .map(([key, each]) => [key, withoutNulls(each)]),
  );
}

const LEGACY_PROPERTIES: Readonly<Record<string, unknown>> = {
  cover: {},
  end: { print: { place: 'end' } },
  none: { print: 'none' },
};

/**
 * How a notebook's notes draw their properties when a note writes no
 * `properties` block, and the defaults of one that does (#530, RN-KNW-096):
 * the host settings of the renderer (memorysmithapp-markdown §7.18), the root
 * applying to every medium and `screen` and `print` overriding it for theirs,
 * or drawing nothing there with `none`. Empty, every key at the top, as
 * always. A word of before #530 is read as what it became: `cover` the top,
 * `end` the end of the print, `none` nothing printed.
 */
export const notebookPropertiesSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value in LEGACY_PROPERTIES
      ? LEGACY_PROPERTIES[value]
      : withoutNulls(value),
  propertiesLayerSchema.extend({
    screen: propertiesMediumSchema.optional(),
    print: propertiesMediumSchema.optional(),
  }),
);

export type NotebookProperties = z.infer<typeof notebookPropertiesSchema>;

/** The lists a contents draws, and the options of each (§7.17). */
export const CONTENTS_LISTS = ['headings', 'figures', 'tables', 'attachments'] as const;
const contentsListSchema = z
  .object({
    title: titleSchema.optional(),
    /** How many heading levels are listed, 1 to 6; only `headings` takes it. */
    depth: z.number().int().min(1).max(6).optional(),
  })
  .strict();

/** One layer of a contents: the lists it draws, in their order, and where. */
const contentsLayerShape = {
  headings: contentsListSchema.optional(),
  figures: contentsListSchema.optional(),
  tables: contentsListSchema.optional(),
  attachments: contentsListSchema.optional(),
  place: z.enum(PROPERTIES_PLACES).optional(),
};
const onlyHeadingsTakeADepth = (layer: Partial<Record<string, unknown>>) =>
  CONTENTS_LISTS.every(
    (list) =>
      list === 'headings' || (layer[list] as { depth?: number } | undefined)?.depth === undefined,
  );
const contentsLayerSchema = z
  .object(contentsLayerShape)
  .strict()
  .refine(onlyHeadingsTakeADepth, 'Only headings take a depth');

/**
 * The contents of every note of the notebook that writes no `contents` block,
 * and the defaults of one that does (#521, RN-KNW-097): the host settings of
 * the renderer (memorysmithapp-markdown §7.17), in the same structure as the
 * properties. Null, the notebook draws none: only a note's own block does.
 */
export const notebookContentsSchema = z.preprocess(
  withoutNulls,
  z
    .object({
      ...contentsLayerShape,
      screen: z.union([z.literal('none'), contentsLayerSchema]).optional(),
      print: z.union([z.literal('none'), contentsLayerSchema]).optional(),
    })
    .strict()
    .refine(onlyHeadingsTakeADepth, 'Only headings take a depth'),
);

export type NotebookContents = z.infer<typeof notebookContentsSchema>;

export const notebookStyleSchema = z.object({
  font: z.enum(STYLE_FONTS),
  headings: z.enum(STYLE_ALIGNMENTS),
  text: z.enum(STYLE_ALIGNMENTS),
  /** The columns of a table that declare no alignment of their own. */
  tables: z.enum(STYLE_ALIGNMENTS),
  /** Whether justified text breaks words with a hyphen; off by default (#498). */
  hyphenate: z.boolean(),
  /** How the headings are numbered; none by default (#535). */
  numbering: z.enum(STYLE_NUMBERINGS),
  /** How a note draws its properties (#530). */
  properties: notebookPropertiesSchema,
  /** The contents a note draws when it writes none; null, none (#521). */
  contents: notebookContentsSchema.nullable(),
  /** In print, each list of a contents opens a page, and so does what follows it (#542). */
  contentsPages: z.boolean(),
  orientation: z.enum(PRINT_ORIENTATIONS),
  /** How a printed note fits its tables: wrapping, shrunk, or as appendices at its end (#494). */
  printTables: z.enum(PRINT_TABLES),
  /** The orientation of the appendices; null takes the document's. */
  appendixOrientation: z.enum(PRINT_ORIENTATIONS).nullable(),
});

export type NotebookStyle = z.infer<typeof notebookStyleSchema>;

/** A change of a notebook's style: only the settings it names change. */
export const notebookStylePatchSchema = notebookStyleSchema.partial().strict();
export type NotebookStylePatch = z.infer<typeof notebookStylePatchSchema>;

export const DEFAULT_NOTEBOOK_STYLE: NotebookStyle = {
  font: 'sans',
  headings: 'left',
  text: 'left',
  tables: 'left',
  hyphenate: false,
  numbering: 'none',
  properties: {},
  contents: null,
  contentsPages: false,
  orientation: 'portrait',
  printTables: 'wrap',
  appendixOrientation: null,
};

/**
 * A stored or carried style read whole: what is missing, or not one of its
 * values, is the default, as an item or an archive written before it was.
 */
export function notebookStyleOf(value: unknown): NotebookStyle {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const pick = <T extends string>(allowed: readonly T[], key: string, fallback: T): T =>
    (allowed as readonly unknown[]).includes(raw[key]) ? (raw[key] as T) : fallback;
  const d = DEFAULT_NOTEBOOK_STYLE;
  return {
    font: pick(STYLE_FONTS, 'font', d.font),
    headings: pick(STYLE_ALIGNMENTS, 'headings', d.headings),
    text: pick(STYLE_ALIGNMENTS, 'text', d.text),
    tables: pick(STYLE_ALIGNMENTS, 'tables', d.tables),
    hyphenate: raw['hyphenate'] === true,
    numbering: pick(STYLE_NUMBERINGS, 'numbering', d.numbering),
    properties: propertiesOf(raw['properties']),
    contents: contentsOf(raw['contents']),
    contentsPages: raw['contentsPages'] === true,
    orientation: pick(PRINT_ORIENTATIONS, 'orientation', d.orientation),
    printTables: pick(PRINT_TABLES, 'printTables', d.printTables),
    appendixOrientation:
      raw['appendixOrientation'] === null || raw['appendixOrientation'] === undefined
        ? null
        : pick(PRINT_ORIENTATIONS, 'appendixOrientation', d.orientation),
  };
}

/** A stored or carried properties setting, the default when it is not one. */
export function propertiesOf(value: unknown): NotebookProperties {
  const read = notebookPropertiesSchema.safeParse(value);
  return read.success ? read.data : DEFAULT_NOTEBOOK_STYLE.properties;
}

/** A stored or carried contents setting, none when it is not one. */
export function contentsOf(value: unknown): NotebookContents | null {
  if (value === null || value === undefined) return null;
  const read = notebookContentsSchema.safeParse(value);
  return read.success ? read.data : null;
}

/** Whether two styles say the same thing, which a write that changes nothing records nothing for. */
export function sameNotebookStyle(left: NotebookStyle, right: NotebookStyle): boolean {
  return (Object.keys(DEFAULT_NOTEBOOK_STYLE) as (keyof NotebookStyle)[]).every((key) =>
    typeof left[key] === 'object' || typeof right[key] === 'object'
      ? JSON.stringify(left[key]) === JSON.stringify(right[key])
      : left[key] === right[key],
  );
}
