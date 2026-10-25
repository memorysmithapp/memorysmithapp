import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  ParameterDeclarationDto,
  ParameterValueDto,
  TransferDto,
} from '@memorysmithapp/contracts';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import { notebookAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { createFromVersion, getTransfer } from '../../shared/api/source';
import { valuesOf } from './model-form';

/**
 * Creating an independent notebook from a version of a model (#359): a name,
 * the model's own filled in when it is left empty, and a field for each
 * parameter by its type, with what it is and an example. A required one left
 * empty, or a value of the wrong type, is refused before anything is written,
 * and the form says which. The notebook is written in the background, and the
 * form follows it and opens it.
 */
export function CreateFromModelForm({
  notebookId,
  version,
  parameters,
  onCancel,
  create: start = (input) => createFromVersion(notebookId, version, input),
}: {
  notebookId: string;
  version: number;
  parameters: readonly ParameterDeclarationDto[];
  onCancel?: () => void;
  /** How the notebook is created: from a model of the person's, or from the community (#360). */
  create?: (input: {
    name: string;
    values: Record<string, ParameterValueDto>;
  }) => Promise<TransferDto>;
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [missing, setMissing] = useState<readonly string[]>([]);
  const type = (parameter: string, value: string) =>
    setTyped((current) => ({ ...current, [parameter]: value }));

  async function create(): Promise<void> {
    setBusy(true);
    setFailure(null);
    setMissing([]);
    try {
      const started = await start({ name, values: valuesOf(parameters, typed) });
      let transfer = started;
      for (let waited = 0; transfer.status === 'running' && waited < 60_000; waited += 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        transfer = await getTransfer(started.transferId);
      }
      await client.invalidateQueries({ queryKey: queryKeys.notebooks() });
      if (transfer.status === 'ready' && transfer.notebookId) {
        navigate(notebookAddress(transfer.notebookId));
        return;
      }
      setFailure(
        transfer.status === 'running' ? t('model.stillCreating') : t('model.creationFailed'),
      );
    } catch (error) {
      const details =
        error instanceof ApiError
          ? (error.details as { missing?: string[] } | undefined)
          : undefined;
      setMissing(details?.missing ?? []);
      setFailure(error instanceof ApiError && details ? error.message : t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="create-from-model"
      onSubmit={(event) => {
        event.preventDefault();
        void create();
      }}
    >
      <label className="field">
        <span className="field-label">{t('model.newName')}</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
        <span className="field-hint">{t('model.newNameHint')}</span>
      </label>
      {parameters.map((parameter) => {
        const id = `value-${parameter.name}`;
        const flagged = missing.includes(parameter.name);
        return (
          <div key={parameter.name} className="field">
            <label htmlFor={id} className="field-label">
              {parameter.name}
              {parameter.required ? ` (${t('model.parameterRequired').toLowerCase()})` : ''}
            </label>
            {parameter.type === 'boolean' ? (
              <input
                id={id}
                type="checkbox"
                checked={(typed[parameter.name] ?? String(parameter.default ?? false)) === 'true'}
                onChange={(event) => type(parameter.name, String(event.target.checked))}
              />
            ) : parameter.type === 'list' ? (
              <textarea
                id={id}
                rows={3}
                value={typed[parameter.name] ?? ''}
                aria-invalid={flagged ? true : undefined}
                placeholder={t('model.listHint')}
                onChange={(event) => type(parameter.name, event.target.value)}
              />
            ) : (
              <input
                id={id}
                type={parameter.type === 'date' ? 'date' : 'text'}
                value={typed[parameter.name] ?? ''}
                aria-invalid={flagged ? true : undefined}
                placeholder={parameter.example}
                onChange={(event) => type(parameter.name, event.target.value)}
              />
            )}
            <span className="field-hint">
              {[
                parameter.description,
                parameter.example ? t('model.forExample', { example: parameter.example }) : '',
                parameter.required
                  ? ''
                  : t('model.defaultsTo', {
                      value: Array.isArray(parameter.default)
                        ? parameter.default.join(', ')
                        : String(parameter.default ?? ''),
                    }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        );
      })}
      {failure ? (
        <p className="share-failure" role="alert">
          {failure}
        </p>
      ) : null}
      <div className="ask-dialog-foot">
        {onCancel ? (
          <button type="button" className="button is-quiet" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        ) : null}
        <button type="submit" className="button is-primary" disabled={busy}>
          {busy ? t('model.creating') : t('model.create')}
        </button>
      </div>
    </form>
  );
}
