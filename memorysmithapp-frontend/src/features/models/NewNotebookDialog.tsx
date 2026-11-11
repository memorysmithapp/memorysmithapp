import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { modelAddress, notebookAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  createFromCatalog,
  createFromModel,
  createNotebook,
  declareModel,
  getCatalogModel,
  getModel,
  listModels,
  searchCatalogPage,
} from '../../shared/api/source';
import {
  PICKER_PAGE,
  SearchPicker,
  type PickerItem,
  type PickerSource,
} from '../../shared/components/SearchPicker';
import { ActionWord } from '../../shared/components/ActionWord';
import { CheckIcon, CloseIcon } from '../../shared/components/icons';
import { Modal } from '../../shared/components/Modal';
import { Segmented } from '../../shared/components/Segmented';
import {
  CreateFromModelFields,
  EMPTY_DRAFT,
  useCreateFromModel,
  type CreateDraft,
} from './CreateFromModel';
import { missingRequired } from './model-form';
import { aboutOf, AboutFields, declarationOf, type AboutDraft } from './ModelParts';
import { FieldsSkeleton } from '../../shared/components/skeletons';

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

/** Where a model comes from, as the tabs of the picker say it (#432). */
export type ModelOrigin = 'mine' | 'shared' | 'community';

/**
 * A notebook from a model (#359, #432, #435, #437): one form from the start,
 * its first field the model, chosen or not, with *Choose model*. The button
 * opens the list of models in the dialog — the person's own, the ones shared
 * with them and the community's, found by typing — where a click marks a row
 * and *Select* takes it back to the form, or *Back* returns with nothing
 * changed. The name of the new notebook and the parameters of the model follow
 * the model; Cancel and Create stay in the footer of the form, Create waiting
 * for a model and every required parameter.
 */
export function FromModel({
  onClose,
  initial = null,
}: {
  onClose: () => void;
  /** A model already chosen when it opens; none, and the form says so. */
  initial?: { origin: ModelOrigin; item: PickerItem } | null;
}) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(initial);
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState<{ origin: ModelOrigin; item: PickerItem } | null>(null);
  const [draft, setDraft] = useState<CreateDraft>(EMPTY_DRAFT);
  const creation = useCreateFromModel();
  const community = picked?.origin === 'community';
  const chosenId = picked?.item.id ?? '';
  const own = useQuery({
    queryKey: queryKeys.model(chosenId),
    queryFn: () => getModel(chosenId),
    enabled: picked !== null && !community,
  });
  const published = useQuery({
    queryKey: queryKeys.catalogModel(chosenId),
    queryFn: () => getCatalogModel(chosenId),
    enabled: picked !== null && community,
  });
  const read = community ? published : own;
  const model = picked ? (read.data ?? null) : null;
  const ready = model !== null && missingRequired(model.parameters, draft.typed).length === 0;

  function select(): void {
    if (!pending) return;
    // Another model asks other parameters: what was typed for the last one goes.
    if (pending.item.id !== picked?.item.id) {
      setPicked(pending);
      setDraft((last) => ({ ...EMPTY_DRAFT, name: last.name }));
      creation.reset();
    }
    setChoosing(false);
  }

  if (choosing) {
    return (
      <div className="new-notebook-form new-notebook-model">
        <ModelPicker
          chosen={pending?.item.id ?? null}
          onPick={(origin, item) => setPending({ origin, item })}
        />
        <div className="ask-dialog-foot">
          <button type="button" className="button is-quiet" onClick={() => setChoosing(false)}>
            {t('newNotebook.back')}
          </button>
          <button
            type="button"
            className="button is-primary"
            disabled={pending === null}
            onClick={select}
          >
            {t('newNotebook.select')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="new-notebook-form new-notebook-model"
      onSubmit={(event) => {
        event.preventDefault();
        if (!picked || !model || !ready) return;
        const id = picked.item.id;
        void creation.create(
          (input) => (community ? createFromCatalog(id, input) : createFromModel(id, input)),
          model.parameters,
          draft,
        );
      }}
    >
      <div className="field new-notebook-model-field">
        <span className="field-label">{t('newNotebook.model')}</span>
        <div className="new-notebook-chosen">
          {picked ? (
            <>
              <strong>{picked.item.name}</strong>
              {picked.item.by ? <span className="hint"> — {picked.item.by}</span> : null}
            </>
          ) : (
            <span className="hint">{t('newNotebook.noModel')}</span>
          )}
          <button
            type="button"
            className="button is-quiet is-small"
            onClick={() => {
              setPending(picked);
              setChoosing(true);
            }}
          >
            {t('newNotebook.chooseModel')}
          </button>
        </div>
        {model ? <span className="field-hint">{model.objective}</span> : null}
      </div>
      {picked && read.isPending ? (
        <FieldsSkeleton fields={2} />
      ) : picked && !model ? (
        <p className="status">{t(messageKeyOf(read.error))}</p>
      ) : (
        // The name is asked from the start; the parameters, once there is a model.
        <CreateFromModelFields
          key={picked ? `${picked.origin}-${picked.item.id}` : 'none'}
          parameters={model?.parameters ?? []}
          draft={draft}
          onChange={setDraft}
          missing={creation.missing}
        />
      )}
      {creation.failure ? (
        <p className="share-failure" role="alert">
          {creation.failure}
        </p>
      ) : null}
      <div className="ask-dialog-foot">
        <button type="button" className="button is-quiet" onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="button is-primary" disabled={creation.busy || !ready}>
          {creation.busy ? t('newNotebook.creating') : t('newNotebook.create')}
        </button>
      </div>
    </form>
  );
}

/** The picker of the model, among the person's own, the shared and the community's (#432). */
function ModelPicker({
  onPick,
  chosen,
}: {
  onPick: (origin: ModelOrigin, item: PickerItem) => void;
  /** The model marked, waiting for Select (#437). */
  chosen: string | null;
}) {
  const { t } = useTranslation();
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  if (models.isPending) return <FieldsSkeleton />;
  if (models.isError) return <p className="status">{t(messageKeyOf(models.error))}</p>;

  const itemOf = (model: (typeof models.data)[number]): PickerItem => ({
    id: model.notebookId,
    name: model.name,
    line: model.objective,
    by: model.sharedBy,
  });
  const mine = models.data.filter((model) => model.sharedBy === null).map(itemOf);
  const shared = models.data.filter((model) => model.sharedBy !== null).map(itemOf);
  const sources: Array<PickerSource<ModelOrigin>> = [
    { key: 'mine', label: t('newNotebook.origins.mine'), kind: 'local', items: mine },
    { key: 'shared', label: t('newNotebook.origins.shared'), kind: 'local', items: shared },
    {
      key: 'community',
      label: t('newNotebook.origins.community'),
      kind: 'remote',
      queryKey: ['catalog-page'],
      search: async (text, cursor) => {
        const page = await searchCatalogPage({ text, limit: PICKER_PAGE, cursor });
        return {
          items: page.models.map((model) => ({
            id: model.publicId,
            name: model.name,
            line: model.objective,
            by: model.author,
          })),
          next: page.next,
          total: page.total,
        };
      },
    },
  ];

  return (
    <SearchPicker
      label={t('newNotebook.model')}
      placeholder={t('newNotebook.searchModels')}
      sources={sources}
      // A person with no model of their own starts where there are some.
      initial={mine.length > 0 ? 'mine' : shared.length > 0 ? 'shared' : 'community'}
      onPick={onPick}
      chosen={chosen}
    />
  );
}
