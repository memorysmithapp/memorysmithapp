/**
 * The forms of a notebook model (#353, #359): a parameter is checked before it
 * is declared, and what a person types is read as the type of its parameter.
 */

import { describe, expect, it } from 'vitest';
import {
  declarationsOf,
  draftOf,
  emptyParameter,
  fillName,
  missingRequired,
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

describe('a date that is not required (#363)', () => {
  it('may default to nothing, and is declared with an empty default', () => {
    const draft = {
      ...draftOf({
        name: 'fim',
        description: '',
        example: '',
        type: 'date',
        required: false,
        default: '',
      }),
    };
    expect(parameterProblem(draft, [])).toBeNull();
    expect(declarationsOf([draft])?.[0]?.default).toBe('');
  });
});

describe('the required parameters left empty (#435)', () => {
  const of = (name: string, type: 'text' | 'list' | 'boolean' | 'date', required: boolean) => ({
    name,
    description: '',
    example: '',
    type,
    required,
    default: required ? null : type === 'boolean' ? false : '',
  });
  const parameters = [
    of('client', 'text', true),
    of('items', 'list', true),
    of('signed', 'boolean', true),
    of('note', 'text', false),
  ];

  it('names every required one with nothing but spaces typed, never a box', () => {
    expect(missingRequired(parameters, {})).toEqual(['client', 'items']);
    expect(missingRequired(parameters, { client: '  ', items: 'a' })).toEqual(['client']);
  });

  it('names none once each holds a value, whatever the optional ones hold', () => {
    expect(missingRequired(parameters, { client: 'Aurora', items: 'a\nb' })).toEqual([]);
  });
});

describe('the name of a notebook created from a model (#448)', () => {
  const obra = {
    name: 'obra',
    description: 'A obra',
    example: 'Residencial Aurora',
    type: 'text' as const,
    required: true,
    default: null,
  };
  const fases = {
    name: 'fases',
    description: 'As fases',
    example: 'a, b',
    type: 'list' as const,
    required: false,
    default: ['Projeto', 'Execução'],
  };

  it('fills each reference with what is typed, or the default of its parameter', () => {
    expect(fillName('Obra {{obra}}', [obra], { obra: 'Residencial Aurora' })).toBe(
      'Obra Residencial Aurora',
    );
    expect(fillName('Obra {{obra}} ({{fases}})', [obra, fases], { obra: 'Cirro' })).toBe(
      'Obra Cirro (Projeto, Execução)',
    );
  });

  it('leaves a reference with no value yet, and an escaped one, as written', () => {
    expect(fillName('Obra {{obra}}', [obra], {})).toBe('Obra {{obra}}');
    expect(fillName('Obra \\{{obra}}', [obra], { obra: 'Cirro' })).toBe('Obra \\{{obra}}');
  });
});
