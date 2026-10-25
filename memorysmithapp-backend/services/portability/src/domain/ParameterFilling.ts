/**
 * Filling in the parameters of a model (#354, RN-PRT-037 to RN-PRT-039): the
 * values a person supplies for a version, checked against what the model
 * declared, and written into every place a reference stands, so a notebook
 * created from the model keeps no reference.
 *
 * Where a reference stands is the specification's reader's to say (§7.14,
 * INV-05); how each type of value is written there is this file's, because
 * the specification leaves it to whoever creates the notebook. The filling is
 * textual and never interprets what a note means: a value goes where `{{name}}`
 * was, written so that it produces no notation it did not contain.
 */

import {
  DomainError,
  err,
  ok,
  parameterReferences,
  textReferences,
  type ParameterReference,
  type Result,
} from '@memorysmithapp/kernel';
import type { NotebookDocument } from './NotebookDocumentBuilder.js';
import {
  isValueOf,
  type ParameterDeclaration,
  type ParameterType,
  type ParameterValue,
} from './NotebookModel.js';

/** A value supplied for a parameter, and the type it is written as. */
interface Filled {
  readonly type: ParameterType;
  readonly value: ParameterValue;
}

export type FilledValues = ReadonlyMap<string, Filled>;

/**
 * The value of every declared parameter: what was supplied, or the default of
 * one that is not required. A required parameter left out, or a value that is
 * not of its type, refuses the creation before anything is written, naming
 * each one (RN-PRT-037).
 */
export function resolveValues(
  declarations: readonly ParameterDeclaration[],
  supplied: Readonly<Record<string, unknown>>,
): Result<FilledValues, DomainError> {
  const byName = new Map<string, unknown>();
  for (const [name, value] of Object.entries(supplied)) byName.set(name.normalize('NFC'), value);

  const missing: string[] = [];
  const invalid: string[] = [];
  const values = new Map<string, Filled>();
  for (const declaration of declarations) {
    const given = byName.get(declaration.name);
    if (
      given === undefined ||
      given === null ||
      (given === '' && (declaration.type === 'date' || declaration.required))
    ) {
      if (declaration.required) {
        missing.push(declaration.name);
        continue;
      }
      values.set(declaration.name, { type: declaration.type, value: declaration.default ?? '' });
      continue;
    }
    if (!isValueOf(declaration.type, given)) {
      invalid.push(`${declaration.name} (${declaration.type})`);
      continue;
    }
    values.set(declaration.name, { type: declaration.type, value: given });
  }

  if (missing.length > 0 || invalid.length > 0) {
    const said = [
      ...(missing.length > 0 ? [`required and not given: ${missing.join(', ')}`] : []),
      ...(invalid.length > 0 ? [`not of their type: ${invalid.join(', ')}`] : []),
    ].join('; ');
    return err(
      DomainError.validation(`The notebook was not created. Parameters ${said}`, {
        reason: 'PARAMETERS',
        missing,
        invalid,
      }),
    );
  }
  return ok(values);
}

