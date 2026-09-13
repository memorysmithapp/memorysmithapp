/**
 * A round of the blind agent evaluation (architecture-guide.md, section 19).
 *
 *   pnpm -C memorysmith-infra exec playwright install chromium
 *   pnpm -C memorysmith-infra agent-eval --environment staging
 *     [--models sonnet,haiku] [--runs 3] [--cases AE-00,AE-01] [--user-model sonnet]
 *     [--open-room] [--keep-accounts]
 *
 * With credentials of the account, and never against production. Before
 * anything is written it reads the index of skills the connector announces and
 * refuses to start when a skill has no case. Then, for each model and each run,
 * it plays every case: a fresh account, a token of the connector obtained the
 * way a person obtains one, the executor in a clean room, the simulated user
 * relaying turns up to the cap of the case, and the notebooks read before and
 * after. Each run keeps its transcript, the dialogue, the snapshots, the export
 * and the result of every check under `agent-eval/runs/`, which git ignores, and
 * the round ends with its scorecard there.
 *
 * `--open-room` runs the executor in the repository with its tools, which is how
 * AE-00 is shown to fail when the room leaks.
 */

import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { REPOSITORY_ROOT } from '../commands/lib/repository.js';
import { loadCases, personaOf, type CaseVariant, type EvaluationCase } from './lib/case.js';
import { runChecks } from './lib/checks.js';
import { skillsAnnounced, uncoveredSkills } from './lib/coverage.js';
import {
  closeEnvironment,
  connectorToken,
  exportNotebook,
  freshAccount,
  openEnvironment,
  seedTree,
  snapshot,
  whoamiText,
  type Account,
  type EvaluationEnvironment,
} from './lib/environment.js';
import { leaksIn } from './lib/leaks.js';
import { openRoom, roomsRoot, runClaude } from './lib/room.js';
import { scorecard, type RunResult } from './lib/scorecard.js';
import { emptyTranscript, readTurn } from './lib/transcript.js';

const RUNS = join(dirname(fileURLToPath(import.meta.url)), 'runs');

const { values } = parseArgs({
  options: {
    environment: { type: 'string', default: 'staging' },
    models: { type: 'string', default: 'sonnet,haiku' },
    runs: { type: 'string', default: '3' },
    cases: { type: 'string' },
    'user-model': { type: 'string', default: 'sonnet' },
    'open-room': { type: 'boolean', default: false },
    'keep-accounts': { type: 'boolean', default: false },
  },
});

const say = (line: string): void => void process.stdout.write(`${line}\n`);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const catalogue = loadCases();
const wanted = values.cases?.split(',').map((id) => id.trim());
const cases = wanted ? catalogue.filter((each) => wanted.includes(each.id)) : catalogue;
const models = values.models
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const runs = Number(values.runs);

const environment = await openEnvironment(values.environment);
const browser = await chromium.launch();
const root = roomsRoot();

async function accountFor(variant: CaseVariant, left: Map<string, Account>): Promise<Account> {
  switch (variant.setup.kind) {
    case 'empty':
      return freshAccount(environment, variant.person);
    case 'tree': {
      const account = await freshAccount(environment, variant.person);
      await seedTree(environment, account, variant.setup.path);
      return account;
    }
    case 'from-case': {
      const account = left.get(`${variant.setup.case}/${variant.setup.variant}`);
      if (!account) {
        throw new Error(
          `${variant.setup.case} ${variant.setup.variant} left no account in this run.`,
        );
      }
      return account;
    }
  }
}

