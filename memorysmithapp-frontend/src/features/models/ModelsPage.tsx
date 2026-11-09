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
import { ShelfCard, formatDay } from '../dashboard/NotebookCard';

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

  return (
    <section className="page shelf-page">
      <div className="shelf-heading">
        <div>
          <h1>{t('models.title')}</h1>
          <p className="page-intro">{t('models.intro')}</p>
        </div>
        <div className="shelf-actions">
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
        <div className="shelf-grid">
          {models.map((model, index) => {
            const parameters = t('models.parameters', { count: model.parameters.length });
            const day = formatDay(model.updatedAt, locale);
            return (
              <ShelfCard
                key={model.notebookId}
                seed={model.notebookId}
                strip={index % 2 === 0 ? 'blue' : 'orange'}
                name={model.name}
                description={model.objective}
                byline={[
                  model.sharedBy === null
                    ? t('models.mine')
                    : t('models.sharedBy', { owner: model.sharedBy }),
                  model.publication ? t('models.published') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                meta={`${parameters} · ${t('models.updated', { date: day })}`}
                shortMeta={`${parameters} · ${day}`}
                to={
                  model.sharedBy === null
                    ? modelAddress(model.notebookId)
                    : sharedModelAddress(model.notebookId)
                }
                openLabel={t('models.open')}
                openShort={t('notebooks.openShort')}
              />
            );
          })}
        </div>
      ) : null}

      <NewModelDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
