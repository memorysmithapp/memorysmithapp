import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
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
  getModelVersion,
  deleteModelVersion,
  getModel,
  publishModel,
  withdrawModel,
} from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar, contextCrumbs, type Crumb } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import {
  isModelTab,
  ModelAbout,
  ModelAboutSummary,
  ModelParameters,
  ModelTabs,
  type ModelTab,
} from './ModelParts';
import { ActionWord } from '../../shared/components/ActionWord';
import {
  ChevronRightIcon,
  CloseIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '../../shared/components/icons';
import { ModelSkeleton } from '../../shared/components/skeletons';

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
  const [tab, selectTab] = useModelTab();

  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
    refetchInterval: (query) =>
      query.state.data?.versions.some((each) => each.status === 'running') ? 2000 : false,
  });
  const saved = () => void client.invalidateQueries({ queryKey: queryKeys.model(notebookId) });

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('model.title'))} />
      <article className="content-pane model-page">
        <p className="page-intro">{t('model.intro')}</p>
        {model.isPending ? (
          <ModelSkeleton />
        ) : model.isError ? (
          <p className="status">{t(messageKeyOf(model.error))}</p>
        ) : model.data ? (
          <>
            {/* One part of the model at a time (#400). */}
            <ModelTabs model={model.data} owner={owner} active={tab} onSelect={selectTab} />
            <div
              id="model-panel"
              role="tabpanel"
              aria-labelledby={`model-tab-${tab}`}
              className="model-panel"
            >
              {tab === 'about' ? (
                owner ? (
                  <ModelAbout notebookId={notebookId} model={model.data} onSaved={saved} />
                ) : (
                  <ModelAboutSummary model={model.data} />
                )
              ) : null}
              {tab === 'parameters' ? (
                owner ? (
                  <ModelParameters notebookId={notebookId} model={model.data} onSaved={saved} />
                ) : (
                  <ParameterList parameters={model.data.parameters} />
                )
              ) : null}
              {tab === 'versions' ? (
                <Versions
                  notebookId={notebookId}
                  model={model.data}
                  owner={owner}
                  versionAddress={(number) => modelVersionAddress(notebookId, number)}
                />
              ) : null}
              {tab === 'community' && owner ? (
                <Publication notebookId={notebookId} model={model.data} />
              ) : null}
            </div>
          </>
        ) : (
          <p className="hint">{t('model.notAModel')}</p>
        )}
      </article>
    </>
  );
}

/**
 * The tab of the model that is open, kept in the address (`?tab=`), so a
 * reload, a link and the dialog of a new model open the one meant (#400).
 */
function useModelTab(): [ModelTab, (tab: ModelTab) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: ModelTab = isModelTab(asked) ? asked : 'about';
  return [tab, (next) => setParams(next === 'about' ? {} : { tab: next }, { replace: true })];
}

export function SharedModelPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  useDocumentTitle(t('model.title'));
  const [tab, selectTab] = useModelTab();
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });

  return (
    <>
      <SharedModelBar crumbs={[{ label: t('model.title') }]} />
      <article className="content-pane model-page">
        {model.isPending ? (
          <ModelSkeleton />
        ) : model.isError ? (
          <p className="status">{t(messageKeyOf(model.error))}</p>
        ) : !model.data ? (
          <p className="status">{t('common.notFound')}</p>
        ) : (
          <>
            {model.data.sharedBy ? (
              <p className="page-intro">{t('model.sharedBy', { owner: model.data.sharedBy })}</p>
            ) : null}
            <ModelTabs model={model.data} owner={false} active={tab} onSelect={selectTab} />
            <div
              id="model-panel"
              role="tabpanel"
              aria-labelledby={`model-tab-${tab}`}
              className="model-panel"
            >
              {tab === 'about' ? <ModelAboutSummary model={model.data} /> : null}
              {tab === 'parameters' ? <ParameterList parameters={model.data.parameters} /> : null}
              {tab === 'versions' ? (
                <Versions
                  notebookId={notebookId}
                  model={model.data}
                  owner={false}
                  versionAddress={(number) => sharedModelVersionAddress(notebookId, number)}
                />
              ) : null}
            </div>
          </>
        )}
      </article>
    </>
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
      // Every table of the model goes with its rows, and every dashboard (#405, RN-PRT-056).
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
            <ActionWord
              icon={<PlusIcon />}
              word={busy ? t('model.creatingVersion') : t('model.createVersion')}
              wide
            />
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
                  <ActionWord icon={<ChevronRightIcon />} word={t('model.openVersion')} />
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
                      <ActionWord icon={<CloseIcon />} word={t('common.cancel')} />
                    </button>
                    <button
                      type="button"
                      className="button is-danger is-filled is-small"
                      onClick={() => void remove(version)}
                    >
                      <ActionWord
                        icon={<TrashIcon />}
                        word={t('model.deleteVersionForGood', { number: version.number })}
                      />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="button is-quiet is-small"
                    onClick={() => setDeleting(version.number)}
                  >
                    <ActionWord icon={<TrashIcon />} word={t('model.deleteVersion')} />
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
  /**
   * What every person signed in will read of the tables, said where it is
   * published (#366, RN-PRT-059): the newest ready version is what the catalog
   * shows first, and the rows it carries are read with it.
   */
  const newest = model.versions
    .filter((each) => each.status === 'ready')
    .reduce<number | null>(
      (top, each) => (top === null || each.number > top ? each.number : top),
      null,
    );
  const version = useQuery({
    queryKey: queryKeys.modelVersion(notebookId, newest ?? 0),
    queryFn: () => getModelVersion(notebookId, newest ?? 0),
    enabled: newest !== null && !published,
  });
  const publicRows = (version.data?.tables ?? []).filter((table) => table.rows !== null);
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
            <ActionWord icon={<CloseIcon />} word={t('model.withdraw')} wide />
          </button>
        </>
      ) : (
        <>
          <p className="hint">{t('model.publishHint')}</p>
          <p className="callout-warning">{t('model.publishLicence')}</p>
          {publicRows.length > 0 ? (
            <p className="callout-warning">
              {t('tables.carry.published', {
                tables: publicRows
                  .map((table) => `${table.name} (${t('tables.rows', { count: table.rows ?? 0 })})`)
                  .join(', '),
              })}
            </p>
          ) : null}
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
            <ActionWord icon={<UploadIcon />} word={t('model.publish')} wide />
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
