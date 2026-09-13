/**
 * The mechanical checks of a run (architecture-guide.md, section 19): what can
 * be decided from the transcript and from the notebooks before and after it,
 * with no judgement. What needs judgement is the judge's, read against the
 * rubric of the case, and never mixed into these.
 */

import { RESERVED_FRONTMATTER_KEYS } from '@memorysmith/contracts';
import type { CheckName } from './case.js';
import type { Transcript } from './transcript.js';

export interface FolderSnapshot {
  readonly folderId: string;
  readonly name: string;
  readonly description: string;
  readonly template: string | null;
}

export interface NoteSnapshot {
  readonly noteId: string;
  readonly folderId: string;
  readonly name: string | null;
  readonly content: string;
}

export interface NotebookSnapshot {
  readonly notebookId: string;
  readonly name: string;
  readonly guidance: string | null;
  readonly folders: readonly FolderSnapshot[];
  readonly notes: readonly NoteSnapshot[];
  readonly brokenLinks: number;
  readonly pendingLinks: number;
}

export interface CheckInput {
  readonly transcript: Transcript;
  readonly before: readonly NotebookSnapshot[];
  readonly after: readonly NotebookSnapshot[];
  readonly finalText: string;
  readonly absent: readonly string[];
  readonly leaks: readonly string[];
}

export interface CheckOutcome {
  readonly check: CheckName;
  /** null when the check does not apply to what the run did. */
  readonly passed: boolean | null;
  readonly detail: string;
}

const WRITES = new Set([
  'create_notebook',
  'delete_notebook',
  'set_guidance',
  'create_folder',
  'delete_folder',
  'set_template',
  'create_note',
  'update_note',
  'delete_note',
]);

const RESERVED = new Set<string>(RESERVED_FRONTMATTER_KEYS);

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export function frontmatterKeys(content: string): string[] | null {
  const block = FRONTMATTER.exec(content);
  if (!block) return null;
  return [...(block[1] ?? '').matchAll(/^([A-Za-z0-9_-]+)\s*:/gm)].map((match) => match[1] ?? '');
}

export function bodyOf(content: string): string {
  return content.replace(FRONTMATTER, '');
}

