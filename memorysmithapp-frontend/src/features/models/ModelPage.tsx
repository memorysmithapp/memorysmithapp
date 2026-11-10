import { Fragment, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { NotebookModelDto } from '@memorysmithapp/contracts';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import { communityModelAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getModel, getModelContents, publishModel, withdrawModel } from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar, contextCrumbs, type Crumb } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import {
  isModelTab,
  MODEL_TABS,
  ModelAbout,
  ModelAboutSummary,
  ModelParameters,
  ModelTabs,
  OWN_MODEL_TABS,
  type ModelTab,
} from './ModelParts';
import { ModelContentsPanel, ModelReferences, ParameterList } from './ModelContents';
import { ModelHistoryPanel } from './ModelHistory';
import { ActionWord } from '../../shared/components/ActionWord';
import { CloseIcon, UploadIcon } from '../../shared/components/icons';
import { ModelSkeleton } from '../../shared/components/skeletons';

/**
 * The model of a notebook (#353): what a notebook declared as a model says of
 * itself — what it is for, who it is for, its parameters, an optional credit —
 * and its history (#431). The owner of the subscription declares it and says
 * it again; whoever reads the notebook reads its model, and reads what it
 * holds by navigating the notebook, so this page has no Contents (#435). A
 * model keeps no frozen version: a notebook created from it starts as it
 * stands, and keeping a state of it is exporting the notebook. A notebook is
 * created from it in New notebook, the one way to create one (#435).
 */
export function ModelPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const owner = structure.permissions.administer;
  const client = useQueryClient();
  useDocumentTitle(t('model.title'), structure.notebook.name);
  const [tab, selectTab] = useModelTab(OWN_MODEL_TABS);

  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });
  // What it declares changed, and with it which references it answers (#435).
  const saved = () => {
    void client.invalidateQueries({ queryKey: queryKeys.model(notebookId) });
    void client.invalidateQueries({ queryKey: queryKeys.modelContents(notebookId) });
  };

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
            <ModelTabs
              model={model.data}
              owner={owner}
              contents={false}
              active={tab}
              onSelect={selectTab}
            />
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
                  <>
                    <ModelReferences notebookId={notebookId} />
                    <ModelParameters notebookId={notebookId} model={model.data} onSaved={saved} />
                  </>
                ) : (
                  <ParameterList parameters={model.data.parameters} />
                )
              ) : null}
              {tab === 'history' ? <ModelHistoryPanel notebookId={notebookId} /> : null}
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
 * reload, a link and the dialog of a new model open the one meant (#400). A
 * tab the page does not have opens its first one.
 */
function useModelTab(tabs: readonly ModelTab[]): [ModelTab, (tab: ModelTab) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: ModelTab = isModelTab(asked, tabs) ? asked : 'about';
  return [tab, (next) => setParams(next === 'about' ? {} : { tab: next }, { replace: true })];
}

export function SharedModelPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  useDocumentTitle(t('model.title'));
  const [tab, selectTab] = useModelTab(MODEL_TABS);
  const model = useQuery({
    queryKey: queryKeys.model(notebookId),
    queryFn: () => getModel(notebookId),
  });

  return (
    <div className="trail-page">
      <SharedModelBar
        crumbs={[{ label: t('nav.models'), to: '/models' }, { label: t('model.title') }]}
      />
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
            {/* What it holds is read here, where its notebook cannot be opened (#435). */}
            <ModelTabs
              model={model.data}
              owner={false}
              contents
              active={tab}
              onSelect={selectTab}
            />
            <div
              id="model-panel"
              role="tabpanel"
              aria-labelledby={`model-tab-${tab}`}
              className="model-panel"
            >
              {tab === 'about' ? <ModelAboutSummary model={model.data} /> : null}
              {tab === 'parameters' ? <ParameterList parameters={model.data.parameters} /> : null}
              {tab === 'contents' ? <ModelContentsPanel notebookId={notebookId} /> : null}
              {tab === 'history' ? <ModelHistoryPanel notebookId={notebookId} /> : null}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

/**
 * Publishing the model to the community (#360): what anybody will see of it,
 * the licence every distribution is under, accepted once, and withdrawing it.
 * Only the owner publishes; the community reads the model as it stands (#431).
 */
function Publication({ notebookId, model }: { notebookId: string; model: NotebookModelDto }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [language, setLanguage] = useState(i18n.language.startsWith('pt') ? 'pt-BR' : 'en');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const published = model.publication ?? null;
  /**
   * What every person signed in will read of the tables, said where it is
   * published (#366, RN-PRT-079): the community reads the model as it stands
   * (#431), and every table goes with its rows.
   */
  const contents = useQuery({
    queryKey: queryKeys.modelContents(notebookId),
    queryFn: () => getModelContents(notebookId),
    enabled: !published,
  });
  const publicRows = (contents.data?.tables ?? []).filter((table) => table.rows > 0);
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
                  .map((table) => `${table.name} (${t('tables.rows', { count: table.rows })})`)
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
            disabled={busy || (needsLicence && !accepted)}
            onClick={() =>
              void act(() => publishModel(notebookId, { language, acceptLicence: accepted }))
            }
          >
            <ActionWord icon={<UploadIcon />} word={t('model.publish')} wide />
          </button>
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
 * The trail of a page outside a notebook (#355, #422): a model shared as a
 * model reader, and the community. No notebook is open, so it is not the
 * notebook's trail, which starts at the notebook; it starts at the page of the
 * menu the person came from, and is drawn as that trail is. The page wraps
 * the bar and its article in one block, `.trail-page`, so the row of
 * `.app-main` lays them one under the other and never side by side, and the
 * trail starts where the text of the article does.
 */
export function SharedModelBar({ crumbs }: { crumbs: Crumb[] }) {
  const { t } = useTranslation();
  // A crumb whose name is still being read waits for it.
  const shown = crumbs.filter((crumb) => crumb.label !== '');
  const last = shown.length - 1;
  return (
    <div className="notebook-bar">
      <nav className="notebook-breadcrumb" aria-label={t('structure.breadcrumb')}>
        {shown.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 ? (
              <span className="crumb-separator" aria-hidden="true">
                /
              </span>
            ) : null}
            {crumb.to ? (
              <Link to={crumb.to} className="crumb" title={crumb.label}>
                {crumb.label}
              </Link>
            ) : (
              <span
                className={`crumb${index === last ? ' is-last' : ''}`}
                aria-current="page"
                title={crumb.label}
              >
                {crumb.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
