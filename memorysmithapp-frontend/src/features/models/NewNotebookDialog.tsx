import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { communityAddress, modelAddress, notebookAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  createNotebook,
  declareModel,
  getModel,
  getModelVersion,
  listModels,
} from '../../shared/api/source';
import { ActionWord } from '../../shared/components/ActionWord';
import { CheckIcon, CloseIcon } from '../../shared/components/icons';
import { Modal } from '../../shared/components/Modal';
import { Segmented } from '../../shared/components/Segmented';
import { CreateFromModelForm } from './CreateFromModel';
import { aboutOf, AboutFields, declarationOf, type AboutDraft } from './ModelParts';

/**
 * A new notebook from Home (#359): blank, with a name and a line saying what it
 * is for, or created from a model the person may use, its parameters asked for
 * before the notebook is written.
 */
export function NewNotebookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'blank' | 'model'>('blank');
  if (!open) return null;
  return (
    <Modal open title={t('newNotebook.title')} onClose={onClose} className="new-notebook">
      <Segmented
        label={t('newNotebook.kind')}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'blank', label: t('newNotebook.blank') },
          { value: 'model', label: t('newNotebook.fromModel') },
        ]}
      />
      {kind === 'blank' ? <BlankNotebook onClose={onClose} /> : <FromModel onClose={onClose} />}
    </Modal>
  );
}

/**
 * A new notebook model from Home (#373): a notebook, and what it says of itself
 * in the same step. Only the essentials are asked here (#400): its name and the
 * texts of *About the model*. Its parameters are declared afterwards, in the tab
 * of the page of the model this opens once it is created, since one only means
 * something once a text uses it, and a modal of a parameter would open inside
 * this one. Turning a notebook that exists into a model is not here: that is
 * reading and rewriting it, which an agent does with the skill `derive-model`.
 */
export function NewModelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [about, setAbout] = useState<AboutDraft>(() => aboutOf(null));
  const [plain, setPlain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Kept across a failed declaration, so trying again does not make a second notebook.
  const created = useRef<string | null>(null);
  if (!open) return null;

  async function declare(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      created.current ??= (
        await createNotebook({ name: name.trim(), description: about.description })
      ).id;
      await client.invalidateQueries({ queryKey: queryKeys.notebooks() });
      try {
        await declareModel(created.current, declarationOf(about, []));
      } catch (error) {
        setPlain(true);
        throw error;
      }
      void client.invalidateQueries({ queryKey: queryKeys.models() });
      onClose();
      navigate(`${modelAddress(created.current)}?tab=parameters`);
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={t('newNotebook.modelTitle')} onClose={onClose} className="new-notebook">
      <form
        className="model-form new-notebook-model"
        onSubmit={(event) => {
          event.preventDefault();
          void declare();
        }}
      >
        <label className="field">
          <span className="field-label">{t('newNotebook.name')}</span>
          <input
            value={name}
            required
            disabled={plain}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p className="hint">
          {t('model.declareHint', { reference: `{{${t('model.referenceExample')}}}` })}
        </p>
        <AboutFields value={about} onChange={setAbout} />
        <p className="hint">{t('newNotebook.parametersAfter')}</p>
        {plain ? (
          <p className="share-failure" role="alert">
            {t('newNotebook.notDeclared')}
          </p>
        ) : failure ? (
          <p className="share-failure" role="alert">
            {failure}
          </p>
        ) : null}
        <div className="ask-dialog-foot">
          <button type="button" className="button is-quiet" onClick={onClose}>
            <ActionWord icon={<CloseIcon />} word={t('common.cancel')} wide />
          </button>
          <button
            type="submit"
            className="button is-primary"
            disabled={busy || !name.trim() || !about.objective.trim()}
          >
            <ActionWord
              icon={<CheckIcon />}
              word={busy ? t('model.saving') : t('model.declare')}
              wide
            />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BlankNotebook({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const created = await createNotebook({ name: name.trim(), description: description.trim() });
      await client.invalidateQueries({ queryKey: queryKeys.notebooks() });
      navigate(notebookAddress(created.id));
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      setBusy(false);
    }
  }

  return (
    <form className="new-notebook-form" onSubmit={(event) => void submit(event)}>
      <label className="field">
        <span className="field-label">{t('newNotebook.name')}</span>
        <input value={name} required onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t('newNotebook.description')}</span>
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {failure ? (
        <p className="share-failure" role="alert">
          {failure}
        </p>
      ) : null}
      <div className="ask-dialog-foot">
        <button type="button" className="button is-quiet" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="button is-primary" disabled={busy || !name.trim()}>
          {busy ? t('newNotebook.creating') : t('newNotebook.create')}
        </button>
      </div>
    </form>
  );
}

function FromModel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const [chosen, setChosen] = useState<string | null>(null);
  const model = useQuery({
    queryKey: queryKeys.model(chosen ?? ''),
    queryFn: () => getModel(chosen ?? ''),
    enabled: chosen !== null,
  });
  const latest = model.data?.versions.find((each) => each.status === 'ready');
  // The parameters a notebook is created with are the ones the version froze.
  const version = useQuery({
    queryKey: queryKeys.modelVersion(chosen ?? '', latest?.number ?? 0),
    queryFn: () => getModelVersion(chosen ?? '', latest?.number ?? 0),
    enabled: chosen !== null && latest !== undefined,
  });

  if (models.isPending) return <p className="hint">{t('common.loading')}</p>;
  if (models.isError) return <p className="status">{t(messageKeyOf(models.error))}</p>;
  // Beside the models the person may use, the ones others published (#360).
  const community = (
    <p className="hint">
      <Link to={communityAddress()} onClick={onClose}>
        {t('newNotebook.community')}
      </Link>
    </p>
  );
  if (models.data.length === 0) {
    return (
      <>
        <p className="hint">{t('newNotebook.noModels')}</p>
        {community}
      </>
    );
  }

  return (
    <div className="new-notebook-model">
      {community}
      <label className="field">
        <span className="field-label">{t('newNotebook.model')}</span>
        <select value={chosen ?? ''} onChange={(event) => setChosen(event.target.value || null)}>
          <option value="">—</option>
          {models.data.map((each) => (
            <option key={each.notebookId} value={each.notebookId}>
              {each.name}
            </option>
          ))}
        </select>
      </label>
      {chosen && model.data ? (
        <>
          <p className="hint">{model.data.objective}</p>
          {latest && version.data ? (
            <>
              <p className="hint">
                {t('newNotebook.fromVersion', {
                  number: latest.number,
                  changelog: latest.changelog,
                })}
              </p>
              <CreateFromModelForm
                notebookId={chosen}
                version={latest.number}
                parameters={version.data.parameters}
                onCancel={onClose}
              />
            </>
          ) : latest ? (
            <p className="hint">{t('common.loading')}</p>
          ) : (
            <p className="hint">{t('newNotebook.noVersion')}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
