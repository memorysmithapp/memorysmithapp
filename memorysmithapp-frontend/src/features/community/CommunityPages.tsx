import { useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PublicModelDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { messageKeyOf } from '../../shared/api/error-mapper';
import {
  communityModelAddress,
  communityVersionAddress,
  identifierOf,
} from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import {
  createFromCatalog,
  getCatalogModel,
  getCatalogVersion,
  listModels,
  reportModel,
  searchCatalog,
} from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { useLiveInterval } from '../../shared/api/live';
import { PageSkeleton, ShelfSkeleton } from '../../shared/components/skeletons';
import { CreateFromModelForm } from '../models/CreateFromModel';
import { ShelfCard } from '../dashboard/NotebookCard';
import { ShelfCorner } from '../dashboard/ShelfCorner';
import { ShelfHeading } from '../dashboard/ShelfHeading';
import { OwnershipMark } from '../sharing/OwnershipMark';
import { MenuItem } from '../../shared/components/Menu';
import { ParameterList, SharedModelBar } from '../models/ModelPage';
import { VersionContents } from '../models/ModelVersionPage';

/**
 * The community catalog (#360): the models their owners published, read and
 * created from by a person signed in, inside the frame of the application and
 * its menu (#418, RN-PRT-059). The list is the shelf of cards the notebooks
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
  const navigate = useNavigate();
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
        <ShelfHeading
          page="community"
          title={t('community.title')}
          count={models?.length}
          help={t('community.help')}
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
              const latest = Math.max(0, ...model.versions.map((version) => version.number));
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
                    count: model.versions.length,
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
                      {latest > 0
                        ? () => (
                            <MenuItem
                              onSelect={() =>
                                navigate(communityVersionAddress(model.publicId, latest))
                              }
                            >
                              {t('community.menu.fromVersion', { number: latest })}
                            </MenuItem>
                          )
                        : null}
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

/** A published model: what it is for, its author, its parameters and its versions. */
export function CommunityModelPage() {
  const { t } = useTranslation();
  const day = useDay();
  const publicId = usePublicId();
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
            <ModelFacts model={model.data} />
            <h2>{t('model.versions')}</h2>
            <ul className="row-card model-version-list">
              {model.data.versions.map((version) => (
                <li key={version.number} className="model-version is-public">
                  <span className="model-version-number">v{version.number}</span>
                  <span className="model-version-when">{day(version.createdAt)}</span>
                  <span className="model-version-changelog">{version.changelog}</span>
                  <Link
                    to={communityVersionAddress(publicId, version.number)}
                    className="button is-quiet is-small"
                  >
                    {t('model.openVersion')}
                  </Link>
                </li>
              ))}
            </ul>
            <Report publicId={publicId} />
          </>
        )}
      </article>
    </div>
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

/** A published version, read whole, and a notebook created from it once signed in. */
export function CommunityVersionPage() {
  const { t } = useTranslation();
  const publicId = usePublicId();
  const number = Number(useParams().version);
  const [creating, setCreating] = useState(false);
  const version = useQuery({
    queryKey: queryKeys.catalogVersion(publicId, number),
    queryFn: () => getCatalogVersion(publicId, number),
    retry: false,
  });
  useDocumentTitle(
    version.data ? `${version.data.model.name} v${number}` : null,
    t('community.title'),
  );

  return (
    <div className="trail-page">
      {/* Community / the model / its version (#422). */}
      <SharedModelBar
        crumbs={[
          { label: t('nav.community'), to: '/community' },
          {
            label: version.data?.model.name ?? '',
            to: communityModelAddress(publicId),
          },
          { label: `v${number}` },
        ]}
      />
      <article className="content-pane model-version-page community-page">
        {version.isPending ? (
          <PageSkeleton />
        ) : version.isError ? (
          <p className="status">{t(messageKeyOf(version.error))}</p>
        ) : (
          <>
            <h1>{t('model.versionTitle', { number })}</h1>
            {version.data.version.changelog ? (
              <p className="page-intro">{version.data.version.changelog}</p>
            ) : null}
            <h2>{t('model.parameters')}</h2>
            <ParameterList parameters={version.data.parameters} />
            {creating ? (
              <section className="model-create" aria-label={t('model.create')}>
                <h2>{t('model.create')}</h2>
                <CreateFromModelForm
                  notebookId={publicId}
                  version={number}
                  parameters={version.data.parameters}
                  onCancel={() => setCreating(false)}
                  create={(input) => createFromCatalog(publicId, number, input)}
                />
              </section>
            ) : (
              <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
                {t('model.create')}
              </button>
            )}
            <VersionContents view={version.data} />
          </>
        )}
      </article>
    </div>
  );
}
