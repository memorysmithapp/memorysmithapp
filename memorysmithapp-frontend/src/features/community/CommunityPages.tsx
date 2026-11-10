import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PublicModelDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { communityModelAddress, identifierOf } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  getCatalogContents,
  getCatalogHistory,
  getCatalogModel,
  listModels,
  reportModel,
  searchCatalog,
} from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { useLiveInterval } from '../../shared/api/live';
import { PageSkeleton, RowsSkeleton, ShelfSkeleton } from '../../shared/components/skeletons';
import { Tabs } from '../../shared/components/Tabs';
import { ShelfCard } from '../dashboard/NotebookCard';
import { ShelfCorner } from '../dashboard/ShelfCorner';
import { PageHeading } from '../../shared/components/PageHeading';
import { OwnershipMark } from '../sharing/OwnershipMark';
import { SharedModelBar } from '../models/ModelPage';
import { ModelContents, ParameterList } from '../models/ModelContents';
import { ModelHistoryList } from '../models/ModelHistory';

/**
 * The community catalog (#360): the models their owners published, read and
 * created from by a person signed in, inside the frame of the application and
 * its menu (#418, RN-PRT-079). The list is the shelf of cards the notebooks
 * and the models use.
 */

function useDay(): (instant: string) => string {
  const { i18n } = useTranslation();
  return (instant) =>
    new Intl.DateTimeFormat(intlLocale(i18n.language), { dateStyle: 'medium' }).format(
      new Date(instant),
    );
}

/**
 * Every published model, as cards (#418): what to look for is typed in the
 * search of the header, which finds community models with the notebooks and
 * the models of the person.
 */