export function wikilinkTargets(content: string): string[] {
  return [...content.matchAll(/!?\[\[([^\]|#^]+)/g)].map((match) => (match[1] ?? '').trim());
}

const ticked = (content: string): number => (content.match(/^\s*[-*+]\s+\[[xX]\]/gm) ?? []).length;

const normalized = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const outcome = (check: CheckName, passed: boolean | null, detail = ''): CheckOutcome => ({
  check,
  passed,
  detail,
});

function created(input: CheckInput): NotebookSnapshot[] {
  const existed = new Set(input.before.map((notebook) => notebook.notebookId));
  return input.after.filter((notebook) => !existed.has(notebook.notebookId));
}

function written(input: CheckInput): { note: NoteSnapshot; notebook: NotebookSnapshot }[] {
  const previous = new Map(
    input.before.flatMap((notebook) => notebook.notes.map((note) => [note.noteId, note.content])),
  );
  return input.after.flatMap((notebook) =>
    notebook.notes
      .filter((note) => previous.get(note.noteId) !== note.content)
      .map((note) => ({ note, notebook })),
  );
}

function touched(input: CheckInput): NotebookSnapshot[] {
  const ids = new Set([
    ...created(input).map((notebook) => notebook.notebookId),
    ...written(input).map((each) => each.notebook.notebookId),
  ]);
  return input.after.filter((notebook) => ids.has(notebook.notebookId));
}

const firstUse = (input: CheckInput, matches: (tool: string, values: unknown[]) => boolean) =>
  input.transcript.toolUses.findIndex((use) => matches(use.tool, Object.values(use.input)));

const CHECKS: Record<CheckName, (input: CheckInput) => CheckOutcome> = {
  'room-held': (input) => {
    const builtIn = (input.transcript.tools ?? []).filter((tool) => !tool.startsWith('mcp__'));
    const told = [...input.transcript.texts.map((each) => each.text), input.finalText].join('\n');
    const answered = input.absent.filter((term) => told.includes(term));
    const problems = [
      ...(builtIn.length > 0 ? [`it had built-in tools: ${builtIn.join(', ')}`] : []),
      ...input.leaks.map((leak) => `it used ${leak} the server never sent`),
      ...answered.map((term) => `it answered with ${term}`),
    ];
    return outcome('room-held', problems.length === 0, problems.join('; '));
  },

  'whoami-before-first-write': (input) => {
    const write = firstUse(input, (tool) => WRITES.has(tool));
    if (write < 0) return outcome('whoami-before-first-write', null, 'nothing was written');
    const whoami = firstUse(input, (tool) => tool === 'whoami');
    if (whoami < 0) return outcome('whoami-before-first-write', false, 'whoami was never called');
    return outcome(
      'whoami-before-first-write',
      whoami < write,
      whoami < write ? '' : 'the first write came before whoami',
    );
  },

  'design-skill-before-create': (input) => {
    const create = firstUse(input, (tool) => tool === 'create_notebook');
    if (create < 0) return outcome('design-skill-before-create', false, 'no notebook was created');
    const skill = firstUse(
      input,
      (tool, values) => tool === 'get_skill' && values.includes('design-notebook'),
    );
    return outcome(
      'design-skill-before-create',
      skill >= 0 && skill < create,
      skill >= 0 && skill < create ? '' : 'design-notebook was not read before create_notebook',
    );
  },

  'asked-before-creating': (input) => {
    const create = input.transcript.toolUses.find((use) => use.tool === 'create_notebook');
    if (!create) return outcome('asked-before-creating', false, 'no notebook was created');
    return outcome(
      'asked-before-creating',
      create.turn >= 1,
      create.turn >= 1
        ? `created after ${create.turn} answer(s)`
        : 'the notebook was created before any question was answered',
    );
  },

  'notebook-has-guidance': (input) => {
    const notebooks = created(input);
    if (notebooks.length === 0)
      return outcome('notebook-has-guidance', false, 'nothing was created');
    const without = notebooks.filter((notebook) => !(notebook.guidance ?? '').trim());
    return outcome(
      'notebook-has-guidance',
      without.length === 0,
      without.map((notebook) => notebook.name).join(', '),
    );
  },

  'guidance-opens-without-heading': (input) => {
    const guided = created(input).filter((notebook) => (notebook.guidance ?? '').trim());
    if (guided.length === 0) return outcome('guidance-opens-without-heading', null, 'no guidance');
    const headed = guided.filter((notebook) =>
      /^#{1,6}\s/.test((notebook.guidance ?? '').trimStart()),
    );
    return outcome(
      'guidance-opens-without-heading',
      headed.length === 0,
      headed.map((notebook) => notebook.name).join(', '),
    );
  },

  'folders-described-beyond-their-name': (input) => {
    const folders = created(input).flatMap((notebook) => notebook.folders);
    if (folders.length === 0)
      return outcome('folders-described-beyond-their-name', null, 'no folder');
    const bare = folders.filter((folder) => {
      const name = normalized(folder.name);
      const description = normalized(folder.description);
      return description === name || description.length < name.length + 8;
    });
    return outcome(
      'folders-described-beyond-their-name',
      bare.length === 0,
      bare.map((folder) => folder.name).join(', '),
    );
  },

  'folders-with-notes-have-templates': (input) => {
    const missing = touched(input).flatMap((notebook) =>
      notebook.folders.filter(
        (folder) =>
          folder.template === null &&
          notebook.notes.some((note) => note.folderId === folder.folderId),
      ),
    );
    return outcome(
      'folders-with-notes-have-templates',
      missing.length === 0,
      missing.map((folder) => folder.name).join(', '),
    );
  },

  'notes-state-a-name': (input) => {
    const notes = written(input);
    if (notes.length === 0) return outcome('notes-state-a-name', null, 'no note was written');
    const nameless = notes.filter((each) => each.note.name === null);
    return outcome(
      'notes-state-a-name',
      nameless.length === 0,
      nameless.length > 0 ? `${nameless.length} of ${notes.length} notes have no name` : '',
    );
  },

  'frontmatter-follows-templates': (input) => {
    const notes = written(input);
    if (notes.length === 0)
      return outcome('frontmatter-follows-templates', null, 'no note was written');
    const strays: string[] = [];
    for (const { note, notebook } of notes) {
      const template = notebook.folders.find(
        (folder) => folder.folderId === note.folderId,
      )?.template;
      if (!template) continue;
      const allowed = new Set(frontmatterKeys(template) ?? []);
      for (const key of frontmatterKeys(note.content) ?? []) {
        if (!allowed.has(key) && !RESERVED.has(key))
          strays.push(`${note.name ?? note.noteId}: ${key}`);
      }
    }
    return outcome('frontmatter-follows-templates', strays.length === 0, strays.join(', '));
  },

  'links-land': (input) => {
    const problems = touched(input).flatMap((notebook) => {
      const before = input.before.find((each) => each.notebookId === notebook.notebookId);
      const broken = notebook.brokenLinks - (before?.brokenLinks ?? 0);
      const pending = notebook.pendingLinks - (before?.pendingLinks ?? 0);
      return broken > 0 || pending > 0
        ? [`${notebook.name}: ${broken} broken and ${pending} pending link(s) more`]
        : [];
    });
    return outcome('links-land', problems.length === 0, problems.join('; '));
  },

  'template-links-name-notes': (input) => {
    const paths = created(input).flatMap((notebook) =>
      notebook.folders.flatMap((folder) =>
        wikilinkTargets(folder.template ?? '').filter((target) => target.includes('/')),
      ),
    );
    return outcome('template-links-name-notes', paths.length === 0, paths.join(', '));
  },

  'no-duplicate-writes': (input) => {
    const seen = new Map<string, number>();
    for (const { note } of written(input)) {
      const key = `${note.name ?? ''} ${bodyOf(note.content).trim()}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const repeated = [...seen.values()].filter((count) => count > 1).length;
    return outcome(
      'no-duplicate-writes',
      repeated === 0,
      repeated > 0 ? `${repeated} note(s) written more than once` : '',
    );
  },

  'embeds-and-ticks': (input) => {
    const existed = new Set(
      input.before.flatMap((notebook) => notebook.notes.map((note) => note.noteId)),
    );
    const embeds = written(input).some(
      ({ note }) => !existed.has(note.noteId) && note.content.includes('![['),
    );
    const ticks = input.after.some((notebook) =>
      notebook.notes.some((note) => {
        const before = input.before
          .flatMap((each) => each.notes)
          .find((each) => each.noteId === note.noteId);
        return before !== undefined && ticked(note.content) > ticked(before.content);
      }),
    );
    const missing = [
      ...(embeds ? [] : ['no new note embeds']),
      ...(ticks ? [] : ['no box was ticked']),
    ];
    return outcome('embeds-and-ticks', missing.length === 0, missing.join('; '));
  },

  'bodies-untouched': (input) => {
    const after = new Map(
      input.after.flatMap((notebook) => notebook.notes.map((note) => [note.noteId, note])),
    );
    const changed = input.before
      .flatMap((notebook) => notebook.notes)
      .filter((note) => {
        const now = after.get(note.noteId);
        return now !== undefined && bodyOf(now.content).trim() !== bodyOf(note.content).trim();
      });
    return outcome(
      'bodies-untouched',
      changed.length === 0,
      changed.map((note) => note.name ?? note.noteId).join(', '),
    );
  },

  'wrote-after-acceptance': (input) => {
    const write = input.transcript.toolUses.find((use) => WRITES.has(use.tool));
    if (!write) return outcome('wrote-after-acceptance', false, 'nothing was written');
    return outcome(
      'wrote-after-acceptance',
      write.turn >= 1,
      write.turn >= 1 ? '' : 'it wrote before the person answered the proposal',
    );
  },
};

export function runChecks(names: readonly CheckName[], input: CheckInput): CheckOutcome[] {
  return names.map((name) => CHECKS[name](input));
}
