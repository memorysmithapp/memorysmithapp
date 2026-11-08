import { useTranslation } from 'react-i18next';
import type { ParameterTypeDto } from '@memorysmithapp/contracts';
import type { ParameterDraft } from './model-form';

const TYPES: readonly ParameterTypeDto[] = ['text', 'list', 'boolean', 'date'];

/**
 * The fields of one parameter of a model (#354, #400): the name its `{{name}}`
 * writes, what it is, an example, its type, and whether it is required or what
 * it defaults to. It is what the modal of a parameter holds, and it says what
 * is wrong with the parameter before anything is sent.
 */
export function ParameterFields({
  draft,
  onChange,
  problem,
}: {
  draft: ParameterDraft;
  onChange: (next: ParameterDraft) => void;
  problem: 'name' | 'duplicate' | 'default' | null;
}) {
  const { t } = useTranslation();
  const set = (change: Partial<ParameterDraft>) => onChange({ ...draft, ...change });

  return (
    <div className="parameter-fields">
      <label className="field parameter-name">
        <span className="field-label">{t('model.parameterName')}</span>
        <input
          value={draft.name}
          placeholder="condominio"
          aria-invalid={problem === 'name' || problem === 'duplicate' ? true : undefined}
          onChange={(event) => set({ name: event.target.value })}
        />
      </label>
      <label className="field parameter-type">
        <span className="field-label">{t('model.parameterType')}</span>
        <select
          value={draft.type}
          onChange={(event) =>
            set({ type: event.target.value as ParameterTypeDto, defaultText: '' })
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
        <textarea
          rows={2}
          maxLength={300}
          value={draft.description}
          onChange={(event) => set({ description: event.target.value })}
        />
      </label>
      <label className="field parameter-example">
        <span className="field-label">{t('model.parameterExample')}</span>
        <input
          maxLength={200}
          value={draft.example}
          onChange={(event) => set({ example: event.target.value })}
        />
      </label>
      <label className="parameter-required">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(event) => set({ required: event.target.checked })}
        />
        <span>{t('model.parameterRequired')}</span>
      </label>
      {draft.required ? null : (
        <label className="field parameter-default">
          <span className="field-label">{t('model.parameterDefault')}</span>
          {draft.type === 'list' ? (
            <textarea
              rows={3}
              value={draft.defaultText}
              placeholder={t('model.listHint')}
              onChange={(event) => set({ defaultText: event.target.value })}
            />
          ) : draft.type === 'boolean' ? (
            <select
              value={draft.defaultText}
              onChange={(event) => set({ defaultText: event.target.value })}
            >
              <option value="">—</option>
              <option value="true">{t('note.propertyTrue')}</option>
              <option value="false">{t('note.propertyFalse')}</option>
            </select>
          ) : (
            <input
              type={draft.type === 'date' ? 'date' : 'text'}
              value={draft.defaultText}
              onChange={(event) => set({ defaultText: event.target.value })}
            />
          )}
        </label>
      )}
      {problem ? (
        <p className="field-hint is-wrong parameter-problem" role="alert">
          {t(`model.problem.${problem}`)}
        </p>
      ) : (
        <p className="field-hint parameter-written">
          {t('model.writtenAs', { reference: `{{${draft.name.trim()}}}` })}
        </p>
      )}
    </div>
  );
}
