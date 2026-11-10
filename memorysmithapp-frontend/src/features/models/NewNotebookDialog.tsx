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
  SearchPicker,
  type PickerItem,
  type PickerSource,
} from '../../shared/components/SearchPicker';
import { ActionWord } from '../../shared/components/ActionWord';
import { CheckIcon, CloseIcon } from '../../shared/components/icons';
import { Modal } from '../../shared/components/Modal';
import { Segmented } from '../../shared/components/Segmented';
import { CreateFromModelForm } from './CreateFromModel';
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
type ModelOrigin = 'mine' | 'shared' | 'community';

/** How many community models one page of the picker brings (#432). */
const COMMUNITY_PAGE = 20;

/**
 * A notebook from a model (#359, #432): the model is found in one picker, the
 * person's own models, the ones shared with them and the community's, by
 * typing part of what it is called or is for, and created from in this dialog
 * whichever it is.
 */
function FromModel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const models = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const [picked, setPicked] = useState<{ origin: ModelOrigin; item: PickerItem } | null>(null);

  if (picked) {
    return <ChosenModel {...picked} onBack={() => setPicked(null)} onClose={onClose} />;
  }
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
        const page = await searchCatalogPage({ text, limit: COMMUNITY_PAGE, cursor });
        return {
          items: page.models.map((model) => ({
            id: model.publicId,
            name: model.name,
            line: model.objective,
            by: model.author,
          })),
          next: page.next,
        };
      },
    },
  ];

  return (
    <div className="new-notebook-model">
      <SearchPicker
        label={t('newNotebook.model')}
        placeholder={t('newNotebook.searchModels')}
        sources={sources}
        // A person with no model of their own starts where there are some.
        initial={mine.length > 0 ? 'mine' : shared.length > 0 ? 'shared' : 'community'}
        onPick={(origin, item) => setPicked({ origin, item })}
      />
    </div>
  );
}

/**
 * The model picked, and the notebook created from it: the parameters it
 * declares now, read from the model itself or from the community (#431).
 */
function ChosenModel({
  origin,
  item,
  onBack,
  onClose,
}: {
  origin: ModelOrigin;
  item: PickerItem;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const community = origin === 'community';
  const own = useQuery({
    queryKey: queryKeys.model(item.id),
    queryFn: () => getModel(item.id),
    enabled: !community,
  });
  const published = useQuery({
    queryKey: queryKeys.catalogModel(item.id),
    queryFn: () => getCatalogModel(item.id),
    enabled: community,
  });
  const read = community ? published : own;
  const model = read.data ?? null;

  return (
    <div className="new-notebook-model">
      <div className="new-notebook-chosen">
        <strong>{item.name}</strong>
        {item.by ? <span className="hint"> — {item.by}</span> : null}
        <button type="button" className="button is-quiet is-small" onClick={onBack}>
          {t('newNotebook.chooseAnother')}
        </button>
      </div>
      {read.isPending ? (
        <FieldsSkeleton fields={2} />
      ) : !model ? (
        <p className="status">{t(messageKeyOf(read.error))}</p>
      ) : (
        <>
          <p className="hint">{model.objective}</p>
          <CreateFromModelForm
            key={`${origin}-${item.id}`}
            parameters={model.parameters}
            onCancel={onClose}
            create={(input) =>
              community ? createFromCatalog(item.id, input) : createFromModel(item.id, input)
            }
          />
        </>
      )}
    </div>
  );
}
