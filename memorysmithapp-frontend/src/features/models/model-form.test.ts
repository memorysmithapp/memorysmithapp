/**
 * The forms of a notebook model (#353, #359): a parameter is checked before it
 * is declared, and what a person types is read as the type of its parameter.
 */

import { describe, expect, it } from 'vitest';
import {
  declarationsOf,
  draftOf,
  emptyParameter,
  parameterProblem,
  valueOf,
  valuesOf,
} from './model-form';

describe('a parameter in the editor', () => {
  it('is refused a name a reference cannot carry, a name twice, and a default not of its type', () => {
    const draft = { ...emptyParameter(), name: 'condomínio' };
    expect(parameterProblem(draft, [])).toBeNull();
    expect(parameterProblem({ ...draft, name: '1st' }, [])).toBe('name');
    expect(parameterProblem(draft, [{ ...draft }])).toBe('duplicate');
    expect(
      parameterProblem({ ...draft, type: 'date', required: false, defaultText: 'soon' }, []),
    ).toBe('default');
  });

  it('declares each type with its default read as that type', () => {
    expect(
      declarationsOf([
        {
          ...emptyParameter(),
          name: 'blocos',
          type: 'list',
          required: false,
          defaultText: 'A\nB\n',
        },
        {
          ...emptyParameter(),
          name: 'ativo',
          type: 'boolean',
          required: false,
          defaultText: 'true',
        },
        { ...emptyParameter(), name: 'nome' },
      ]),
    ).toEqual([
      expect.objectContaining({ name: 'blocos', default: ['A', 'B'] }),
      expect.objectContaining({ name: 'ativo', default: true }),
      expect.objectContaining({ name: 'nome', required: true, default: null }),
    ]);
    expect(declarationsOf([{ ...emptyParameter(), name: '' }])).toBeNull();
  });

  it('reads back a declared default into what the editor shows', () => {
    expect(
      draftOf({
        name: 'b',
        description: '',
        example: '',
        type: 'list',
        required: false,
        default: ['A', 'B'],
      }).defaultText,
    ).toBe('A\nB');
  });
});

describe('the values of a creation', () => {
  it('sends what was typed as its type, and leaves an empty field to the default', () => {
    const parameters = [
      {
        name: 'nome',
        description: '',
        example: '',
        type: 'text' as const,
        required: true,
        default: null,
      },
      {
        name: 'zelador',
        description: '',
        example: '',
        type: 'text' as const,
        required: false,
        default: 'a definir',
      },
      {
        name: 'blocos',
        description: '',
        example: '',
        type: 'list' as const,
        required: false,
        default: [],
      },
      {
        name: 'ativo',
        description: '',
        example: '',
        type: 'boolean' as const,
        required: false,
        default: true,
      },
    ];
    expect(
      valuesOf(parameters, { nome: 'Aurora', zelador: '  ', blocos: 'A\nB', ativo: 'false' }),
    ).toEqual({
      nome: 'Aurora',
      blocos: ['A', 'B'],
      ativo: false,
    });
    expect(valueOf('date', '2026-11-01')).toBe('2026-11-01');
    expect(valueOf('date', '01/11/2026')).toBeNull();
  });
});
