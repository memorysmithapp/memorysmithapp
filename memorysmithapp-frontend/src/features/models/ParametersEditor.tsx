import { useTranslation } from 'react-i18next';
import type { ParameterTypeDto } from '@memorysmithapp/contracts';
import { emptyParameter, parameterProblem, type ParameterDraft } from './model-form';

const TYPES: readonly ParameterTypeDto[] = ['text', 'list', 'boolean', 'date'];

/**
 * The parameters of a model (#354): each value a notebook created from it fills
 * in, by the name its `{{name}}` writes, declared once with what it is, an
 * example, its type, and whether it is required or what it defaults to. A row
 * says what is wrong with it before anything is sent.
 */
export function ParametersEditor({
  parameters,
  onChange,
}: {
  parameters: readonly ParameterDraft[];
  onChange: (next: ParameterDraft[]) => void;
}) {
  const { t } = useTranslation();
  const set = (index: number, change: Partial<ParameterDraft>) =>
    onChange(parameters.map((each, at) => (at === index ? { ...each, ...change } : each)));

  return (
    <div className="parameters-editor">
      {parameters.length === 0 ? <p className="hint">{t('model.noParameters')}</p> : null}
      {parameters.map((parameter, index) => {
        const problem = parameterProblem(parameter, parameters.slice(0, index));
        const id = `parameter-${index}`;
        return (
          <fieldset key={index} className="parameter-row" aria-labelledby={`${id}-legend`}>
            <legend id={`${id}-legend`} className="visually-hidden">
              {t('model.parameterLegend', { name: parameter.name || index + 1 })}
            </legend>
            <label className="field parameter-name">
              <span className="field-label">{t('model.parameterName')}</span>
              <input
                value={parameter.name}
                placeholder="condominio"
                aria-invalid={problem === 'name' || problem === 'duplicate' ? true : undefined}
                onChange={(event) => set(index, { name: event.target.value })}
              />
            </label>
            <label className="field parameter-type">
              <span className="field-label">{t('model.parameterType')}</span>
              <select
                value={parameter.type}
                onChange={(event) =>
                  set(index, { type: event.target.value as ParameterTypeDto, defaultText: '' })
                }
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`model.type.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field parameter-description">
              <span className="field-label">{t('model.parameterDescription')}</span>
              <input
                value={parameter.description}
                onChange={(event) => set(index, { description: event.target.value })}
              />
            </label>
            <label className="field parameter-example">
              <span className="field-label">{t('model.parameterExample')}</span>
              <input
                value={parameter.example}
                onChange={(event) => set(index, { example: event.target.value })}
              />
            </label>
            <label className="parameter-required">
              <input
                type="checkbox"
                checked={parameter.required}
                onChange={(event) => set(index, { required: event.target.checked })}
              />
              <span>{t('model.parameterRequired')}</span>
            </label>
            {parameter.required ? null : (
              <label className="field parameter-default">
                <span className="field-label">{t('model.parameterDefault')}</span>
                {parameter.type === 'list' ? (
                  <textarea
                    rows={3}
                    value={parameter.defaultText}
                    placeholder={t('model.listHint')}
                    onChange={(event) => set(index, { defaultText: event.target.value })}
                  />
                ) : parameter.type === 'boolean' ? (
                  <select
                    value={parameter.defaultText}
                    onChange={(event) => set(index, { defaultText: event.target.value })}
                  >
                    <option value="">—</option>
                    <option value="true">{t('note.propertyTrue')}</option>
                    <option value="false">{t('note.propertyFalse')}</option>
                  </select>
                ) : (
                  <input
                    type={parameter.type === 'date' ? 'date' : 'text'}
                    value={parameter.defaultText}
                    onChange={(event) => set(index, { defaultText: event.target.value })}
                  />
                )}
              </label>
            )}
            <button
              type="button"
              className="button is-quiet is-small parameter-remove"
              onClick={() => onChange(parameters.filter((_unused, at) => at !== index))}
            >
              {t('model.removeParameter')}
            </button>
            {problem ? (
              <p className="field-hint is-wrong parameter-problem" role="alert">
                {t(`model.problem.${problem}`)}
              </p>
            ) : (
              <p className="field-hint parameter-written">
                {t('model.writtenAs', { reference: `{{${parameter.name.trim()}}}` })}
              </p>
            )}
          </fieldset>
        );
      })}
      <button
        type="button"
        className="button is-quiet"
        onClick={() => onChange([...parameters, emptyParameter()])}
      >
        {t('model.addParameter')}
      </button>
    </div>
  );
}
