/**
 * A notebook model (#344): a notebook of its author's subscription, declared
 * as a model so that other notebooks are created from it, with what it is for,
 * who it is for and the parameters a notebook created from it fills in.
 *
 * The model is the notebook itself, edited and tested like any notebook; what
 * this aggregate holds is what the notebook cannot say about itself. Its
 * versions are frozen snapshots of the notebook, kept as exports of it without
 * history (RN-PRT-009): each one counts once in the storage of the subscription,
 * as a kept export does, and a notebook created from one is a completed copy
 * that depends on nothing of the model afterwards.
 *
 * Only the owner of the subscription declares a model, because it occupies the
 * storage of the subscription, and only the owner creates its versions.
 */

import { DomainError, err, isParameterName, ok, type Result } from '@memorysmithapp/kernel';

/** The types of a parameter, the kinds of attribute of the specification (§6.3). */
export const PARAMETER_TYPES = ['text', 'list', 'boolean', 'date'] as const;
export type ParameterType = (typeof PARAMETER_TYPES)[number];

/** A value of a parameter: text and dates are strings, a list is several, a boolean one. */
export type ParameterValue = string | readonly string[] | boolean;

/**
 * A parameter, declared once by the model (§7.14 leaves it to the model): every
 * reference to it in the notes receives the same value. It is required, or it
 * has a default, which may be empty, so a notebook created from the model never
 * keeps a reference.
 */
export interface ParameterDeclaration {
  readonly name: string;
  readonly description: string;
  readonly example: string;
  readonly type: ParameterType;
  readonly required: boolean;
  /** The value of a parameter that is not required; null for one that is. */
  readonly default: ParameterValue | null;
}

export interface NotebookModel {
  readonly notebookId: string;
  /** What a notebook created from it is for, in the author's words. */
  readonly objective: string;
  readonly description: string;
  /** Who it is for. */
  readonly audience: string;
  readonly parameters: readonly ParameterDeclaration[];
  /** An optional credit, shown with the model when it is filled in, never required. */
  readonly basedOn: string | null;
  /** The owner who declared it: whose versions, kept as exports, are its. */
  readonly ownerUserId: string;
  readonly declaredAt: string;
  readonly updatedAt: string;
  /** The number the next version is created with: 1, 2, … (#353). */
  readonly nextVersion: number;
  /**
   * When its owner accepted that the model is distributed under CC0 1.0, on
   * its first distribution (#357); null while it was never distributed, when
   * it is its author's under no licence.
   */
  readonly licenceAcceptedAt: string | null;
  /** Its identifier in the community catalog while it is published, or null (#360). */
  readonly publicId: string | null;
}

/** The one licence every distribution of a model is under (#357). */
export const MODEL_LICENCE = 'CC0-1.0';

/** What a version froze of its model, beside the snapshot of the notebook. */
export interface ModelVersionMeta {
  readonly number: number;
  readonly changelog: string;
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  readonly parameters: readonly ParameterDeclaration[];
  readonly basedOn: string | null;
}

/** What the author says about a model, as they write it. */
export interface ModelDeclaration {
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  readonly parameters: readonly ParameterDeclaration[];
  readonly basedOn: string | null;
}

