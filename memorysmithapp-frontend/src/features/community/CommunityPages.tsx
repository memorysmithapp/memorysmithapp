import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
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
  reportModel,
  searchCatalog,
} from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { CreateFromModelForm } from '../models/CreateFromModel';
import { ShelfCard } from '../dashboard/NotebookCard';
import { ParameterList } from '../models/ModelPage';
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

const LANGUAGES = ['', 'pt', 'en', 'es'] as const;

/** Finds published models by words and language. */
export function CommunityPage() {
  const { t } = useTranslation();
  const day = useDay();
  const [typed, setTyped] = useState('');
  const [text, setText] = useState('');
  const [language, setLanguage] = useState<string>('');
  useDocumentTitle(t('community.title'));
  const found = useQuery({
    queryKey: queryKeys.catalog(text, language || null),
    queryFn: () => searchCatalog({ text, language: language || null }),
  });

  function submit(event: FormEvent): void {
    event.preventDefault();
    setText(typed.trim());
  }

  return (
    <>
      <section className="page shelf-page community-page">
        <h1>{t('community.title')}</h1>
        <p className="page-intro">{t('community.intro')}</p>
        <form className="community-search" role="search" onSubmit={submit}>
          <label className="field">
            <span className="field-label">{t('community.search')}</span>
            <input
              type="search"
              value={typed}
              placeholder={t('community.searchHint')}
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t('community.language')}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {LANGUAGES.map((each) => (
                <option key={each} value={each}>
                  {t(`community.languages.${each || 'any'}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button is-primary">
            {t('community.find')}
          </button>
        </form>
        {found.isPending ? (
          <p className="hint">{t('common.loading')}</p>
        ) : found.isError ? (
          <p className="status">{t(messageKeyOf(found.error))}</p>
        ) : found.data.length === 0 ? (
          <p className="hint">{t('community.nothing')}</p>
        ) : (
          <div className="shelf-grid">
            {found.data.map((model, index) => (
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
                to={communityModelAddress(model.publicId)}
                openLabel={t('models.open')}
                openShort={t('notebooks.openShort')}
              />
            ))}
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
    <>
      <article className="content-pane community-page">
        {model.isPending ? (
          <p className="hint">{t('common.loading')}</p>
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
    </>
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
    <>
      <article className="content-pane model-version-page community-page">
        {version.isPending ? (
          <p className="hint">{t('common.loading')}</p>
        ) : version.isError ? (
          <p className="status">{t(messageKeyOf(version.error))}</p>
        ) : (
          <>
            <p className="hint">
              <Link to={communityModelAddress(publicId)}>{version.data.model.name}</Link>
            </p>
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
    </>
  );
}
