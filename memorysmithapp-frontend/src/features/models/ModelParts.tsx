import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotebookModelDto } from '@memorysmithapp/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { declareModel } from '../../shared/api/source';
import { Modal } from '../../shared/components/Modal';
import { Tabs } from '../../shared/components/Tabs';
import {
  declarationsOf,
  draftOf,
  emptyParameter,
  parameterProblem,
  type ParameterDraft,
} from './model-form';
import { ParameterFields } from './ParametersEditor';
import { ActionWord } from '../../shared/components/ActionWord';
import {
  CheckIcon,
  CloseIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../../shared/components/icons';

/**
 * The parts of a model, one tab each (#400): what it holds as it stands, and
 * its history (#431). What it holds is read where its notebook cannot be
 * opened, by a model reader; the page of one's own model leaves it out, since
 * whoever reads the notebook reads it by navigating it (#435).
 */
export const MODEL_TABS = ['about', 'parameters', 'contents', 'history', 'community'] as const;
export type ModelTab = (typeof MODEL_TABS)[number];

/**
 * The tabs of the page of one's own model, which has neither Contents (#435)
 * nor History (#446): its notebook is opened, and its overview shows both.
 */
export const OWN_MODEL_TABS: readonly ModelTab[] = MODEL_TABS.filter(
  (tab) => tab !== 'contents' && tab !== 'history',
);

export function isModelTab(
  value: string | null,
  tabs: readonly ModelTab[] = MODEL_TABS,
): value is ModelTab {
  return value !== null && (tabs as readonly string[]).includes(value);
}

/** The strip of the tabs of a model; the community is the owner's, and a reader sees it closed. */
export function ModelTabs({
  model,
  owner,
  contents,
  active,
  onSelect,
}: {
  model: NotebookModelDto;
  owner: boolean;
  /**
   * Whether it is read where its notebook cannot be opened, by a model reader:
   * only there are what it holds and its history tabs (#435, #446).
   */
  contents: boolean;
  active: ModelTab;
  onSelect: (tab: ModelTab) => void;
}) {
  const { t } = useTranslation();
  return (
    <Tabs
      id="model"
      label={t('model.title')}
      className="model-tabs"
      active={active}
      onSelect={onSelect}
      tabs={[
        { key: 'about', label: t('model.tabs.about') },
        { key: 'parameters', label: t('model.tabs.parameters'), total: model.parameters.length },
        ...(contents
          ? [
              { key: 'contents' as const, label: t('model.tabs.contents') },
              { key: 'history' as const, label: t('model.tabs.history') },
            ]
          : []),
        { key: 'community', label: t('model.tabs.community'), disabled: !owner },
      ]}
    />
  );
}

/** What a model says of itself, as it is typed. */
export interface AboutDraft {
  readonly objective: string;
  readonly description: string;
  readonly audience: string;
  readonly basedOn: string;
}

export function aboutOf(model: NotebookModelDto | null): AboutDraft {
  return {
    objective: model?.objective ?? '',
    description: model?.description ?? '',
    audience: model?.audience ?? '',
    basedOn: model?.basedOn ?? '',
  };
}

/** The limits the API holds each text to, and how many lines each one opens at. */
const ABOUT_FIELDS = [
  { key: 'objective', max: 500, rows: 4, required: true, hint: 'model.objectiveHint' },
  { key: 'description', max: 500, rows: 4, required: false, hint: null },
  { key: 'audience', max: 300, rows: 3, required: false, hint: null },
  { key: 'basedOn', max: 200, rows: 2, required: false, hint: 'model.basedOnHint' },
] as const;

/**
 * A text of several lines, shown whole (#400): it opens at `rows` lines and
 * grows with what it holds, so nothing of it hides behind a scroll of its own.
 */
function GrowingText({
  label,
  hint,
  value,
  onChange,
  rows,
  max,
  required,
}: {
  label: string;
  hint: string | null;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  max: number;
  required: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight + (node.offsetHeight - node.clientHeight)}px`;
  }, [value]);
  return (
    <div className="field">
      <label>
        <span className="field-label">{label}</span>
        <textarea
          ref={box}
          className="growing-text"
          rows={rows}
          maxLength={max}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <span className="field-foot">
        {hint ? <span className="field-hint">{hint}</span> : <span />}
        <span className="field-count">
          {value.length}/{max}
        </span>
      </span>
    </div>
  );
}

/** The four texts of what a model says of itself (#400), on its page and in the dialog of a new one. */
export function AboutFields({
  value,
  onChange,
}: {
  value: AboutDraft;
  onChange: (next: AboutDraft) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      {ABOUT_FIELDS.map((field) => (
        <GrowingText
          key={field.key}
          label={t(`model.${field.key}`)}
          hint={field.hint ? t(field.hint) : null}
          value={value[field.key]}
          onChange={(text) => onChange({ ...value, [field.key]: text })}
          rows={field.rows}
          max={field.max}
          required={field.required}
        />
      ))}
    </>
  );
}

/** The declaration the API takes, out of what is typed and the parameters it keeps. */
export function declarationOf(
  about: AboutDraft,
  parameters: NotebookModelDto['parameters'],
): Parameters<typeof declareModel>[1] {
  return {
    objective: about.objective,
    description: about.description,
    audience: about.audience,
    basedOn: about.basedOn.trim() ? about.basedOn : null,
    parameters,
  };
}

/** The tab *About the model*: its texts, saved by their own button, the parameters untouched. */
export function ModelAbout({
  notebookId,
  model,
  onSaved,
}: {
  notebookId: string;
  model: NotebookModelDto;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [about, setAbout] = useState<AboutDraft>(() => aboutOf(model));
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setSaid(null);
    try {
      await declareModel(notebookId, declarationOf(about, model.parameters));
      setSaid(t('model.saved'));
      onSaved();
    } catch (error) {
      setSaid(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="model-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <AboutFields
        value={about}
        onChange={(next) => {
          setAbout(next);
          setSaid(null);
        }}
      />
      <div className="model-form-actions">
        <button
          type="submit"
          className="button is-primary"
          disabled={busy || about.objective.trim().length === 0}
        >
          <ActionWord icon={<CheckIcon />} word={busy ? t('model.saving') : t('model.save')} wide />
        </button>
        {said ? (
          <span className="hint" role="status">
            {said}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** What a reader of the model reads in *About the model*. */
export function ModelAboutSummary({ model }: { model: NotebookModelDto }) {
  const { t } = useTranslation();
  const lines: Array<[string, string | null]> = [
    ['objective', model.objective],
    ['description', model.description],
    ['audience', model.audience],
    ['basedOn', model.basedOn],
  ];
  return (
    <dl className="model-summary">
      {lines
        .filter(([, text]) => text)
        .map(([key, text]) => (
          <div key={key}>
            <dt>{t(`model.${key}`)}</dt>
            <dd>{text}</dd>
          </div>
        ))}
    </dl>
  );
}

/** What a parameter defaults to, as its line says it. */
function requirementOf(
  parameter: NotebookModelDto['parameters'][number],
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  if (parameter.required) return t('model.parameterRequired');
  const value = Array.isArray(parameter.default)
    ? parameter.default.join(', ')
    : typeof parameter.default === 'boolean'
      ? t(parameter.default ? 'note.propertyTrue' : 'note.propertyFalse')
      : String(parameter.default ?? '');
  return value ? t('model.defaultsTo', { value }) : t('model.defaultsToNothing');
}

/**
 * The tab *Parameters* (#400): one line each, and a modal to add, edit and
 * remove one, which writes the model when it is confirmed.
 */
export function ModelParameters({
  notebookId,
  model,
  onSaved,
}: {
  notebookId: string;
  model: NotebookModelDto;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const drafts = model.parameters.map(draftOf);
  const [editing, setEditing] = useState<{ index: number | null; draft: ParameterDraft } | null>(
    null,
  );
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function write(next: ParameterDraft[]): Promise<boolean> {
    const declared = declarationsOf(next);
    if (!declared) return false;
    setBusy(true);
    setFailure(null);
    try {
      await declareModel(notebookId, declarationOf(aboutOf(model), declared));
      onSaved();
      return true;
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const problem = editing
    ? parameterProblem(
        editing.draft,
        drafts.filter((_each, at) => at !== editing.index),
      )
    : null;
  const removed = removing === null ? null : model.parameters[removing];

  return (
    <section className="model-parameters">
      <div className="model-parameters-head">
        <p className="hint">{t('model.parametersHint')}</p>
        <button
          type="button"
          className="button is-quiet"
          onClick={() => {
            setFailure(null);
            setEditing({ index: null, draft: emptyParameter() });
          }}
        >
          <ActionWord icon={<PlusIcon />} word={t('model.addParameter')} wide />
        </button>
      </div>
      {model.parameters.length === 0 ? (
        <p className="hint">{t('model.noParameters')}</p>
      ) : (
        <ul className="parameter-lines">
          {model.parameters.map((parameter, index) => (
            <li key={parameter.name} className="parameter-line">
              <span className="parameter-line-name">
                <code>{`{{${parameter.name}}}`}</code>
                {parameter.description ? (
                  <span className="hint">{parameter.description}</span>
                ) : null}
              </span>
              <span className="parameter-line-type">{t(`model.type.${parameter.type}`)}</span>
              <span className="parameter-line-requirement">{requirementOf(parameter, t)}</span>
              <span className="parameter-line-actions">
                <button
                  type="button"
                  className="button is-quiet is-small"
                  aria-label={t('model.editParameterOf', { name: parameter.name })}
                  onClick={() => {
                    setFailure(null);
                    setEditing({ index, draft: draftOf(parameter) });
                  }}
                >
                  <ActionWord icon={<PencilIcon />} word={t('model.editParameter')} />
                </button>
                <button
                  type="button"
                  className="button is-quiet is-small"
                  aria-label={t('model.removeParameterOf', { name: parameter.name })}
                  onClick={() => {
                    setFailure(null);
                    setRemoving(index);
                  }}
                >
                  <ActionWord icon={<TrashIcon />} word={t('model.removeParameter')} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {failure && !editing && removing === null ? (
        <p className="share-failure" role="alert">
          {failure}
        </p>
      ) : null}

      {editing ? (
        <Modal
          open
          title={
            editing.index === null ? t('model.addParameterTitle') : t('model.editParameterTitle')
          }
          onClose={() => setEditing(null)}
          className="parameter-modal"
          actions={
            <>
              <button type="button" className="button is-quiet" onClick={() => setEditing(null)}>
                <ActionWord icon={<CloseIcon />} word={t('common.cancel')} wide />
              </button>
              <button
                type="button"
                className="button is-primary"
                disabled={busy || problem !== null}
                onClick={() => {
                  const next =
                    editing.index === null
                      ? [...drafts, editing.draft]
                      : drafts.map((each, at) => (at === editing.index ? editing.draft : each));
                  void write(next).then((done) => {
                    if (done) setEditing(null);
                  });
                }}
              >
                <ActionWord
                  icon={<CheckIcon />}
                  word={busy ? t('model.saving') : t('model.save')}
                  wide
                />
              </button>
            </>
          }
        >
          <ParameterFields
            draft={editing.draft}
            onChange={(draft) => setEditing({ ...editing, draft })}
            problem={problem}
          />
          {failure ? (
            <p className="share-failure" role="alert">
              {failure}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {removed ? (
        <Modal
          open
          title={t('model.removeParameterTitle', { name: removed.name })}
          onClose={() => setRemoving(null)}
          actions={
            <>
              <button type="button" className="button is-quiet" onClick={() => setRemoving(null)}>
                <ActionWord icon={<CloseIcon />} word={t('common.cancel')} wide />
              </button>
              <button
                type="button"
                className="button is-danger"
                disabled={busy}
                onClick={() => {
                  void write(drafts.filter((_each, at) => at !== removing)).then((done) => {
                    if (done) setRemoving(null);
                  });
                }}
              >
                <ActionWord
                  icon={<TrashIcon />}
                  word={busy ? t('model.saving') : t('model.removeParameter')}
                  wide
                />
              </button>
            </>
          }
        >
          <p>{t('model.removeParameterBody', { reference: `{{${removed.name}}}` })}</p>
          {failure ? (
            <p className="share-failure" role="alert">
              {failure}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </section>
  );
}
