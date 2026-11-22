import type { NotebookContents, NotebookProperties } from '@memorysmithapp/contracts';

/**
 * The Style page edits the notebook's properties and contents (#530, #521) as
 * a few choices — where each medium draws them, which keys, which lists — and
 * writes them back in the renderer's own structure, keeping whatever an agent
 * wrote that the page does not show.
 */

export type Where = 'start' | 'end' | 'none';
type Medium = 'screen' | 'print';
type Layer = Record<string, unknown>;

/** The keys typed, a comma between two of them: none typed draws every key. */
export function keysOf(text: string): string[] | null {
  const keys = text
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  return keys.length > 0 ? keys : null;
}

function layerOf(value: unknown): Layer | null {
  return typeof value === 'object' && value !== null ? (value as Layer) : null;
}

/** Where a medium draws, from its group, else the root, else the top. */
function whereOf(settings: Layer, medium: Medium): Where {
  const group = settings[medium];
  if (group === 'none') return 'none';
  const place = layerOf(group)?.['place'] ?? settings['place'];
  return place === 'end' ? 'end' : 'start';
}

/** A medium's group with its place set, its other settings kept; absent when it says nothing. */
function placed(settings: Layer, medium: Medium, where: Where): unknown {
  if (where === 'none') return 'none';
  const group: Layer = { ...(layerOf(settings[medium]) ?? {}) };
  const inherited = settings['place'] === 'end' ? 'end' : 'start';
  if (where === inherited) delete group['place'];
  else group['place'] = where;
  return Object.keys(group).length > 0 ? group : undefined;
}

function withMedia(settings: Layer, screen: Where, print: Where): Layer {
  const next: Layer = { ...settings };
  for (const [medium, where] of [
    ['screen', screen],
    ['print', print],
  ] as const) {
    const group = placed(settings, medium, where);
    if (group === undefined) delete next[medium];
    else next[medium] = group;
  }
  return next;
}

export interface PropertiesForm {
  readonly screen: Where;
  readonly print: Where;
  readonly keys: string[] | null;
  readonly title: string | null;
  readonly fold: 'open' | 'closed';
}

export function propertiesForm(settings: NotebookProperties): PropertiesForm {
  const root = settings as Layer;
  return {
    screen: whereOf(root, 'screen'),
    print: whereOf(root, 'print'),
    keys: Array.isArray(root['keys']) ? (root['keys'] as string[]) : null,
    title: typeof root['title'] === 'string' ? root['title'] : null,
    fold: root['fold'] === 'closed' ? 'closed' : 'open',
  };
}

export function propertiesOfForm(
  form: PropertiesForm,
  settings: NotebookProperties,
): NotebookProperties {
  const root: Layer = { ...(settings as Layer) };
  for (const [key, value] of [
    ['keys', form.keys],
    ['title', form.title],
    ['fold', form.fold === 'closed' ? 'closed' : null],
  ] as const) {
    if (value === null) delete root[key];
    else root[key] = value;
  }
  return withMedia(root, form.screen, form.print) as NotebookProperties;
}

export const CONTENTS_LISTS = ['headings', 'figures', 'tables', 'attachments'] as const;
export type ContentsList = (typeof CONTENTS_LISTS)[number];

export interface ContentsForm {
  readonly screen: Where;
  readonly print: Where;
  readonly lists: Readonly<Record<ContentsList, boolean>>;
  /** How many heading levels are listed, 1 to 6. */
  readonly depth: number;
}

export function contentsForm(settings: NotebookContents | null): ContentsForm {
  if (settings === null) {
    return {
      screen: 'none',
      print: 'none',
      lists: { headings: true, figures: false, tables: false, attachments: false },
      depth: 3,
    };
  }
  const root = settings as Layer;
  const listed = CONTENTS_LISTS.some((list) => root[list] !== undefined);
  const headings = layerOf(root['headings']);
  return {
    screen: whereOf(root, 'screen'),
    print: whereOf(root, 'print'),
    // A contents that names no list lists the headings (§7.17).
    lists: {
      headings: !listed || headings !== null,
      figures: root['figures'] !== undefined,
      tables: root['tables'] !== undefined,
      attachments: root['attachments'] !== undefined,
    },
    depth: typeof headings?.['depth'] === 'number' ? headings['depth'] : 3,
  };
}

export function contentsOfForm(
  form: ContentsForm,
  settings: NotebookContents | null,
): NotebookContents | null {
  if (form.screen === 'none' && form.print === 'none') return null;
  const root: Layer = { ...((settings as Layer | null) ?? {}) };
  for (const list of CONTENTS_LISTS) {
    if (!form.lists[list]) {
      delete root[list];
      continue;
    }
    const kept: Layer = { ...(layerOf(root[list]) ?? {}) };
    if (list === 'headings') {
      if (form.depth === 3) delete kept['depth'];
      else kept['depth'] = form.depth;
    }
    root[list] = kept;
  }
  return withMedia(root, form.screen, form.print) as NotebookContents;
}
