/**
 * The catalogue of the agent evaluation (architecture-guide.md, section 19).
 *
 * One folder per case under `agent-eval/cases`, holding a `case.json` and the
 * sheets its simulated user reads. The catalogue is repeated every round and
 * grows: a defect found becomes a case before it is fixed. A case is frozen
 * within a round, because what moves between rounds is the product, and a case
 * changes only in a commit of its own.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITORY_ROOT } from '../../commands/lib/repository.js';

export const CASES_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', 'cases');

export const CHECK_NAMES = [
  'room-held',
  'whoami-before-first-write',
  'design-skill-before-create',
  'asked-before-creating',
  'notebook-has-guidance',
  'guidance-opens-without-heading',
  'folders-described-beyond-their-name',
  'folders-with-notes-have-templates',
  'notes-state-a-name',
  'frontmatter-follows-templates',
  'links-land',
  'checked-before-done',
  'template-links-name-notes',
  'no-duplicate-writes',
  'embeds-and-ticks',
  'bodies-untouched',
  'wrote-after-acceptance',
  'file-kept-whole',
  'file-shown',
] as const;

export type CheckName = (typeof CHECK_NAMES)[number];

/** Where a run starts from, in the subscription of a fresh account. */
export type Setup =
  | { readonly kind: 'empty' }
  /** A tree written first, by path from the root of the repository. */
  | { readonly kind: 'tree'; readonly path: string }
  /** The account, and so the notebook, a variant of an earlier case left in the same round. */
  | { readonly kind: 'from-case'; readonly case: string; readonly variant: string };

export interface CaseVariant {
  readonly id: string;
  /** The local part of the account's e-mail, which whoami shows the executor: a person's name. */
  readonly person: string;
  /** What a person asks, in their words, never in a word the connector has not served. */
  readonly request: string;
  /** The sheet the simulated user reads, beside case.json, or null when nobody answers. */
  readonly persona: string | null;
  readonly setup: Setup;
  /** Strings the executor must not produce, for a case that asks what only the repository knows. */
  readonly absent?: readonly string[];
  /**
   * The file the person hands the executor (#295), by its path from the root of
   * the repository: its text takes the place of `{{file}}` in the request, and
   * what is kept is held to its bytes.
   */
  readonly hands?: string;
}

export interface EvaluationCase {
  readonly id: string;
  readonly title: string;
  readonly exercises: string;
  /** The skills this case exercises, by the names whoami announces. */
  readonly skills: readonly string[];
  /** How many times the executor may speak before the run ends. */
  readonly turns: number;
  readonly checks: readonly CheckName[];
  /** What the judge reads the run against, after it. */
  readonly rubric: readonly string[];
  readonly variants: readonly CaseVariant[];
  readonly directory: string;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined || value === null) throw new Error(`A case is missing ${what}.`);
  return value;
}

export function loadCases(directory = CASES_DIRECTORY): EvaluationCase[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(directory, entry.name, 'case.json')))
    .map((entry) => {
      const folder = join(directory, entry.name);
      const raw = JSON.parse(readFileSync(join(folder, 'case.json'), 'utf8')) as Partial<
        Omit<EvaluationCase, 'directory'>
      >;
      const checks = required(raw.checks, `checks in ${entry.name}`);
      for (const check of checks) {
        if (!CHECK_NAMES.includes(check))
          throw new Error(`${entry.name} names no check "${check}".`);
      }
      return {
        id: required(raw.id, `an id in ${entry.name}`),
        title: required(raw.title, `a title in ${entry.name}`),
        exercises: required(raw.exercises, `what ${entry.name} exercises`),
        skills: required(raw.skills, `the skills of ${entry.name}`),
        turns: required(raw.turns, `the turns of ${entry.name}`),
        checks,
        rubric: required(raw.rubric, `the rubric of ${entry.name}`),
        variants: required(raw.variants, `the variants of ${entry.name}`),
        directory: folder,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function personaOf(evaluationCase: EvaluationCase, variant: CaseVariant): string | null {
  return variant.persona
    ? readFileSync(join(evaluationCase.directory, variant.persona), 'utf8')
    : null;
}

/**
 * The file a variant hands the executor, read as bytes: its text, its size and
 * its SHA-256, and every SHA-256 that is the same file as the person handed it.
 *
 * A file pasted into the request is the text the message shows, and the line
 * break that closes it on disk is the last character of the message, which no
 * reader of it can see. So a pasted file is whole with that one line break or
 * without it, and a change anywhere else in the text is still a slip (#309).
 */
export function handedFile(variant: CaseVariant): {
  readonly text: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly whole: readonly string[];
} | null {
  if (!variant.hands) return null;
  const bytes = readFileSync(join(REPOSITORY_ROOT, variant.hands));
  const sha256 = (of: Buffer): string => createHash('sha256').update(of).digest('hex');
  const text = bytes.toString('utf8');
  const pasted = variant.request.trimEnd().endsWith('{{file}}');
  const unclosed = text.replace(/\r?\n$/, '');
  return {
    text,
    bytes: bytes.length,
    sha256: sha256(bytes),
    whole:
      pasted && unclosed !== text
        ? [sha256(bytes), sha256(Buffer.from(unclosed, 'utf8'))]
        : [sha256(bytes)],
  };
}

/** What the person first says, with the file they hand pasted where `{{file}}` stands. */
export function requestOf(variant: CaseVariant): string {
  const handed = handedFile(variant);
  return handed ? variant.request.replace('{{file}}', handed.text) : variant.request;
}
