/**
 * The two notebooks that show the specification working.
 *
 * A conformance suite proves the notation is read; a skill teaches it. Neither
 * can be read by a person deciding whether to bring their knowledge here, and
 * neither shows the notation doing its work — a callout that is drawn, a
 * wikilink that resolves, an embed that expands, a facet that filters.
 * `notebooks/trees/continuity-engineering` and `.../enologia` do, and they
 * are the only artefact of the specification that is documentation, demonstration
 * and fixture at once.
 *
 * **They are the first thing to age when a notation changes**, and they age
 * while teaching the wrong version to precisely the person who is learning.
 * That is what this test is for, and it asserts both directions:
 *
 * 1. every entry of the declared notation appears in **each** notebook, so a
 *    notation cannot be added to the specification and demonstrated nowhere;
 * 2. neither notebook demonstrates a notation the specification does **not**
 *    declare, so they cannot teach a reader something this product will not do.
 *
 * **The first direction is asked of everything the specification ADDS to what
 * a base parser already does, and that is a decision, not a filter.** Version
 * 0.3.0 restated CommonMark and GFM inside the document itself, so the declared
 * notation went from 31 entries to 54. Demanding all of them here would force a
 * setext heading, an indented code block and a link reference definition into
 * prose that has no use for any of them — which is the list of specimens these
 * notebooks were written to not be. CommonMark is the floor every renderer
 * already stands on; what a reader cannot learn anywhere else is what this
 * specification adds on top of it, and that is what these notebooks owe. GFM
 * stays in: a table, a struck word and a bare address are not universal, and
 * each of the three carries a crossing of its own — a wikilink inside a table
 * cell is an edge, a bare address never is.
 *
 * Which entries those are is `DELEGATED_TO_THE_BASE_PARSER` in `markdown.ts`.
 * It was a filter on `entry.ring` until version 0.4.0 removed the field, for
 * a reason of its own: an implementation is asked for the notation the
 * document lists and not for a specification in full. The decision above did
 * not change with it.
 *
 * **A third direction, added in the same cycle: the rejections.** They were
 * read off `recognised: false` and the specification stopped carrying them, because
 * a catalogue of the forms a specification declines can never be finished.
 * What this product does with `#subject` did not change (RN-DSC-033), so the
 * declaration moved to `DECLARED_SILENCE` and these notebooks still owe it — a
 * notebook written by somebody using the product contains only what worked, and
 * this is the one place a form that does nothing is shown beside one that
 * does.
 *
 * **A fourth direction, added with 0.6.0: every link lands.** Resolution used
 * to be forgiving — a target differing in case, in an accent or in a piece of
 * punctuation found its note anyway — and these notebooks were written against
 * that. Each of those is a pending link now, and a demonstration notebook
 * demonstrating a broken graph teaches the wrong thing to precisely the person
 * reading it to decide whether to bring their knowledge here. So every target
 * has to resolve, by name and then by alias, **except the ones declared
 * below**: a pending link is not a defect, it is a form these notebooks are
 * required to show, and the only honest way to demand both is to name the ones
 * that are deliberate.
 *
 * The prose is written by hand, because a generated notebook teaches nothing.
 * This is what keeps it honest.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DECLARED_SILENCE,
  DELEGATED_TO_THE_BASE_PARSER,
  RECOGNISED_NOTATION,
} from '../src/markdown.js';

/**
 * What the notebooks owe: everything the specification adds to what a base parser
 * already does. The reason is in the preamble.
 *
 * It was a filter on `entry.ring` until version 0.4.0, which dropped the
 * field. The scope did not change and the place it is written did: it is now
 * an explicit list in `markdown.ts`, and the second assertion below is what
 * keeps it from quietly absorbing a notation added in a later version, which
 * is the property the field used to give for free.
 */
const DEMANDED = RECOGNISED_NOTATION.filter((entry) => !DELEGATED_TO_THE_BASE_PARSER.has(entry.id));

const NOTEBOOKS = resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  '..',
  '..',
  'notebooks',
  'trees',
);

/** The two, named: en-US and pt-BR, and not translations of each other. */
const DEMONSTRATION = ['continuity-engineering', 'enologia'] as const;

/**
 * The targets these notebooks leave unresolved ON PURPOSE, and why.
 *
 * `pending-link-display` is a declared notation and both notebooks owe it: a link
 * to a note nobody has written yet is kept, is reported, and resolves on its
 * own the day the note arrives. Showing that requires a target that matches
 * nothing, so the fourth direction of this test asks for every OTHER target to
 * land and asks these to be named here, next to the note that explains them.
 */
