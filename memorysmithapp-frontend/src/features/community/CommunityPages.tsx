import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PublicModelDto } from '@memorysmithapp/contracts';
import { intlLocale } from '../../i18n/intl-locale';
import { messageKeyOf } from '../../shared/api/error-mapper';
import {
  communityAddress,
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
import { readTokens } from '../../shared/auth/oauth';
import { BrandMark } from '../../shared/components/BrandMark';
import { useDocumentTitle } from '../../shared/components/document-title';
import { CreateFromModelForm } from '../models/CreateFromModel';
import { ParameterList } from '../models/ModelPage';
import { VersionContents } from '../models/ModelVersionPage';

/**
 * The community catalog (#360): the models their owners published, which
 * anybody reads, signed in or not, and creates notebooks from once signed in.
 * These pages sit outside the frame of the application, because a visitor
 * with no account reaches them, and they may be indexed by search engines
 * (#358): each one says what it is in its title and its description.
 */

/** Whether this browser holds a session, which creating and reporting need. */
function signedIn(): boolean {
  return readTokens() !== null;
}

/** The description a search engine reads of the page, for as long as it is open. */
function useDescription(text: string | null | undefined): void {
  useEffect(() => {
    if (!text) return;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !tag;
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.append(tag);
    }
    const before = tag.content;
    tag.content = text;
    return () => {
      if (created) tag?.remove();
      else if (tag) tag.content = before;
    };
  }, [text]);
}

function CommunityFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="community-frame">
      <header className="community-head">
        <Link to="/" className="community-brand" aria-label={t('community.home')}>
          <BrandMark />
        </Link>
        <nav className="community-nav" aria-label={t('community.title')}>
          <Link to={communityAddress()}>{t('community.title')}</Link>
          {signedIn() ? (
            <Link to="/">{t('community.home')}</Link>
          ) : (
            <Link to="/login" className="button is-primary is-small">
              {t('community.signIn')}
            </Link>
          )}
        </nav>
      </header>
      <main className="community-main">{children}</main>
    </div>
  );
}

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
  useDescription(t('community.intro'));
  const found = useQuery({
    queryKey: queryKeys.catalog(text, language || null),
    queryFn: () => searchCatalog({ text, language: language || null }),
  });

  function submit(event: FormEvent): void {
    event.preventDefault();
    setText(typed.trim());
  }

  return (
    <CommunityFrame>
      <article className="content-pane community-page">
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
          <ul className="community-results">
            {found.data.map((model) => (
              <li key={model.publicId} className="community-card">
                <h2>
                  <Link to={communityModelAddress(model.publicId)}>{model.name}</Link>
                </h2>
                <p>{model.objective}</p>
                <p className="hint">
                  {t('community.byline', {
                    author: model.author,
                    language: model.language,
                    date: day(model.updatedAt),
                    count: model.versions.length,
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </article>
    </CommunityFrame>
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
  useDescription(model.data?.objective);

  return (
    <CommunityFrame>
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
                <li key={version.number} className="model-version">
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
    </CommunityFrame>
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

  if (!signedIn()) {
    return (
      <p className="hint community-report">
        <Link to="/login">{t('community.signInToReport')}</Link>
      </p>
    );
  }
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
  useDescription(version.data?.objective);

  return (
    <CommunityFrame>
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
            {!signedIn() ? (
              <p>
                <Link to="/login" className="button is-primary">
                  {t('community.signInToCreate')}
                </Link>
              </p>
            ) : creating ? (
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
    </CommunityFrame>
  );
}