export function CommunityPage() {
  const { t } = useTranslation();
  const day = useDay();
  useDocumentTitle(t('community.title'));
  // What I published myself, which its mark says (#418).
  const mine = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const published = useMemo(
    () =>
      new Set(
        (mine.data ?? []).flatMap((model) =>
          model.publication ? [model.publication.publicId] : [],
        ),
      ),
    [mine.data],
  );
  const found = useQuery({
    queryKey: queryKeys.catalog('', null),
    queryFn: () => searchCatalog({ text: '', language: null }),
    // Read again like every list on the screen (#206): the edge answers what
    // it holds while it fetches a fresh list (#420), so a model published or
    // withdrawn a moment ago reaches the page on a later reading.
    refetchInterval: useLiveInterval(),
  });
  /**
   * What the person published is on the page at once, whatever the edge still
   * holds (#420): their own models answer it from the API, which no edge keeps.
   */
  const models = useMemo(() => {
    if (!found.data) return undefined;
    const listed = new Set(found.data.map((model) => model.publicId));
    const missing = (mine.data ?? []).flatMap((model) =>
      model.publication && !listed.has(model.publication.publicId) ? [model.publication] : [],
    );
    if (missing.length === 0) return found.data;
    return [...found.data, ...missing].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [found.data, mine.data]);

  return (
    <>
      <section className="page shelf-page community-page">
        <PageHeading
          title={t('community.title')}
          count={models?.length}
          help={{ page: 'community', text: t('community.help') }}
        />
        {found.isPending ? (
          <ShelfSkeleton />
        ) : found.isError ? (
          <p className="status">{t(messageKeyOf(found.error))}</p>
        ) : !models || models.length === 0 ? (
          <p className="hint">{t('community.nothing')}</p>
        ) : (
          <div className="shelf-grid">
            {models.map((model, index) => {
              const own = published.has(model.publicId);
              const to = communityModelAddress(model.publicId);
              return (
                <ShelfCard
                  key={model.publicId}
                  seed={model.publicId}
                  strip={index % 2 === 0 ? 'blue' : 'orange'}
                  name={model.name}
                  description={model.objective}
                  byline={t('community.by', { author: model.author })}
                  meta={t('community.cardMeta', {
                    language: model.language,
                    date: day(model.updatedAt),
                  })}
                  to={to}
                  openLabel={t('models.open')}
                  openShort={t('notebooks.openShort')}
                  corner={
                    <ShelfCorner
                      title={model.name}
                      mark={
                        <OwnershipMark
                          ownership={own ? 'own' : 'community'}
                          owner={model.author}
                          kind="community"
                        />
                      }
                    >
                      {/* A notebook is created from it in New notebook, the one way (#435). */}
                      {null}
                    </ShelfCorner>
                  }
                />
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function usePublicId(): string {
  return identifierOf(useParams().publicId) ?? '';
}

/** The parts of a published model, one tab each, as a model of one's own shows them (#400, #431). */
const COMMUNITY_TABS = ['about', 'contents', 'history'] as const;
type CommunityTab = (typeof COMMUNITY_TABS)[number];

function useCommunityTab(): [CommunityTab, (tab: CommunityTab) => void] {
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: CommunityTab = COMMUNITY_TABS.find((each) => each === asked) ?? 'about';
  return [tab, (next) => setParams(next === 'about' ? {} : { tab: next }, { replace: true })];
}

/**
 * A published model: what it is for, its author and its parameters, what it
 * holds as it stands, and its history, when and what but never who (#431). A
 * notebook is created from it in New notebook (#435).
 */
export function CommunityModelPage() {
  const { t } = useTranslation();
  const publicId = usePublicId();
  const [tab, selectTab] = useCommunityTab();
  const model = useQuery({
    queryKey: queryKeys.catalogModel(publicId),
    queryFn: () => getCatalogModel(publicId),
    retry: false,
  });
  useDocumentTitle(model.data?.name, t('community.title'));

  return (
    <div className="trail-page">
      {/* The way back to every model of the community (#422). */}
      <SharedModelBar
        crumbs={[
          { label: t('nav.community'), to: '/community' },
          { label: model.data?.name ?? '' },
        ]}
      />
      <article className="content-pane community-page">
        {model.isPending ? (
          <PageSkeleton />
        ) : model.isError ? (
          <p className="status">{t(messageKeyOf(model.error))}</p>
        ) : (
          <>
            <h1>{model.data.name}</h1>
            <Tabs
              id="model"
              label={model.data.name}
              className="model-tabs"
              active={tab}
              onSelect={selectTab}
              tabs={[
                { key: 'about', label: t('model.tabs.about') },
                { key: 'contents', label: t('model.tabs.contents') },
                { key: 'history', label: t('model.tabs.history') },
              ]}
            />
            <div
              id="model-panel"
              role="tabpanel"
              aria-labelledby={`model-tab-${tab}`}
              className="model-panel"
            >
              {tab === 'about' ? (
                <>
                  <ModelFacts model={model.data} />
                  <Report publicId={publicId} />
                </>
              ) : null}
              {tab === 'contents' ? <CommunityContents publicId={publicId} /> : null}
              {tab === 'history' ? <CommunityHistory publicId={publicId} /> : null}
            </div>
          </>
        )}
      </article>
    </div>
  );
}

/** A published model as it stands (#431). */
function CommunityContents({ publicId }: { publicId: string }) {
  const { t } = useTranslation();
  const contents = useQuery({
    queryKey: queryKeys.catalogContents(publicId),
    queryFn: () => getCatalogContents(publicId),
    retry: false,
  });
  if (contents.isPending) return <PageSkeleton />;
  if (contents.isError) return <p className="status">{t(messageKeyOf(contents.error))}</p>;
  return <ModelContents contents={contents.data} />;
}

/** The history of a published model: when, what and the line left, never who (#431). */
function CommunityHistory({ publicId }: { publicId: string }) {
  const { t } = useTranslation();
  const history = useQuery({
    queryKey: queryKeys.catalogHistory(publicId),
    queryFn: () => getCatalogHistory(publicId),
    retry: false,
  });
  return (
    <section className="model-history-panel" aria-label={t('model.tabs.history')}>
      <p className="hint">{t('community.historyHint')}</p>
      {history.isPending ? (
        <RowsSkeleton rows={4} />
      ) : history.isError ? (
        <p className="status">{t('history.failed')}</p>
      ) : (
        <ModelHistoryList
          changes={history.data.changes}
          truncated={history.data.truncated}
          withAuthor={false}
        />
      )}
    </section>
  );
}

function ModelFacts({ model }: { model: PublicModelDto }) {
  const { t } = useTranslation();
  return (
    <section className="model-summary">
      <p className="page-intro">{model.objective}</p>
      {model.description ? <p>{model.description}</p> : null}
      <p>
        <strong>{t('community.author')}:</strong> {model.author}
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
      <p className="hint">{t('community.licence')}</p>
      <h2>{t('model.parameters')}</h2>
      <ParameterList parameters={model.parameters} />
    </section>
  );
}

/** A report to the operator, which only a person signed in makes (#358). */
function Report({ publicId }: { publicId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <p className="community-report">
        <button type="button" className="button is-quiet is-small" onClick={() => setOpen(true)}>
          {t('community.report')}
        </button>
      </p>
    );
  }

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    try {
      await reportModel(publicId, reason);
      setSaid(t('community.reported'));
      setReason('');
    } catch (error) {
      setSaid(t(messageKeyOf(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="community-report" onSubmit={(event) => void send(event)}>
      <label className="field">
        <span className="field-label">{t('community.reportWhy')}</span>
        <textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <button type="submit" className="button is-danger" disabled={busy || !reason.trim()}>
        {t('community.sendReport')}
      </button>
      {said ? (
        <p className="hint" role="status">
          {said}
        </p>
      ) : null}
    </form>
  );
}