const DELIBERATELY_PENDING: Record<string, readonly string[]> = {
  'continuity-engineering': ['Warehouse recovery objective'],
  enologia: ['Correlação IPT e safra fria'],
};

/**
 * The notes these notebooks leave with no `name:` ON PURPOSE. A note without a
 * name is stored, renders and is searchable, and no link can reach it — the
 * rule of §5.3 shown rather than described. Every other note of every
 * committed notebook states one, and the guard below asks for it.
 */
const DELIBERATELY_UNNAMED: Record<string, readonly string[]> = {
  'continuity-engineering': ['Exercise 2026-06 · Account loss (draft).md'],
  enologia: ['Rascunho da safra 2027.md'],
};

/**
 * The eight notebooks that are not demonstrations carry somebody's real notes,
 * and a link into a note that was never brought across is an ordinary pending
 * link rather than a defect. What must not happen is a NEW one arriving
 * unnoticed, so each tree carries a ceiling instead of a zero: adding a link
 * that lands nowhere fails the build, and repairing one never does.
 */
const PENDING_CEILING: Record<string, number> = {
  'engineering-knowledge': 11,
  'glpi-discovery': 102,
  'regulacao-energia': 6,
  fermentacao: 0,
  'jurisprudencia-tributaria': 0,
  'onboarding-engenharia': 0,
  'pesquisa-mercado': 0,
  'runbooks-producao': 0,
};

interface Note {
  readonly path: string;
  readonly head: string;
  readonly body: string;
  readonly raw: string;
}

function notesOf(slug: string): Note[] {
  const found: Note[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('.md')) continue;
      // GUIDANCE, STRUCTURE and TEMPLATE are generated from the model; the
      // notation is demonstrated in the notes somebody wrote.
      if (['GUIDANCE.md', 'STRUCTURE.md', 'TEMPLATE.md'].includes(entry)) continue;

      const raw = readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
      const cut = raw.startsWith('---') ? raw.indexOf('\n---', 3) : -1;
      found.push({
        path: full,
        head: cut === -1 ? '' : raw.slice(4, cut),
        body: cut === -1 ? raw : raw.slice(cut + 4),
        raw,
      });
    }
  };

  walk(join(NOTEBOOKS, slug));
  return found;
}

/** The `name:` a note states, or an empty string when it states none. */
const nameOf = (note: Note): string => /^name:\s*(.+)$/m.exec(note.head)?.[1]?.trim() ?? '';

/** Every note name of the notebook, to tell a resolved link from a pending one. */
function statedNamesOf(notes: Note[]): Set<string> {
  return new Set(
    notes
      .map(nameOf)
      .filter(Boolean)
      .map((name) => name.normalize('NFC')),
  );
}

