import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ModelVersionDto, NotebookModelDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import {
  communityModelAddress,
  modelVersionAddress,
  sharedModelVersionAddress,
} from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  createModelVersion,
  declareModel,
  deleteModelVersion,
  getModel,
  publishModel,
  withdrawModel,
} from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar, contextCrumbs, type Crumb } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { declarationsOf, draftOf, type ParameterDraft } from './model-form';
import { ParametersEditor } from './ParametersEditor';

/**
 * The model of a notebook (#353): what a notebook declared as a model says of
 * itself — what it is for, who it is for, its parameters, an optional credit —
 * and its versions. The owner of the subscription declares it, says it again
 * and creates and deletes its versions; whoever reads the notebook reads its
 * model. A version is a frozen snapshot, read whole before it is shared.
 */
export function ModelPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const owner = structure.permissions.administer;
  const client = useQueryClient();
  useDocumentTitle(t('model.title'), structure.notebook.name);

  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
    // A version being built is followed until it ends.
    refetchInterval: (query) =>
      query.state.data?.versions.some((each) => each.status === 'running') ? 2000 : false,
  });

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('model.title'))} />
      <article className="content-pane model-page">
        <p className="page-intro">{t('model.intro')}</p>
        {model.isPending ? (
          <p className="hint">{t('common.loading')}</p>
        ) : model.isError ? (
          <p className="status">{t(messageKeyOf(model.error))}</p>
        ) : owner ? (
          <ModelForm
            notebookId={notebookId}
            model={model.data}
            onSaved={() => void client.invalidateQueries({ queryKey: queryKeys.model(notebookId) })}
          />
        ) : model.data ? (
          <ModelSummary model={model.data} />
        ) : (
          <p className="hint">{t('model.notAModel')}</p>
        )}
        {model.data ? (
          <Versions
            notebookId={notebookId}
            model={model.data}
            owner={owner}
            versionAddress={(number) => modelVersionAddress(notebookId, number)}
          />
        ) : null}
        {model.data && owner ? <Publication notebookId={notebookId} model={model.data} /> : null}
      </article>
    </>
  );
}

/**
 * A model shared with the person as a model reader (#355): what it says of
 * itself and its versions, which they read and create notebooks from, without
 * ever reaching the notebook it is.
 */
export function SharedModelPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  useDocumentTitle(t('model.title'));
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });

  return (
    <>
      <SharedModelBar crumbs={[{ label: t('model.title') }]} />
      <article className="content-pane model-page">
        {model.isPending ? (
          <p className="hint">{t('common.loading')}</p>
        ) : model.isError ? (
          <p className="status">{t(messageKeyOf(model.error))}</p>
        ) : !model.data ? (
          <p className="status">{t('common.notFound')}</p>
        ) : (
          <>
            {model.data.sharedBy ? (
              <p className="page-intro">{t('model.sharedBy', { owner: model.data.sharedBy })}</p>
            ) : null}
            <ModelSummary model={model.data} />
            <Versions
              notebookId={notebookId}
              model={model.data}
              owner={false}
              versionAddress={(number) => sharedModelVersionAddress(notebookId, number)}
            />
          </>
        )}
      </article>
    </>
  );
}

