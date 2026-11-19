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
 * A notebook that never set one has the default, which is how every note was
 * drawn and printed before: sans serif, aligned left, the properties on a
 * cover page, tables wrapping their text, portrait.
 */

export const STYLE_FONTS = ['sans', 'serif'] as const;
export const STYLE_ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
export const PRINT_PROPERTIES = ['cover', 'end', 'none'] as const;
export const PRINT_ORIENTATIONS = ['portrait', 'landscape'] as const;
export const PRINT_TABLES = ['wrap', 'shrink', 'appendices'] as const;

export type StyleFont = (typeof STYLE_FONTS)[number];
export type StyleAlignment = (typeof STYLE_ALIGNMENTS)[number];
export type PrintProperties = (typeof PRINT_PROPERTIES)[number];
export type PrintOrientation = (typeof PRINT_ORIENTATIONS)[number];
export type PrintTables = (typeof PRINT_TABLES)[number];

export const notebookStyleSchema = z.object({
  font: z.enum(STYLE_FONTS),
  headings: z.enum(STYLE_ALIGNMENTS),
  text: z.enum(STYLE_ALIGNMENTS),
  /** The columns of a table that declare no alignment of their own. */
  tables: z.enum(STYLE_ALIGNMENTS),
  /** Whether justified text breaks words with a hyphen; off by default (#498). */
  hyphenate: z.boolean(),
  /** Where a printed note's properties go. */
  properties: z.enum(PRINT_PROPERTIES),
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
  properties: 'cover',
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
    properties: pick(PRINT_PROPERTIES, 'properties', d.properties),
    orientation: pick(PRINT_ORIENTATIONS, 'orientation', d.orientation),
    printTables: pick(PRINT_TABLES, 'printTables', d.printTables),
    appendixOrientation:
      raw['appendixOrientation'] === null || raw['appendixOrientation'] === undefined
        ? null
        : pick(PRINT_ORIENTATIONS, 'appendixOrientation', d.orientation),
  };
}

/** Whether two styles say the same thing, which a write that changes nothing records nothing for. */
export function sameNotebookStyle(left: NotebookStyle, right: NotebookStyle): boolean {
  return (Object.keys(DEFAULT_NOTEBOOK_STYLE) as (keyof NotebookStyle)[]).every(
    (key) => left[key] === right[key],
  );
}