/** The names plus the aliases, which is what a target is resolved against. */
function namesOf(notes: Note[]): Set<string> {
  const names = statedNamesOf(notes);
  for (const note of notes) {
    const inline = /^aliases:\s*\[([^\]]*)\]/m.exec(note.head)?.[1];
    for (const each of (inline ?? '').split(',')) {
      const value = each.trim().replace(/^["']|["']$/g, '');
      if (value) names.add(value.normalize('NFC'));
    }
    const block = /^aliases:\n((?:[ \t]+-[ \t]+.*\n)+)/m.exec(note.head)?.[1] ?? '';
    for (const each of block.matchAll(/-[ \t]+(.*)/g)) {
      names.add((each[1] ?? '').trim().normalize('NFC'));
    }
  }
  return names;
}

const WIKILINK_TARGET = /(^|[^!])\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/gm;

/** A link inside code is an example and never an edge. */
const outsideCode = (body: string): string =>
  body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');

/** Every wikilink target of a notebook, with the note that wrote it. */
function targetsOf(notes: Note[]): Array<{ note: string; target: string }> {
  const found: Array<{ note: string; target: string }> = [];
  for (const note of notes) {
    for (const match of outsideCode(note.body).matchAll(WIKILINK_TARGET)) {
      // Inside a table cell the pipe of an alias is escaped, so the target
      // ends at the backslash the author wrote in front of it.
      const target = (match[2] ?? '').trim().replace(/\\$/, '').trim().normalize('NFC');
      if (target) found.push({ note: note.path, target });
    }
  }
  return found;
}

/** Whether any note of the notebook demonstrates the notation of this id. */
type Detector = (notes: Note[]) => boolean;

const inBody =
  (pattern: RegExp): Detector =>
  (notes) =>
    notes.some((note) => pattern.test(note.body));

const inHead =
  (pattern: RegExp): Detector =>
  (notes) =>
    notes.some((note) => pattern.test(note.head));

const DETECTS: Record<string, Detector> = {
  wikilink: inBody(/(^|[^!\]])\[\[[^\]|#]+\]\]/m),
  'wikilink-alias': inBody(/\[\[[^\]]+\|[^\]]+\]\]/),
  'wikilink-anchor': inBody(/(^|[^!])\[\[[^\]]+#(?!\^)[^\]]+\]\]/m),
  embed: inBody(/!\[\[[^\]#|]+\]\]/),
  'block-embed': inBody(/!\[\[[^\]]+#\^[^\]]+\]\]/),
  'markdown-relative-link': inBody(/\[[^\]]+\]\((?!https?:)[^)]*\.md\)/),
  'external-link': inBody(/\[[^\]]+\]\(https?:\/\//),
  'link-in-code': inBody(/`[^`\n]*\[\[[^`\n]*`/),
  'frontmatter-enum': inHead(/^maturity:\s*\w+$/m),
  'frontmatter-list': inHead(/^tags:\s*\[[^\]]+\]$/m),
  'frontmatter-boolean': inHead(/^reviewed:\s*(true|false)$/m),
  // A date attribute the notebook invented, not one of the reserved two.
  'frontmatter-date': inHead(/^(?!created|updated)[a-z_]+:\s*\d{4}-\d{2}-\d{2}$/m),
  'frontmatter-aliases': inHead(/^aliases:\s*\[[^\]]+\]$/m),
  'frontmatter-tags': inHead(/^tags:\s*\[/m),
  'frontmatter-created': inHead(/^created:\s*\d{4}-\d{2}-\d{2}$/m),
  'frontmatter-updated': inHead(/^updated:\s*\d{4}-\d{2}-\d{2}$/m),
  'frontmatter-name': inHead(/^name:\s*\S/m),
  'frontmatter-author': inHead(/^author:\s*\S/m),
  'frontmatter-co-author': inHead(/^co-author:\s*\S/m),
  // §5.3 shown rather than described: a note whose `name:` is not what its
  // heading says, because a heading is only content and never names a note.
  'note-name': (notes) =>
    notes.some((note) => {
      const stated = nameOf(note);
      const heading = /^#\s+(.+)$/m.exec(note.body)?.[1]?.trim();
      return Boolean(stated && heading && stated !== heading);
    }),
  // A file of the notebook that is not a note, addressed by its whole name.
  attachment: inBody(/`[a-z0-9-]+\.(csv|png|pdf)`/i),
  'image-dimensions': inBody(/!\[[^\]]*\|\d+x\d+\]\(/),
  'frontmatter-prose': inHead(/^[a-z_]+:\s*.{41,}$/m),
  'inline-tag': inBody(/(^|\s)#[a-z][a-z-]{2,}/m),
  callout: inBody(/^>\s*\[![a-z]+\]/m),
  mermaid: inBody(/^```mermaid$/m),
  transclusion: inBody(/!\[\[/),
  'pending-link-display': (notes) => {
    const names = statedNamesOf(notes);
    return notes.some((note) =>
      [...note.body.matchAll(/(^|[^!])\[\[([^\]|#]+)/gm)].some(
        (match) => !names.has((match[2] ?? '').trim()),
      ),
    );
  },
  'task-list': inBody(/^- \[[ xX]\] /m),
  highlight: inBody(/==[^=\n]+==/),
  comment: inBody(/%%[\s\S]*?%%/),
  'block-id': inBody(/[ \t]\^[a-z0-9-]+$/m),
  'math-inline': inBody(/(^|[^$])\$[^$\n]+\$([^$]|$)/m),
  'math-block': inBody(/^\$\$/m),
  'sub-sup': inBody(/~[^~\s]+~|\^[^\s^]+\^/),
  'raw-html': inBody(/<[a-z]+[\s>]/),
  // A table with a wikilink in a cell, which is the crossing worth showing: a
  // cell is a place text lives and not a boundary the extractor stops at.
  table: inBody(/^\|.*\[\[.*\|/m),
  strikethrough: inBody(/~~[^~\n]+~~/),
  // Bare, without the angle brackets. External either way, and never an edge.
  'autolink-extended': inBody(/(^|[^(<\]])https?:\/\//m),
};

/**
 * Notations that exist in the ecosystem and are NOT in this specification. A notebook
 * carrying one of them would be teaching a reader something this product does
 * not do, which is the failure the second direction of this test guards.
 */
const UNDECLARED: Record<string, RegExp> = {
  'a dataview or query block': /^```(dataview|dataviewjs|query|tasks)$/m,
  'a footnote reference': /\[\^[A-Za-z0-9-]+\]/,
  'a templater expression': /<%[\s\S]*?%>/,
  'a handlebars placeholder': /\{\{[^}\n]+\}\}/,
  'an inline field, Dataview style': /^\s*[A-Za-z][A-Za-z ]*::\s*\S/m,
};

describe.each(DEMONSTRATION)('%s demonstrates the whole declared notation', (slug) => {
  const notes = notesOf(slug);

  it('is a notebook somebody wrote, with notes in it', () => {
    expect(notes.length).toBeGreaterThan(2);
  });

  it.each(DEMANDED.map((entry) => entry.id))('shows %s in context', (id) => {
    const detect = DETECTS[id];
    // A declared notation with no detector here is a failure of this test and
    // not a gap to find later: the specification cannot grow an entry these notebooks
    // are silently not demonstrating.
    expect(detect, `no detector written for the notation "${id}"`).toBeDefined();
    expect(detect?.(notes), `"${id}" is declared and appears nowhere in ${slug}`).toBe(true);
  });

  it.each(DECLARED_SILENCE.map((entry) => entry.id))('shows %s being ignored', (id) => {
    // The rejections are demanded exactly as the declarations are, and for a
    // sharper reason: a notebook written by somebody using the product only ever
    // contains what worked, so this is the one place a reader sees a form that
    // does nothing sitting beside the form that does. They were read off
    // `recognised: false` until version 0.4.0 stopped carrying it.
    const detect = DETECTS[id];
    expect(detect, `no detector written for the silence "${id}"`).toBeDefined();
    expect(detect?.(notes), `"${id}" is a declared silence and appears nowhere in ${slug}`).toBe(
      true,
    );
  });

  it.each(Object.entries(UNDECLARED))('demonstrates no %s', (_name, pattern) => {
    const offending = notes.filter((note) => pattern.test(note.body));
    expect(offending.map((note) => note.path)).toEqual([]);
  });

  it('carries its own guidance and a template in every folder', () => {
    const root = join(NOTEBOOKS, slug);
    expect(readdirSync(root)).toContain('GUIDANCE.md');
    expect(readdirSync(root)).toContain('STRUCTURE.md');

    const folders = readdirSync(root).filter((entry) => statSync(join(root, entry)).isDirectory());
    expect(folders.length).toBeGreaterThan(1);
    for (const folder of folders) {
      expect(readdirSync(join(root, folder)), `${folder} has no template`).toContain('TEMPLATE.md');
    }
  });

  it('writes the reserved keys in en-US, whatever language the notebook is in', () => {
    // RN-DSC-030. The pt-BR notebook is the one that proves this is a rule and
    // not an accident of both notebooks happening to be English.
    for (const note of notes) {
      expect(note.head, note.path).toMatch(/^aliases:/m);
      expect(note.head, note.path).toMatch(/^tags:/m);
      expect(note.head, note.path).toMatch(/^created:/m);
      expect(note.head, note.path).toMatch(/^updated:/m);
    }
  });

  it('lands every link it writes, except the ones it means to leave pending', () => {
    const names = namesOf(notes);
    const deliberate = new Set(DELIBERATELY_PENDING[slug] ?? []);
    const pending = targetsOf(notes).filter(
      (each) => !names.has(each.target) && !deliberate.has(each.target),
    );

    expect(
      pending.map((each) => `${each.target} <- ${each.note}`),
      'a target that matches no name and no alias of this notebook',
    ).toEqual([]);
  });

  it('keeps every deliberate pending target pending, and no other', () => {
    // The declaration expires by itself: writing the note that was missing
    // makes the target resolve, and this fails until the entry goes with it.
    const names = namesOf(notes);
    const written = new Set(targetsOf(notes).map((each) => each.target));
    for (const target of DELIBERATELY_PENDING[slug] ?? []) {
      expect(written.has(target), `${target} is declared pending and is linked nowhere`).toBe(true);
      expect(names.has(target), `${target} is declared pending and now resolves`).toBe(false);
    }
  });

  it('carries a note that a link cannot name, and one that two notes answer', () => {
    // RN-KNW-036 and RN-KNW-037, in the two notebooks that show them: a name
    // with one of the four delimiters in it, and one name on two notes. The
    // pt-BR notebook is where the repeated name lives, because `Índice` is the
    // name anybody would write twice.
    const names = notes.map(nameOf).filter(Boolean);
    const unaddressable = names.filter((name) => /[#[\]|]/.test(name));
    const repeated = names.filter((name, at) => names.indexOf(name) !== at);

    expect(
      unaddressable.length + repeated.length,
      `${slug} shows neither an unaddressable name nor a repeated one`,
    ).toBeGreaterThan(0);
  });

  it('carries a note that states no name, and says why in its own prose', () => {
    // RN-KNW-036: a note written without `name:` has no name. It is here on
    // purpose, beside a heading that would have named it under the old rule.
    const unnamed = notes.filter((note) => nameOf(note) === '');
    expect(
      unnamed.map((note) => note.path.split(/[\\/]/).pop()),
      `${slug} leaves exactly the declared notes unnamed`,
    ).toEqual([...(DELIBERATELY_UNNAMED[slug] ?? [])]);
    for (const note of unnamed) {
      expect(note.body, note.path).toMatch(/^#\s+\S/m);
      expect(note.body, note.path).toMatch(/`name:`/);
    }
  });

  it.each([
    'note-name',
    'attachment',
    'image-dimensions',
    'frontmatter-author',
    'frontmatter-co-author',
  ])('shows %s, one of the five notations 0.6.0 added', (id) => {
    // They were demonstrated before the specification declared them (#97), so
    // the direction above — every declared notation appears in each notebook —
    // passed on the day it did instead of failing on it.
    const detect = DETECTS[id];
    expect(detect, `no detector written for "${id}"`).toBeDefined();
    expect(detect?.(notes), `"${id}" appears nowhere in ${slug}`).toBe(true);
  });

  it('teaches the rejections next to what to write instead', () => {
    // The half of the specification no other notebook will ever show: a notebook written
    // by somebody using the product only contains what worked. Each rejection
    // has to be beside the thing to write in its place, or it is a list of
    // prohibitions and not an explanation.
    const all = notes.map((note) => note.body).join('\n');

    // The inline tag, and both alternatives named in the same passage.
    expect(all).toMatch(/`tags:`/);
    expect(all).toMatch(/wikilink/i);
    // Raw HTML, and the callout that replaces it.
    expect(all).toMatch(/callout/i);
    // Superscript and subscript, and the formula that replaces them.
    expect(all).toMatch(/\$H_2O\$/);
    // Prose in the frontmatter, said where somebody would have written it.
    expect(all).toMatch(/forty|quarenta/i);
  });
});

describe('every committed notebook ships a graph that resolves', () => {
  it.each(Object.entries(PENDING_CEILING))(
    '%s writes no new link that lands nowhere',
    (slug, ceiling) => {
      // These eight are somebody's real notes, brought across from a tree this
      // repository does not hold. A link into a note that never came is an
      // ordinary pending link; a NEW one is a broken graph being committed.
      const notes = notesOf(slug);
      const names = namesOf(notes);
      const pending = targetsOf(notes).filter((each) => !names.has(each.target));

      expect(pending.length, `${slug} has ${pending.length} pending targets`).toBeLessThanOrEqual(
        ceiling,
      );
    },
  );

  it('states a name in every note of every notebook, but the ones left unnamed on purpose', () => {
    // RN-KNW-035: a note is named by `name:` and by nothing else, so a note that
    // states none has no name and no link reaches it. `build-notebooks.mjs`
    // writes the file name in as `name:`, except for the declared demonstrations.
    for (const slug of [...DEMONSTRATION, ...Object.keys(PENDING_CEILING)]) {
      const deliberate = new Set(DELIBERATELY_UNNAMED[slug] ?? []);
      const without = notesOf(slug).filter(
        (note) =>
          !/^name:\s*\S/m.test(note.head) && !deliberate.has(note.path.split(/[\\/]/).pop() ?? ''),
      );
      expect(
        without.map((note) => note.path),
        `${slug}`,
      ).toEqual([]);
    }
  });
});

describe('the pair reads as two notebooks and not as one typed twice', () => {
  it('does not repeat the subject matter of one in the other', () => {
    const [en, pt] = DEMONSTRATION.map((slug) => notesOf(slug).map(nameOf).filter(Boolean).sort());

    expect(en).not.toEqual(pt);
    expect(en?.some((name) => pt?.includes(name))).toBe(false);
  });

  it('keeps the vocabulary of each notebook in its own language, beside the reserved keys', () => {
    const pt = notesOf('enologia');
    // `regiao` and `tipo` are this notebook's own words, and nothing translates
    // them. The reserved four above are in en-US in the same file.
    expect(pt.every((note) => /^regiao:/m.test(note.head))).toBe(true);
    expect(pt.some((note) => /^tipo:/m.test(note.head))).toBe(true);
  });
});
