import type {
  ParameterDeclarationDto,
  ParameterTypeDto,
  ParameterValueDto,
} from '@memorysmithapp/contracts';

/**
 * What the forms of a notebook model need beyond the components (#353, #354,
 * #359): a parameter as the editor holds it, what is wrong with one before it
 * is sent, and the value a person typed, read as its type. Kept apart from the
 * components so each can be proved without a browser.
 */

/** A parameter as the editor holds it: the default as typed, read by its type when sent. */
export interface ParameterDraft {
  readonly name: string;
  readonly description: string;
  readonly example: string;
  readonly type: ParameterTypeDto;
  readonly required: boolean;
  /** As typed: a list is one item per line, a boolean `true` or `false`. */
  readonly defaultText: string;
}

/** The name a reference can carry (§7.14): a letter or `_`, then letters, digits, `_` and `-`. */
const NAME = /^[\p{L}_][\p{L}\p{M}\p{N}_-]*$/u;

export function emptyParameter(): ParameterDraft {
  return { name: '', description: '', example: '', type: 'text', required: true, defaultText: '' };
}

export function draftOf(parameter: ParameterDeclarationDto): ParameterDraft {
  const value = parameter.default;
  return {
    name: parameter.name,
    description: parameter.description,
    example: parameter.example,
    type: parameter.type,
    required: parameter.required,
    defaultText: Array.isArray(value) ? value.join('\n') : value === null ? '' : String(value),
  };
}

/** A value of a type, from what a person typed; null when it is not one. */
export function valueOf(type: ParameterTypeDto, typed: string): ParameterValueDto | null {
  switch (type) {
    case 'text':
      return typed;
    case 'list':
      return typed
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    case 'boolean':
      return typed === 'true' ? true : typed === 'false' ? false : null;
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(typed) ? typed : null;
  }
}

/**
 * The default of a parameter that is not required: a value of its type, or an
 * empty date, which writes nothing where it stands (#363).
 */
function defaultOf(type: ParameterTypeDto, typed: string): ParameterValueDto | null {
  if (type === 'date' && typed.trim() === '') return '';
  return valueOf(type, typed);
}

/** Why a parameter cannot be declared as it stands, as a key of the strings, or null. */
export function parameterProblem(
  draft: ParameterDraft,
  others: readonly ParameterDraft[],
): 'name' | 'duplicate' | 'default' | null {
  const name = draft.name.trim().normalize('NFC');
  if (!NAME.test(name)) return 'name';
  if (others.some((other) => other.name.trim().normalize('NFC') === name)) return 'duplicate';
  if (!draft.required && defaultOf(draft.type, draft.defaultText) === null) return 'default';
  return null;
}

/** The parameters as the API takes them, or null when one of them cannot be declared. */
export function declarationsOf(
  drafts: readonly ParameterDraft[],
): ParameterDeclarationDto[] | null {
  const declared: ParameterDeclarationDto[] = [];
  for (const [index, draft] of drafts.entries()) {
    if (parameterProblem(draft, drafts.slice(0, index)) !== null) return null;
    declared.push({
      name: draft.name.trim().normalize('NFC'),
      description: draft.description.trim(),
      example: draft.example.trim(),
      type: draft.type,
      required: draft.required,
      default: draft.required ? null : defaultOf(draft.type, draft.defaultText),
    });
  }
  return declared;
}

/**
 * The values of a creation, from what the person typed for each parameter: a
 * field left empty is not sent, so the parameter takes its default or, when
 * required, is refused by name.
 */
export function valuesOf(
  parameters: readonly ParameterDeclarationDto[],
  typed: Readonly<Record<string, string>>,
): Record<string, ParameterValueDto> {
  const values: Record<string, ParameterValueDto> = {};
  for (const parameter of parameters) {
    const raw = typed[parameter.name] ?? '';
    if (parameter.type !== 'boolean' && raw.trim().length === 0) continue;
    const value = valueOf(parameter.type, parameter.type === 'boolean' ? raw || 'false' : raw);
    if (value !== null) values[parameter.name] = value;
  }
  return values;
}
