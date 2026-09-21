/**
 * The blind agent evaluation (architecture-guide.md, section 19). What these
 * cases protect is the instrument itself: that a transcript is read as it was
 * printed, that a leak is told from what the server sent, that a skill without a
 * case stops a round, that each check decides what it says it decides, and that
 * the room is closed unless it is deliberately opened.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadCases } from '../agent-eval/lib/case.js';
import { runChecks, type NotebookSnapshot } from '../agent-eval/lib/checks.js';
import { skillsAnnounced, uncoveredSkills } from '../agent-eval/lib/coverage.js';
import { leaksIn } from '../agent-eval/lib/leaks.js';
import { claudeArguments, type Room } from '../agent-eval/lib/room.js';
import { scorecard } from '../agent-eval/lib/scorecard.js';
import { emptyTranscript, readTurn } from '../agent-eval/lib/transcript.js';

const event = (value: unknown): string => JSON.stringify(value);

const tool = (name: string, input: Record<string, unknown> = {}) =>
  event({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: `mcp__memorysmith__${name}`, input }] },
  });

describe('the transcript of a session', () => {
  it('reads the tools it had, what it called, what it said and what the server answered', () => {
    const transcript = emptyTranscript();
    const outcome = readTurn(
      [
        event({ type: 'system', subtype: 'init', tools: [], session_id: 's1' }),
        tool('whoami'),
        event({
          type: 'user',
          message: {
            content: [{ type: 'tool_result', content: [{ type: 'text', text: 'served' }] }],
          },
        }),
        event({ type: 'assistant', message: { content: [{ type: 'text', text: 'Done?' }] } }),
        event({ type: 'result', result: 'Done?', session_id: 's1', total_cost_usd: 0.5 }),
        'not json',
      ],
      0,
      transcript,
    );

    expect(outcome).toEqual({ sessionId: 's1', text: 'Done?', isError: false, costUsd: 0.5 });
    expect(transcript.tools).toEqual([]);
    expect(transcript.toolUses).toEqual([{ tool: 'whoami', input: {}, turn: 0 }]);
    expect(transcript.toolResults).toEqual(['served']);
  });
});

describe('a leak into the clean room', () => {
  it('is a term the executor used and the server never sent', () => {
    const transcript = emptyTranscript();
    transcript.texts.push({ turn: 0, text: 'Per RN-KNW-037 and the bounded context of Access…' });
    transcript.toolResults.push('Notes may share a name (RN-KNW-037).');
    expect(leaksIn(transcript)).toEqual(['bounded context']);
  });
});

describe('the coverage of the skills', () => {
  const whoami = [
    '## The path',
    '- `whoami` — not a skill',
    '',
    '## Skills, for the tasks that leave the common path',
    '',
    '- `design-notebook` — design one',
    '- `write-notes` — write in one',
    '',
    '## Every tool',
    '- `create_note` — writes',
  ].join('\n');

  it('reads the index whoami serves, and nothing outside it', () => {
    expect(skillsAnnounced(whoami)).toEqual(['design-notebook', 'write-notes']);
  });

  it('names every skill no case exercises, which stops a round', () => {
    expect(
      uncoveredSkills(['design-notebook', 'write-notes'], [{ skills: ['write-notes'] }]),
    ).toEqual(['design-notebook']);
  });
});

const notebook = (overrides: Partial<NotebookSnapshot> = {}): NotebookSnapshot => ({
  notebookId: 'n1',
  name: 'Consultório',
  guidance: 'Este caderno guarda casos, protocolos e artigos.',
  folders: [
    {
      folderId: 'f1',
      name: 'Casos',
      description: 'Um caso por paciente, com a condição principal e o retorno.',
      template: '---\nname: \ncondicao: \nretorno: \n---\n\nVer [[Protocolo RI]].',
    },
  ],
  notes: [],
  pendingLinks: 0,
  ...overrides,
});

describe('the mechanical checks', () => {
  it('pass a notebook designed by the method, written after whoami and the skill', () => {
    const transcript = emptyTranscript();
    transcript.tools = [];
    transcript.toolUses.push(
      { tool: 'whoami', input: {}, turn: 0 },
      { tool: 'get_skill', input: { name: 'design-notebook' }, turn: 0 },
      { tool: 'create_notebook', input: {}, turn: 1 },
    );
    const after = [
      notebook({
        notes: [
          {
            noteId: 'x1',
            folderId: 'f1',
            name: 'R.M., 41 anos',
            content:
              '---\nname: R.M., 41 anos\ncondicao: resistência à insulina\ntags: [RI]\n---\n\nTexto.',
          },
        ],
      }),
    ];
    const outcomes = runChecks(
      [
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
        'template-links-name-notes',
        'no-duplicate-writes',
      ],
      { transcript, before: [], after, finalText: 'Pronto.', absent: [], leaks: [] },
    );
    expect(outcomes.filter((outcome) => outcome.passed === false)).toEqual([]);
  });

  it('fail a Guidance that opens with a heading, a folder described by its name and a property nobody declared', () => {
    const transcript = emptyTranscript();
    transcript.toolUses.push({ tool: 'create_notebook', input: {}, turn: 0 });
    const after = [
      notebook({
        guidance: '# Consultório\n\nCasos.',
        folders: [
          { folderId: 'f1', name: 'Casos', description: 'Casos.', template: '---\nname: \n---' },
        ],
        notes: [
          { noteId: 'x1', folderId: 'f1', name: null, content: '---\nhumor: bom\n---\n\nTexto.' },
        ],
      }),
    ];
    const failed = runChecks(
      [
        'whoami-before-first-write',
        'design-skill-before-create',
        'asked-before-creating',
        'guidance-opens-without-heading',
        'folders-described-beyond-their-name',
        'notes-state-a-name',
        'frontmatter-follows-templates',
      ],
      { transcript, before: [], after, finalText: '', absent: [], leaks: [] },
    ).filter((outcome) => outcome.passed === false);
    expect(failed.map((outcome) => outcome.check)).toEqual([
      'whoami-before-first-write',
      'design-skill-before-create',
      'asked-before-creating',
      'guidance-opens-without-heading',
      'folders-described-beyond-their-name',
      'notes-state-a-name',
      'frontmatter-follows-templates',
    ]);
  });

  it('fail a room whose executor answered what only the repository knows', () => {
    const transcript = emptyTranscript();
    transcript.tools = ['Read', 'mcp__memorysmith__whoami'];
    const [held] = runChecks(['room-held'], {
      transcript,
      before: [],
      after: [],
      finalText: 'It is the USAGE item of mv-knowledge.',
      absent: ['USAGE', 'mv-knowledge'],
      leaks: [],
    });
    expect(held?.passed).toBe(false);
    expect(held?.detail).toContain('built-in tools: Read');
    expect(held?.detail).toContain('answered with USAGE');
  });

  it('tell a conversion that touched the text of a note, or wrote before the person answered', () => {
    const before = [
      notebook({
        notes: [
          {
            noteId: 'x1',
            folderId: 'f1',
            name: 'A',
            content: '---\nname: A\n---\n\nTexto #ideia.',
          },
        ],
      }),
    ];
    const after = [
      notebook({
        notes: [
          {
            noteId: 'x1',
            folderId: 'f1',
            name: 'A',
            content: '---\nname: A\ncliente: mares\n---\n\nTexto.',
          },
        ],
      }),
    ];
    const transcript = emptyTranscript();
    transcript.toolUses.push({ tool: 'update_note', input: {}, turn: 0 });
    const outcomes = runChecks(['bodies-untouched', 'wrote-after-acceptance'], {
      transcript,
      before,
      after,
      finalText: '',
      absent: [],
      leaks: [],
    });
    expect(outcomes.map((outcome) => outcome.passed)).toEqual([false, false]);
  });
});

describe('the clean room', () => {
  const room: Room = {
    workdir: 'W',
    executorConfig: 'E',
    userConfig: 'U',
    userPrompt: 'persona',
    dispose: () => undefined,
  };

  it('gives the executor no setting source, no skill, no built-in tool and only the connector', () => {
    const { args, cwd } = claudeArguments({
      room,
      role: 'executor',
      model: 'haiku',
      prompt: 'hi',
      resume: null,
    });
    expect(cwd).toBe('W');
    expect(args).toEqual(
      expect.arrayContaining(['--strict-mcp-config', '--disable-slash-commands']),
    );
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
    expect(args[args.indexOf('--mcp-config') + 1]).toBe('E');
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('mcp__memorysmith');
  });

  it('gives the simulated user no server at all, and its sheet', () => {
    const { args } = claudeArguments({
      room,
      role: 'user',
      model: 'sonnet',
      prompt: 'hi',
      resume: 's2',
    });
    expect(args[args.indexOf('--mcp-config') + 1]).toBe('U');
    expect(args[args.indexOf('--system-prompt') + 1]).toBe('persona');
    expect(args[args.indexOf('--resume') + 1]).toBe('s2');
  });

  it('is opened only when asked, in the repository, with tools to read it', () => {
    const { args, cwd } = claudeArguments({
      room,
      role: 'executor',
      model: 'haiku',
      prompt: 'hi',
      resume: null,
      openedAt: 'REPO',
    });
    expect(cwd).toBe('REPO');
    expect(args).not.toContain('--strict-mcp-config');
    expect(args[args.indexOf('--allowedTools') + 1]).toContain('Read');
  });
});

describe('the catalogue', () => {
  const cases = loadCases();

  it('holds AE-00 to AE-03 and AE-06, each with a variant, a check and a rubric', () => {
    expect(cases.map((each) => each.id)).toEqual(['AE-00', 'AE-01', 'AE-02', 'AE-03', 'AE-06']);
    for (const each of cases) {
      expect(each.variants.length).toBeGreaterThan(0);
      expect(each.checks.length).toBeGreaterThan(0);
      expect(each.rubric.length).toBeGreaterThan(0);
    }
  });

  it('never uses, in a request, a word the connector has not served', () => {
    for (const each of cases) {
      for (const variant of each.variants) {
        expect(variant.request).not.toMatch(
          /\b(guidance|template|whoami|skill|orientação|modelo)\b/i,
        );
      }
    }
  });

  it('names a sheet that exists for every persona, and a person for every account', () => {
    for (const each of cases) {
      for (const variant of each.variants) {
        if (variant.persona) expect(existsSync(join(each.directory, variant.persona))).toBe(true);
        expect(variant.person).toMatch(/^[a-z]+$/);
        expect(variant.person).not.toMatch(/test|eval|agent|bot/);
      }
    }
  });
});

describe('the scorecard of a round', () => {
  it('counts passes over the applicable runs of each model, leaving out a run that leaked', () => {
    const card = scorecard({
      round: 'r1',
      environment: 'staging',
      version: '0.6.0-rc.1+abc1234',
      models: ['sonnet', 'haiku'],
      results: [
        {
          caseId: 'AE-01',
          variant: 'pt_BR',
          model: 'sonnet',
          run: 1,
          outcomes: [{ check: 'room-held', passed: true, detail: '' }],
          leaks: [],
          costUsd: 1,
          turns: 3,
          error: null,
        },
        {
          caseId: 'AE-01',
          variant: 'pt_BR',
          model: 'sonnet',
          run: 2,
          outcomes: [{ check: 'room-held', passed: false, detail: '' }],
          leaks: [],
          costUsd: 1,
          turns: 3,
          error: null,
        },
        {
          caseId: 'AE-01',
          variant: 'pt_BR',
          model: 'haiku',
          run: 1,
          outcomes: [{ check: 'room-held', passed: true, detail: '' }],
          leaks: ['bounded context'],
          costUsd: 1,
          turns: 3,
          error: null,
        },
      ],
    });
    expect(card).toContain('| room-held | 1/2 | — |');
    expect(card).toContain('| runs discarded for a leak | 0 | 1 |');
  });
});
