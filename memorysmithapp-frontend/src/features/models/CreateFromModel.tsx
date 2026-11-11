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
import { getTransfer } from '../../shared/api/source';
import { failureOf } from '../portability/TransferParts';
import { valuesOf } from './model-form';

/** What is typed for a notebook created from a model: its name, and a text per parameter. */
export interface CreateDraft {
  readonly name: string;
  readonly typed: Readonly<Record<string, string>>;
}

export const EMPTY_DRAFT: CreateDraft = { name: '', typed: {} };

/** How the notebook is created: from a model the person reads, or from the community (#360). */
export type StartCreation = (input: {
  name: string;
  values: Record<string, ParameterValueDto>;
}) => Promise<TransferDto>;

/**
 * The fields of a notebook created from a model as it stands (#359, #431): a
 * name, the model's own filled in when it is left empty, and a field for each
 * parameter by its type, with what it is and an example. They are drawn in
 * New notebook, whose footer submits them (#435); a required one the API found
 * empty, or a value of the wrong type, is marked.
 */
export function CreateFromModelFields({
  parameters,
  draft,
  onChange,
  missing = [],
}: {
  parameters: readonly ParameterDeclarationDto[];
  draft: CreateDraft;
  onChange: (next: CreateDraft) => void;
  /** The parameters the API answered were missing. */
  missing?: readonly string[];
}) {
  const { t } = useTranslation();
  const typed = draft.typed;
  const type = (parameter: string, value: string) =>
    onChange({ ...draft, typed: { ...typed, [parameter]: value } });

  return (
    <div className="create-from-model">
      <div className="field">
        <label>
          <span className="field-label">{t('model.newName')}</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
          />
        </label>
        <span className="field-hint">{t('model.newNameHint')}</span>
      </div>
      {parameters.map((parameter) => {
        const id = `value-${parameter.name}`;
        const flagged = missing.includes(parameter.name);
        const title = `${parameter.name}${
          parameter.required ? ` (${t('model.parameterRequired').toLowerCase()})` : ''
        }`;
        return (
          <div key={parameter.name} className="field">
            {parameter.type === 'boolean' ? (
              // A box beside its name, which is the label clicked, as every box
              // of the interface is (#411).
              <label className="parameter-required">
                <input
                  id={id}
                  type="checkbox"
                  checked={(typed[parameter.name] ?? String(parameter.default ?? false)) === 'true'}
                  onChange={(event) => type(parameter.name, String(event.target.checked))}
                />
                <span>{title}</span>
              </label>
            ) : (
              <label htmlFor={id} className="field-label">
                {title}
              </label>
            )}
            {parameter.type === 'boolean' ? null : parameter.type === 'list' ? (
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
    </div>
  );
}

/**
 * Creating the notebook out of what the fields hold (#359, #431, #435): the
 * notebook is written in the background, and this follows that work to its
 * end and opens it, or says why it failed (#445). A required parameter the API found empty is named back, and the
 * reason it gives is the message shown.
 */
export function useCreateFromModel(): {
  busy: boolean;
  failure: string | null;
  missing: readonly string[];
  create: (
    start: StartCreation,
    parameters: readonly ParameterDeclarationDto[],
    draft: CreateDraft,
  ) => Promise<void>;
  reset: () => void;
} {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [missing, setMissing] = useState<readonly string[]>([]);

  async function create(
    start: StartCreation,
    parameters: readonly ParameterDeclarationDto[],
    draft: CreateDraft,
  ): Promise<void> {
    setBusy(true);
    setFailure(null);
    setMissing([]);
    try {
      const started = await start({ name: draft.name, values: valuesOf(parameters, draft.typed) });
      let transfer = started;
      // The work behind the creation is not a transfer of the person's, so
      // the dialog is where it ends: it waits for it, and says why it failed
      // (#445).
      for (let waited = 0; transfer.status === 'running' && waited < 180_000; waited += 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        transfer = await getTransfer(started.transferId);
      }
      await client.invalidateQueries({ queryKey: queryKeys.notebooks() });
      if (transfer.status === 'ready' && transfer.notebookId) {
        navigate(notebookAddress(transfer.notebookId));
        return;
      }
      setFailure(
        transfer.status === 'running'
          ? t('model.stillCreating')
          : t('model.creationFailed', {
              reason:
                failureOf(transfer, t, (key) => i18n.exists(key)) ??
                t('portability.refusal.INTERNAL'),
            }),
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

  return {
    busy,
    failure,
    missing,
    create,
    reset: () => {
      setFailure(null);
      setMissing([]);
    },
  };
}
