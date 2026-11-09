import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listModels } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { modelAddress, notebookAddress, sharedModelAddress } from '../../shared/api/note-address';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useDocumentTitle } from '../../shared/components/document-title';
import { ActionWord } from '../../shared/components/ActionWord';
import { PlusIcon } from '../../shared/components/icons';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../dashboard/catalogue';
import { NewModelDialog, NewNotebookDialog } from './NewNotebookDialog';
import { MenuDivider, MenuItem } from '../../shared/components/Menu';
import { OwnershipMark } from '../sharing/OwnershipMark';
import { useOwnShares } from '../sharing/shares';
import { ShelfCorner } from '../dashboard/ShelfCorner';
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
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  // The model a card asked a new notebook from (#418).
  const [from, setFrom] = useState<string | null>(null);
  const query = useQuery({ queryKey: queryKeys.models(), queryFn: listModels });
  const state = queryState(query);
  const models = useMemo(
    () => (query.data ? byName(query.data, locale) : undefined),
    [query.data, locale],
  );
  // Which of my models I shared with somebody, which their mark says (#256).
  const mine = (models ?? []).some((model) => model.sharedBy === null);
  const ownShares = useOwnShares(mine);
  const shared = useMemo(
    () =>
      new Set(
        (ownShares.data ?? [])
          .filter((share) => share.state === 'pending' || share.state === 'accepted')
          .map((share) => share.notebookId),
      ),
    [ownShares.data],
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
            const own = model.sharedBy === null;
            const to = own ? modelAddress(model.notebookId) : sharedModelAddress(model.notebookId);
            const day = formatDay(model.updatedAt, locale);
            return (
              <ShelfCard
                key={model.notebookId}
                seed={model.notebookId}
                strip={index % 2 === 0 ? 'blue' : 'orange'}
                name={model.name}
                description={model.objective}
                byline={
                  own
                    ? model.publication
                      ? t('models.published')
                      : null
                    : t('models.sharedBy', { owner: model.sharedBy })
                }
                meta={`${parameters} · ${t('models.updated', { date: day })}`}
                shortMeta={`${parameters} · ${day}`}
                to={to}
                openLabel={t('models.open')}
                openShort={t('notebooks.openShort')}
                corner={
                  <ShelfCorner
                    title={model.name}
                    mark={
                      <OwnershipMark
                        ownership={
                          own
                            ? shared.has(model.notebookId)
                              ? 'sharedByMe'
                              : 'own'
                            : 'sharedWithMe'
                        }
                        owner={model.sharedBy ?? undefined}
                        label={
                          own
                            ? shared.has(model.notebookId)
                              ? t('models.mark.sharedByMe')
                              : t('models.mark.own')
                            : t('models.mark.sharedWithMe', { owner: model.sharedBy })
                        }
                      />
                    }
                  >
                    {(close) => (
                      <>
                        <MenuItem onSelect={() => navigate(to)}>{t('models.open')}</MenuItem>
                        <MenuItem
                          onSelect={() => {
                            close();
                            setFrom(model.notebookId);
                          }}
                        >
                          {t('models.menu.newNotebook')}
                        </MenuItem>
                        <MenuItem onSelect={() => navigate(`${to}?tab=versions`)}>
                          {t('models.menu.versions')}
                        </MenuItem>
                        {own ? (
                          <>
                            <MenuItem onSelect={() => navigate(`${to}?tab=community`)}>
                              {t('models.menu.publication')}
                            </MenuItem>
                            <MenuDivider />
                            <MenuItem onSelect={() => navigate(notebookAddress(model.notebookId))}>
                              {t('models.menu.notebook')}
                            </MenuItem>
                          </>
                        ) : null}
                      </>
                    )}
                  </ShelfCorner>
                }
              />
            );
          })}
        </div>
      ) : null}

      <NewModelDialog open={creating} onClose={() => setCreating(false)} />
      {from ? <NewNotebookDialog open model={from} onClose={() => setFrom(null)} /> : null}
    </section>
  );
}