const LIMITS = {
  objective: 500,
  description: 500,
  audience: 300,
  basedOn: 200,
  parameterDescription: 300,
  parameterExample: 200,
  changelog: 2000,
  parameters: 50,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `value` is a value of `type`, as a default or as what a person supplied. */
export function isValueOf(type: ParameterType, value: unknown): value is ParameterValue {
  switch (type) {
    case 'text':
      return typeof value === 'string';
    case 'list':
      return Array.isArray(value) && value.every((item) => typeof item === 'string');
    case 'boolean':
      return typeof value === 'boolean';
    case 'date':
      return typeof value === 'string' && ISO_DATE.test(value) && validDate(value);
  }
}

function validDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/**
 * Whether `value` may be the default of a parameter of `type`: a value of the
 * type, or, for a date, empty — a date nobody gave writes nothing (#363).
 */
export function isDefaultOf(type: ParameterType, value: unknown): value is ParameterValue {
  return (type === 'date' && value === '') || isValueOf(type, value);
}

/**
 * What the author declared, checked: lengths, a name a reference can carry and
 * that no other parameter carries after NFC, a known type, and a default valid
 * for its type on every parameter that is not required.
 */
export function checkedDeclaration(input: ModelDeclaration): Result<ModelDeclaration, DomainError> {
  const text = (value: string, field: string, max: number): Result<string, DomainError> => {
    const trimmed = value.trim();
    return trimmed.length > max
      ? err(DomainError.validation(`${field} holds at most ${max} characters`))
      : ok(trimmed);
  };
  const objective = text(input.objective, 'The objective', LIMITS.objective);
  if (!objective.ok) return objective;
  if (objective.value.length === 0) {
    return err(DomainError.validation('A model says what it is for: write its objective'));
  }
  const description = text(input.description, 'The description', LIMITS.description);
  if (!description.ok) return description;
  const audience = text(input.audience, 'The audience', LIMITS.audience);
  if (!audience.ok) return audience;
  const basedOn = text(input.basedOn ?? '', 'The credit', LIMITS.basedOn);
  if (!basedOn.ok) return basedOn;
  if (input.parameters.length > LIMITS.parameters) {
    return err(DomainError.validation(`A model declares at most ${LIMITS.parameters} parameters`));
  }

  const seen = new Set<string>();
  const parameters: ParameterDeclaration[] = [];
  for (const parameter of input.parameters) {
    const name = parameter.name.trim().normalize('NFC');
    if (!isParameterName(name)) {
      return err(
        DomainError.validation(
          `"${parameter.name}" is not a parameter name: it starts with a letter or _, and goes on in letters, digits, _ and -`,
        ),
      );
    }
    if (seen.has(name)) {
      return err(DomainError.validation(`The parameter "${name}" is declared twice`));
    }
    seen.add(name);
    if (!PARAMETER_TYPES.includes(parameter.type)) {
      return err(DomainError.validation(`"${parameter.type}" is not a type of parameter`));
    }
    const said = text(
      parameter.description,
      'A description of a parameter',
      LIMITS.parameterDescription,
    );
    if (!said.ok) return said;
    const example = text(parameter.example, 'An example of a parameter', LIMITS.parameterExample);
    if (!example.ok) return example;
    if (!parameter.required && !isDefaultOf(parameter.type, parameter.default)) {
      return err(
        DomainError.validation(
          `The parameter "${name}" is not required, so it takes a default of type ${parameter.type}`,
        ),
      );
    }
    parameters.push({
      name,
      description: said.value,
      example: example.value,
      type: parameter.type,
      required: parameter.required,
      default: parameter.required ? null : parameter.default,
    });
  }

  return ok({
    objective: objective.value,
    description: description.value,
    audience: audience.value,
    parameters,
    basedOn: basedOn.value.length > 0 ? basedOn.value : null,
  });
}

/** The changelog of a version, trimmed and bounded. */
export function checkedChangelog(changelog: string): Result<string, DomainError> {
  const trimmed = changelog.trim();
  return trimmed.length > LIMITS.changelog
    ? err(DomainError.validation(`A changelog holds at most ${LIMITS.changelog} characters`))
    : ok(trimmed);
}

/**
 * The key prefix the versions of models are kept under, apart from every other
 * export, so a reader of versions can be granted them and nothing else (#356).
 * The key names no notebook, as no key of the bucket does (INV-04).
 */
export function modelVersionPrefixOf(subscriptionId: string): string {
  return `s/${subscriptionId}/models/`;
}

export interface ModelStore {
  get(notebookId: string): Promise<NotebookModel | null>;
  /** Every model of the subscription. */
  list(): Promise<NotebookModel[]>;
  put(model: NotebookModel): Promise<void>;
  /**
   * Takes the next number, once: two versions created at once never share one.
   * Answers the number taken, or null when the model is gone.
   */
  takeVersionNumber(notebookId: string): Promise<number | null>;
  remove(notebookId: string): Promise<void>;
}
