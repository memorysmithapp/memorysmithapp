/**
 * Filling in the parameters of a model (#354): what a person must supply,
 * each type written in the form of its place, and nothing a value carries
 * turning into notation.
 */

import { describe, expect, it } from 'vitest';
import type { ParameterDeclaration } from '../src/domain/NotebookModel.js';
import {
  fillMarkdown,
  fillText,
  referenceReport,
  resolveValues,
  type FilledValues,
} from '../src/domain/ParameterFilling.js';
import type { NotebookDocument } from '../src/domain/NotebookDocumentBuilder.js';

const declared: ParameterDeclaration[] = [
  { name: 'condomínio', description: '', example: '', type: 'text', required: true, default: null },
  {
    name: 'síndico',
    description: '',
    example: '',
    type: 'text',
    required: false,
    default: 'a definir',
  },
  { name: 'blocos', description: '', example: '', type: 'list', required: false, default: [] },
  { name: 'ativo', description: '', example: '', type: 'boolean', required: false, default: true },
  { name: 'início', description: '', example: '', type: 'date', required: true, default: null },
];

function values(supplied: Record<string, unknown>): FilledValues {
  const resolved = resolveValues(declared, supplied);
  if (!resolved.ok) throw new Error(resolved.error.message);
  return resolved.value;
}

describe('the values of a creation', () => {
  it('refuses what is required and not given, and what is not of its type, naming each', () => {
    const refused = resolveValues(declared, { início: 'tomorrow', blocos: 'A' });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.details).toMatchObject({
      missing: ['condomínio'],
      invalid: ['blocos (list)', 'início (date)'],
    });
  });

  it('takes the default of what is not required, and accepts the names in another NFC form', () => {
    const filled = values({ ['condomínio'.normalize('NFD')]: 'Aurora', início: '2026-11-01' });
    expect(filled.get('síndico')?.value).toBe('a definir');
    expect(filled.get('condomínio')?.value).toBe('Aurora');
  });
});

describe('a note filled in', () => {
  const filled = values({
    condomínio: 'Residencial *Aurora* [[x]] {{y}}',
    blocos: ['A', 'B'],
    início: '2026-11-01',
    ativo: false,
  });

  it('writes each type in the form of its place, and escapes what would be notation', () => {
    const note = [
      '---',
      'name: "Ata de {{condomínio}}"',
      'blocos: "{{blocos}}"',
      'ativo: {{ativo}}',
      'inicio: "{{início}}"',
      'tags: ["{{síndico}}", obra]',
      '---',
      '# Assembleia de {{condomínio}}',
      '',
      'Presidida por [[{{síndico}}]]; blocos {{blocos}}; desde {{início}}.',
      '',
      '`{{condomínio}}` fica como está.',
    ].join('\n');
    const out = fillMarkdown(note, filled);
    expect(out).toContain('name: "Ata de Residencial *Aurora* [[x]] {{y}}"');
    expect(out).toContain('blocos: ["A", "B"]');
    expect(out).toContain('ativo: false');
    expect(out).toContain('inicio: 2026-11-01');
    expect(out).toContain('tags: ["a definir", obra]');
    expect(out).toContain('# Assembleia de Residencial \\*Aurora\\* \\[\\[x\\]\\] \\{\\{y\\}\\}');
    expect(out).toContain('Presidida por [[a definir]]; blocos A, B; desde 2026-11-01.');
    expect(out).toContain('`{{condomínio}}` fica como está.');
  });

  it('writes a name or a description as typed', () => {
    expect(
      fillText('Condomínio {{condomínio}}', values({ condomínio: 'Aurora', início: '2026-11-01' })),
    ).toBe('Condomínio Aurora');
  });
});

describe('what a version writes against what its model declares', () => {
  it('names the references nobody declared and the declarations nothing uses', () => {
    const document = {
      documentVersion: '1.2',
      exportedAt: '2026-10-25T00:00:00.000Z',
      notebook: {
        name: 'Condomínio {{condomínio}}',
        description: '',
        guidance: 'Para {{cliente}}.',
      },
      folders: [],
      notes: [],
    } as unknown as NotebookDocument;
    expect(referenceReport(document, declared)).toEqual({
      undeclared: ['cliente'],
      unused: ['ativo', 'blocos', 'início', 'síndico'],
    });
  });
});