async function play(
  env: EvaluationEnvironment,
  evaluationCase: EvaluationCase,
  variant: CaseVariant,
  account: Account,
  model: string,
  folder: string,
): Promise<Omit<RunResult, 'caseId' | 'variant' | 'model' | 'run'>> {
  const token = await connectorToken(env, account, browser);
  const before = await snapshot(env, account);
  const persona = personaOf(evaluationCase, variant);
  const room = openRoom({ root, mcpUrl: `${env.mcp}/mcp`, token, persona });

  const transcript = emptyTranscript();
  const stream: string[] = [];
  const dialogue: string[] = [`# ${evaluationCase.id} · ${variant.id} · ${model}`, ''];
  let executor: string | null = null;
  let user: string | null = null;
  let prompt = variant.request;
  let turn = 0;
  let finalText: string | undefined;
  try {
    for (;;) {
      dialogue.push(`## ${turn === 0 ? 'Request' : 'Person'}`, '', prompt, '');
      const lines = await runClaude({
        room,
        role: 'executor',
        model,
        prompt,
        resume: executor,
        ...(values['open-room'] ? { openedAt: REPOSITORY_ROOT } : {}),
      });
      stream.push(...lines.map((line) => JSON.stringify({ turn, role: 'executor', event: line })));
      const answer = readTurn(lines, turn, transcript);
      executor = answer.sessionId ?? executor;
      finalText = answer.text;
      dialogue.push('## Executor', '', answer.text, '');
      if (!room.userPrompt || !answer.text.includes('?') || turn + 1 >= evaluationCase.turns) break;

      const replies = await runClaude({
        room,
        role: 'user',
        model: values['user-model'],
        prompt: answer.text,
        resume: user,
      });
      stream.push(...replies.map((line) => JSON.stringify({ turn, role: 'user', event: line })));
      const reply = readTurn(replies, turn, emptyTranscript());
      user = reply.sessionId ?? user;
      prompt = reply.text;
      turn += 1;
    }
  } finally {
    room.dispose();
  }

  const after = await snapshot(env, account);
  const leaks = leaksIn(transcript);
  const outcomes = runChecks(evaluationCase.checks, {
    transcript,
    before,
    after,
    finalText: finalText ?? '',
    absent: variant.absent ?? [],
    leaks,
  });

  writeFileSync(join(folder, 'transcript.jsonl'), `${stream.join('\n')}\n`);
  writeFileSync(join(folder, 'dialogue.md'), dialogue.join('\n'));
  writeFileSync(join(folder, 'before.json'), JSON.stringify(before, null, 2));
  writeFileSync(join(folder, 'after.json'), JSON.stringify(after, null, 2));
  writeFileSync(join(folder, 'checks.json'), JSON.stringify({ outcomes, leaks }, null, 2));
  const existed = new Map(
    before.map((notebook) => [notebook.notebookId, JSON.stringify(notebook)]),
  );
  for (const notebook of after) {
    if (existed.get(notebook.notebookId) === JSON.stringify(notebook)) continue;
    await exportNotebook(
      env,
      account,
      notebook.notebookId,
      join(folder, `${notebook.notebookId}.notebook`),
    );
  }

  return { outcomes, leaks, costUsd: transcript.costUsd, turns: turn + 1, error: null };
}

try {
  // Before anything is written: every skill the connector announces has a case.
  const probe = await freshAccount(environment, 'alex');
  const announced = skillsAnnounced(
    await whoamiText(environment, await connectorToken(environment, probe, browser)),
  );
  if (announced.length === 0) fail('whoami announced no skill, so the index could not be read.');
  const uncovered = uncoveredSkills(announced, catalogue);
  if (uncovered.length > 0) fail(`No case exercises ${uncovered.join(', ')}. Write one first.`);
  say(
    `${environment.name} serves ${environment.version}; skills announced: ${announced.join(', ')}.`,
  );

  const round =
    `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${environment.version}`.replace(
      /[^\w.+-]/g,
      '_',
    );
  const results: RunResult[] = [];
  for (const model of models) {
    for (let run = 1; run <= runs; run++) {
      const left = new Map<string, Account>();
      for (const evaluationCase of cases) {
        for (const variant of evaluationCase.variants) {
          const folder = join(RUNS, round, evaluationCase.id, variant.id, model, `run-${run}`);
          mkdirSync(folder, { recursive: true });
          say(`${evaluationCase.id} ${variant.id} ${model} run ${run}`);
          const identity = { caseId: evaluationCase.id, variant: variant.id, model, run };
          try {
            const account = await accountFor(variant, left);
            left.set(`${evaluationCase.id}/${variant.id}`, account);
            const played = await play(environment, evaluationCase, variant, account, model, folder);
            results.push({ ...identity, ...played });
            say(
              `  ${played.outcomes.map((each) => `${each.check}=${each.passed === null ? 'n/a' : each.passed}`).join(' ')}${played.leaks.length ? ` LEAKS: ${played.leaks.join(', ')}` : ''}`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            results.push({
              ...identity,
              outcomes: [],
              leaks: [],
              costUsd: 0,
              turns: 0,
              error: message,
            });
            writeFileSync(join(folder, 'error.txt'), message);
            say(`  failed to run: ${message}`);
          }
        }
      }
    }
  }

  const card = scorecard({
    round,
    environment: environment.name,
    version: environment.version,
    models,
    results,
  });
  mkdirSync(join(RUNS, round), { recursive: true });
  writeFileSync(join(RUNS, round, 'scorecard.md'), card);
  writeFileSync(join(RUNS, round, 'results.json'), JSON.stringify(results, null, 2));
  say(`\nThe scorecard of the round is at agent-eval/runs/${round}/scorecard.md.`);
} finally {
  await browser.close();
  if (!values['keep-accounts']) await closeEnvironment(environment);
}