/** What the owner declares, and declares again to change it. */
function ModelForm({
  notebookId,
  model,
  onSaved,
}: {
  notebookId: string;
  model: NotebookModelDto | null;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [objective, setObjective] = useState(model?.objective ?? '');
  const [description, setDescription] = useState(model?.description ?? '');
  const [audience, setAudience] = useState(model?.audience ?? '');
  const [basedOn, setBasedOn] = useState(model?.basedOn ?? '');
  const [parameters, setParameters] = useState<ParameterDraft[]>(
    model?.parameters.map(draftOf) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => setSaid(null), [objective, description, audience, basedOn, parameters]);

  const declared = declarationsOf(parameters);
  const ready = objective.trim().length > 0 && declared !== null;

  async function save(): Promise<void> {
    if (!declared) return;
    setBusy(true);
    setSaid(null);
    try {
      await declareModel(notebookId, {
        objective,
        description,
        audience,
        parameters: declared,
        basedOn: basedOn.trim() ? basedOn : null,
      });
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
      {model ? null : (
        <p className="hint">
          {t('model.declareHint', { reference: `{{${t('model.referenceExample')}}}` })}
        </p>
      )}
      <div className="field">
        <label>
          <span className="field-label">{t('model.objective')}</span>
          <textarea
            rows={2}
            value={objective}
            required
            onChange={(event) => setObjective(event.target.value)}
          />
        </label>
        <span className="field-hint">{t('model.objectiveHint')}</span>
      </div>
      <label className="field">
        <span className="field-label">{t('model.description')}</span>
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">{t('model.audience')}</span>
        <input value={audience} onChange={(event) => setAudience(event.target.value)} />
      </label>
      <div className="field">
        <label>
          <span className="field-label">{t('model.basedOn')}</span>
          <input value={basedOn} onChange={(event) => setBasedOn(event.target.value)} />
        </label>
        <span className="field-hint">{t('model.basedOnHint')}</span>
      </div>
      <h2>{t('model.parameters')}</h2>
      <p className="hint">{t('model.parametersHint')}</p>
      <ParametersEditor parameters={parameters} onChange={setParameters} />
      <div className="model-form-actions">
        <button type="submit" className="button is-primary" disabled={busy || !ready}>
          {busy ? t('model.saving') : model ? t('model.save') : t('model.declare')}
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

/** The model, as whoever is not its owner reads it. */
function ModelSummary({ model }: { model: NotebookModelDto }) {
  const { t } = useTranslation();
  return (
    <section className="model-summary">
      <p>
        <strong>{t('model.objective')}:</strong> {model.objective}
      </p>
      {model.audience ? (
        <p>
          <strong>{t('model.audience')}:</strong> {model.audience}
        </p>
      ) : null}
      {model.basedOn ? (
        <p>
          <strong>{t('model.basedOn')}:</strong> {model.basedOn}
        </p>
      ) : null}
      <ParameterList parameters={model.parameters} />
    </section>
  );
}

/** The parameters of a model or a version, as a reader sees them. */
export function ParameterList({ parameters }: { parameters: NotebookModelDto['parameters'] }) {
  const { t } = useTranslation();
  if (parameters.length === 0) return <p className="hint">{t('model.noParameters')}</p>;
  return (
    <ul className="parameter-list">
      {parameters.map((parameter) => (
        <li key={parameter.name}>
          <code>{`{{${parameter.name}}}`}</code> · {t(`model.type.${parameter.type}`)} ·{' '}
          {parameter.required
            ? t('model.parameterRequired')
            : t('model.defaultsTo', {
                value: Array.isArray(parameter.default)
                  ? parameter.default.join(', ')
                  : String(parameter.default ?? ''),
              })}
          {parameter.description ? <span className="hint"> — {parameter.description}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** The versions of a model, the newest first, and creating the next one. */
function Versions({
  notebookId,
  model,
  owner,
  versionAddress,
}: {
  notebookId: string;
  model: NotebookModelDto;
  owner: boolean;
  versionAddress: (number: number) => string;
}) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [changelog, setChangelog] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const again = () => void client.invalidateQueries({ queryKey: queryKeys.model(notebookId) });

  async function create(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await createModelVersion(notebookId, changelog);
      setChangelog('');
      again();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(version: ModelVersionDto): Promise<void> {
    setFailure(null);
    try {
      await deleteModelVersion(notebookId, version.number);
      setDeleting(null);
      again();
    } catch (error) {
      setFailure(t(messageKeyOf(error)));
    }
  }

  const when = (instant: string) =>
    new Intl.DateTimeFormat(intlLocale(i18n.language), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(instant));

  return (
    <section className="model-versions" aria-labelledby="model-versions-heading">
      <h2 id="model-versions-heading">{t('model.versions')}</h2>
      {owner ? (
        <form
          className="model-version-new"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="field">
            <label>
              <span className="field-label">{t('model.changelog')}</span>
              <textarea
                rows={2}
                value={changelog}
                onChange={(event) => setChangelog(event.target.value)}
              />
            </label>
            <span className="field-hint">{t('model.versionHint')}</span>
          </div>
          <button type="submit" className="button is-primary" disabled={busy}>
            {busy ? t('model.creatingVersion') : t('model.createVersion')}
          </button>
        </form>
      ) : null}
      {failure ? (
        <p className="share-failure" role="alert">
          {failure}
        </p>
      ) : null}
      {model.versions.length === 0 ? (
        <p className="hint">{t('model.noVersions')}</p>
      ) : (
        <ul className="row-card model-version-list">
          {model.versions.map((version) => (
            <li key={version.number} className="model-version">
              <span className="model-version-number">v{version.number}</span>
              <span className="state-chip" data-state={stateOf(version.status)}>
                {t(`model.status.${version.status}`)}
              </span>
              <span className="model-version-when">{when(version.createdAt)}</span>
              <span className="model-version-changelog">{version.changelog}</span>
              {version.status === 'ready' ? (
                <Link to={versionAddress(version.number)} className="button is-quiet is-small">
                  {t('model.openVersion')}
                </Link>
              ) : null}
              {owner && version.status !== 'running' ? (
                deleting === version.number ? (
                  <span className="model-version-confirm">
                    <button
                      type="button"
                      className="button is-quiet is-small"
                      onClick={() => setDeleting(null)}
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="button is-danger is-filled is-small"
                      onClick={() => void remove(version)}
                    >
                      {t('model.deleteVersionForGood', { number: version.number })}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="button is-quiet is-small"
                    onClick={() => setDeleting(version.number)}
                  >
                    {t('model.deleteVersion')}
                  </button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function stateOf(status: ModelVersionDto['status']): string {
  switch (status) {
    case 'ready':
      return 'ready';
    case 'running':
      return 'waiting';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
  }
}

/**
 * Publishing the model to the community (#360): what anybody will see of it,
 * the licence every distribution is under, accepted once, and withdrawing it.
 * Only the owner publishes, with a ready version.
 */
function Publication({ notebookId, model }: { notebookId: string; model: NotebookModelDto }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [language, setLanguage] = useState(i18n.language.startsWith('pt') ? 'pt-BR' : 'en');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const published = model.publication ?? null;
  const ready = model.versions.some((each) => each.status === 'ready');
  const needsLicence = model.licence === null;

  async function act(what: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      await what();
      await client.invalidateQueries({ queryKey: queryKeys.model(notebookId) });
    } catch (error) {
      const reason =
        error instanceof ApiError
          ? (error.details as { reason?: string } | undefined)?.reason
          : undefined;
      setFailure(reason === 'AUTHOR_NAME' ? t('model.publishNeedsName') : t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="model-publication" aria-labelledby="model-publication-heading">
      <h2 id="model-publication-heading">{t('model.community')}</h2>
      {published ? (
        <>
          <p>
            {t('model.publishedAs', { author: published.author, language: published.language })}{' '}
            <Link to={communityModelAddress(published.publicId)}>{t('model.publicPage')}</Link>
          </p>
          <button
            type="button"
            className="button is-quiet"
            disabled={busy}
            onClick={() => void act(() => withdrawModel(notebookId))}
          >
            {t('model.withdraw')}
          </button>
        </>
      ) : (
        <>
          <p className="hint">{t('model.publishHint')}</p>
          <p className="callout-warning">{t('model.publishLicence')}</p>
          <label className="field">
            <span className="field-label">{t('community.language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="pt-BR">{t('community.languages.pt')}</option>
              <option value="en">{t('community.languages.en')}</option>
              <option value="es">{t('community.languages.es')}</option>
            </select>
          </label>
          {needsLicence ? (
            <label className="parameter-required">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              {t('sharing.dialog.acceptLicence')}
            </label>
          ) : null}
          <button
            type="button"
            className="button is-primary"
            disabled={busy || !ready || (needsLicence && !accepted)}
            onClick={() =>
              void act(() => publishModel(notebookId, { language, acceptLicence: accepted }))
            }
          >
            {t('model.publish')}
          </button>
          {!ready ? <p className="hint">{t('model.publishNeedsVersion')}</p> : null}
        </>
      )}
      {failure ? (
        <p className="share-failure" role="alert">
          {failure}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The trail of a model shared as a model reader (#355): no notebook is open, so
 * it is not the notebook's trail, which reads the notebook it starts from.
 */
export function SharedModelBar({ crumbs }: { crumbs: Crumb[] }) {
  const { t } = useTranslation();
  return (
    <div className="notebook-bar">
      <nav className="shared-model-trail" aria-label={t('model.title')}>
        {crumbs.map((crumb, index) => (
          <span key={`${crumb.label}-${index}`}>
            {index > 0 ? ' / ' : null}
            {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
          </span>
        ))}
      </nav>
    </div>
  );
}
