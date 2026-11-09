import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listModels } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { modelAddress, sharedModelAddress } from '../../shared/api/note-address';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useDocumentTitle } from '../../shared/components/document-title';
import { ActionWord } from '../../shared/components/ActionWord';
import { PlusIcon } from '../../shared/components/icons';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../dashboard/catalogue';
import { NewModelDialog } from './NewNotebookDialog';

/**
 * The notebook models a person reads, in one place (#418, RN-PRT-058): theirs,
 * and the ones shared with them as a model. Each opens its model page, where
 * its versions are kept; a new model starts here. Home keeps only the new
 * notebook, blank or from one of these.
 */
export function ModelsPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  useDocumentTitle(t('models.title'));
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const state = queryState(query);
  const models = useMemo(
    () => (query.data ? byName(query.data, locale) : undefined),
    [query.data, locale],
  );
  const day = (instant: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(instant));

  return (
    <section className="page models-page">
      <div className="models-heading">
        <div>
          <h1>{t('models.title')}</h1>
          <p className="page-intro">{t('models.intro')}</p>
        </div>
        <div className="models-actions">
          <Link to="/community" className="button is-quiet">
            {t('models.community')}
          </Link>
          <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
            <ActionWord icon={<PlusIcon />} word={t('models.new')} />
          </button>
        </div>
      </div>

      {state === 'error' ? <p className="status">{t(messageKeyOf(query.error))}</p> : null}
      {models?.length === 0 ? <p className="hint">{t('models.empty')}</p> : null}
      {models && models.length > 0 ? (
        <ul className="models-list">
          {models.map((model) => {
            const to =
              model.sharedBy === null
                ? modelAddress(model.notebookId)
                : sharedModelAddress(model.notebookId);
            return (
              <li key={model.notebookId}>
                <Link to={to} className="model-card">
                  <span className="model-card-name">{model.name}</span>
                  {model.objective ? (
                    <span className="model-card-objective">{model.objective}</span>
                  ) : null}
                  <span className="model-card-meta">
                    <span
                      className={model.sharedBy === null ? 'model-chip' : 'model-chip is-shared'}
                    >
                      {model.sharedBy === null
                        ? t('models.mine')
                        : t('models.sharedBy', { owner: model.sharedBy })}
                    </span>
                    {model.publication ? (
                      <span className="model-chip is-published">{t('models.published')}</span>
                    ) : null}
                    <span>{t('models.parameters', { count: model.parameters.length })}</span>
                    <span>{t('models.updated', { date: day(model.updatedAt) })}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      <NewModelDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
