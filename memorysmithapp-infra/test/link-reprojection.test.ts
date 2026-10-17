/**
 * The rebuild of the link graph is a run in AWS (#311): one listing, one
 * iteration per notebook a few dozen at once, a summary, and a verdict that
 * refuses to call a run good when an edge was lost or a notebook failed.
 *
 * These cases read the definition the stack synthesises, because what makes
 * the run survive a failing notebook — the retry, the catch that answers it as
 * failed, the choice after the summary — lives nowhere but there.
 */

import { Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { REPROJECTION_CONCURRENCY } from '../constructs/link-reprojection.js';
import { appFor, stacksOf } from './stacks.js';

interface State {
  Type: string;
  Next?: string;
  End?: boolean;
  MaxConcurrency?: number;
  ItemsPath?: string;
  ItemProcessor?: { StartAt: string; States: Record<string, State> };
  Retry?: Array<{ ErrorEquals: string[]; MaxAttempts: number }>;
  Catch?: Array<{ ErrorEquals: string[]; Next: string; ResultPath: string }>;
  Choices?: Array<{ Variable: string; BooleanEquals: boolean; Next: string }>;
  Default?: string;
  Error?: string;
  CausePath?: string;
  Parameters?: Record<string, unknown>;
}

function definitionOf(): { name: string; states: Record<string, State>; startAt: string } {
  const template = Template.fromStack(stacksOf(appFor('staging')).projections);
  const [machine] = Object.values(
    template.findResources('AWS::StepFunctions::StateMachine'),
  ) as Array<{
    Properties: { StateMachineName: string; DefinitionString: { 'Fn::Join': [string, unknown[]] } };
  }>;
  if (!machine) throw new Error('No state machine in the projections stack.');
  // The definition is a join of literals and of the ARN of the function: the
  // ARN is replaced by a placeholder, which is all these cases need of it.
  const [, parts] = machine.Properties.DefinitionString['Fn::Join'];
  const text = parts.map((part) => (typeof part === 'string' ? part : 'ARN')).join('');
  const parsed = JSON.parse(text) as { StartAt: string; States: Record<string, State> };
  return {
    name: machine.Properties.StateMachineName,
    states: parsed.States,
    startAt: parsed.StartAt,
  };
}

describe('the run that rebuilds the link graph', () => {
  const { name, states, startAt } = definitionOf();

  it('is named after its environment, which is what the command starts', () => {
    expect(name).toBe('mv-reproject-links-staging');
  });

  it('lists, maps every notebook, summarises and decides, in that order', () => {
    expect(startAt).toBe('List the live notebooks');
    expect(states['List the live notebooks']?.Next).toBe('Every notebook');
    expect(states['Every notebook']?.Next).toBe('Summarise the run');
    expect(states['Summarise the run']?.Next).toBe('Is the run good?');
  });

  it('rebuilds a few dozen notebooks at once, from the list the first step answered', () => {
    const map = states['Every notebook'];
    expect(map?.ItemsPath).toBe('$.notebooks');
    expect(map?.MaxConcurrency).toBe(REPROJECTION_CONCURRENCY);
  });

  it('retries a notebook on its own, and answers one that keeps failing as failed', () => {
    const inner = states['Every notebook']?.ItemProcessor;
    const rebuild = inner?.States[inner.StartAt];
    // After the retry every Lambda task has for a throttle of the service itself.
    const retry = rebuild?.Retry?.find((rule) => rule.ErrorEquals.includes('States.ALL'));
    expect(retry?.MaxAttempts).toBe(2);
    const caught = rebuild?.Catch?.[0];
    expect(caught?.ErrorEquals).toEqual(['States.ALL']);
    const named = inner?.States[caught?.Next ?? ''];
    expect(named?.Type).toBe('Pass');
    expect(named?.Parameters).toMatchObject({ failed: true, 'notebookId.$': '$.notebookId' });
    // The failure is an answer, so the map itself never fails on a notebook.
    expect(named?.End).toBe(true);
  });

  it('refuses to call a run good when the summary says it is not, with the summary as the cause', () => {
    const verdict = states['Is the run good?'];
    expect(verdict?.Choices?.[0]).toMatchObject({ Variable: '$.good', BooleanEquals: true });
    const refused = states[verdict?.Default ?? ''];
    expect(refused?.Type).toBe('Fail');
    expect(refused?.Error).toBe('ReprojectionNotGood');
    expect(refused?.CausePath).toBe('States.JsonToString($)');
  });
});