/** The characters a value written as text is escaped in, so it invokes no notation. */
const MARKDOWN_SENSITIVE = /[\\`*_[\]{}<>|$%=~^#]/g;

function asText(value: ParameterValue): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** A value written in the body of a note, as its type is written there. */
function inBody(filled: Filled, reference: ParameterReference): string {
  if (reference.place === 'wikilink-target') {
    // The target names a note once filled in: written as typed, and without
    // the four characters that would make it address something else (§5.3).
    return asText(filled.value)
      .replace(/[#[\]|\n]/g, ' ')
      .trim();
  }
  if (filled.type === 'list') {
    return (filled.value as readonly string[])
      .map((item) => item.replace(MARKDOWN_SENSITIVE, '\\$&'))
      .join(', ');
  }
  return asText(filled.value).replace(/\r?\n/g, ' ').replace(MARKDOWN_SENSITIVE, '\\$&');
}

/** A whole value of the frontmatter, in the form of its type (§6.2, §6.3). */
function asFrontmatterValue(filled: Filled): string {
  switch (filled.type) {
    case 'list':
      return `[${(filled.value as readonly string[]).map((item) => JSON.stringify(item)).join(', ')}]`;
    case 'boolean':
      return filled.value ? 'true' : 'false';
    case 'date':
      return String(filled.value);
    case 'text':
      return JSON.stringify(asText(filled.value).replace(/\r?\n/g, ' '));
  }
}

/** A value inside a text value of the frontmatter, escaped for the quotes around it. */
function inFrontmatterText(filled: Filled, quote: string | null): string {
  const text = asText(filled.value).replace(/\r?\n/g, ' ');
  if (quote === '"') return JSON.stringify(text).slice(1, -1);
  if (quote === "'") return text.replace(/'/g, "''");
  return text;
}

/** The note, or the Guidance, or the Template, with every declared reference filled in. */
export function fillMarkdown(markdown: string, values: FilledValues): string {
  const references = parameterReferences(markdown).filter((each) => values.has(each.name));
  let out = markdown;
  // From the end, so what is written never moves what is still to be written.
  for (const reference of [...references].sort((a, b) => b.start - a.start)) {
    const filled = values.get(reference.name);
    if (!filled) continue;
    if (reference.place === 'frontmatter-value' && reference.value) {
      // An item of an inline list is one value of it, written as text: a list
      // does not nest inside another (§6.2).
      const before = out.slice(0, reference.value.start).trimEnd();
      const item = before.endsWith('[') || before.endsWith(',');
      out =
        out.slice(0, reference.value.start) +
        (item ? JSON.stringify(asText(filled.value)) : asFrontmatterValue(filled)) +
        out.slice(reference.value.end);
    } else if (reference.place === 'frontmatter-text') {
      const line = out.lastIndexOf('\n', reference.start) + 1;
      const value = /^(?:\s*-\s+|[A-Za-z0-9_-]+\s*:\s*)(["'])?/.exec(out.slice(line));
      out =
        out.slice(0, reference.start) +
        inFrontmatterText(filled, value?.[1] ?? null) +
        out.slice(reference.end);
    } else {
      out = out.slice(0, reference.start) + inBody(filled, reference) + out.slice(reference.end);
    }
  }
  return out;
}

/** A name or a description, which is text and not Markdown: written as typed. */
export function fillText(text: string, values: FilledValues): string {
  let out = text;
  for (const reference of [...textReferences(text)].sort((a, b) => b.start - a.start)) {
    const filled = values.get(reference.name);
    if (!filled) continue;
    out =
      out.slice(0, reference.start) +
      asText(filled.value).replace(/\r?\n/g, ' ') +
      out.slice(reference.end);
  }
  return out;
}

/**
 * The document of a version with every declared parameter filled in: the name
 * and the description of the notebook, its Guidance, the name, the description
 * and the Template of each folder, and every note, its frontmatter included.
 */
export function fillDocument(document: NotebookDocument, values: FilledValues): NotebookDocument {
  return {
    ...document,
    notebook: {
      name: fillText(document.notebook.name, values),
      description: fillText(document.notebook.description, values),
      guidance:
        document.notebook.guidance === null
          ? null
          : fillMarkdown(document.notebook.guidance, values),
    },
    folders: document.folders.map((folder) => ({
      ...folder,
      name: fillText(folder.name, values),
      description: fillText(folder.description, values),
      template: folder.template === null ? null : fillMarkdown(folder.template, values),
    })),
    notes: document.notes.map((note) => ({ ...note, body: fillMarkdown(note.body, values) })),
  };
}

/**
 * What a version writes and what its model declares, compared (RN-PRT-039): a
 * reference no declaration answers, which a notebook created from it would
 * keep, and a declaration no text uses, which asks for a value for nothing.
 */
export function referenceReport(
  document: NotebookDocument,
  declarations: readonly ParameterDeclaration[],
): { undeclared: string[]; unused: string[] } {
  const written = new Set<string>();
  const add = (names: Iterable<string>) => {
    for (const name of names) written.add(name);
  };
  add(textReferences(document.notebook.name).map((each) => each.name));
  add(textReferences(document.notebook.description).map((each) => each.name));
  if (document.notebook.guidance) {
    add(parameterReferences(document.notebook.guidance).map((each) => each.name));
  }
  for (const folder of document.folders) {
    add(textReferences(folder.name).map((each) => each.name));
    add(textReferences(folder.description).map((each) => each.name));
    if (folder.template) add(parameterReferences(folder.template).map((each) => each.name));
  }
  for (const note of document.notes) add(parameterReferences(note.body).map((each) => each.name));

  const declared = new Set(declarations.map((each) => each.name));
  return {
    undeclared: [...written].filter((name) => !declared.has(name)).sort(),
    unused: [...declared].filter((name) => !written.has(name)).sort(),
  };
}
