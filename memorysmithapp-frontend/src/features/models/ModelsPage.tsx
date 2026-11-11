import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listModels, listNotebooks } from '../../shared/api/source';
import { queryKeys } from '../../shared/api/query-keys';
import { notebookAddress, sharedModelAddress } from '../../shared/api/note-address';
import { queryState } from '../../shared/api/query-state';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { useDocumentTitle } from '../../shared/components/document-title';
import { ActionWord } from '../../shared/components/ActionWord';
import { PlusIcon } from '../../shared/components/icons';
import { intlLocale } from '../../i18n/intl-locale';
import { byName } from '../dashboard/catalogue';
import { NewModelDialog } from './NewNotebookDialog';
import { NotebookActions, type CardParts } from '../dashboard/NotebookActions';
import { TransferDialogs } from '../portability/StartTransfer';
import { OwnershipMark } from '../sharing/OwnershipMark';
import { useOwnShares } from '../sharing/shares';
import { ShelfCorner } from '../dashboard/ShelfCorner';
import { PageHeading } from '../../shared/components/PageHeading';
import { ShelfCard, formatDay } from '../dashboard/NotebookCard';
import { ShelfSkeleton } from '../../shared/components/skeletons';

/**
 * The notebook models a person reads, in one place (#418, RN-PRT-084): theirs,
 * and the ones shared with them as a model. Each opens its model page, where
 * it is read as it stands, with its history (#431); a new model starts here. Home keeps only the new
 * notebook, blank or from one of these.
 */
export function ModelsPage() {
  const { t, i18n } = useTranslation();
  const locale = intlLocale(i18n.language);
  useDocumentTitle(t('models.title'));
  const [creating, setCreating] = useState(false);
  // The export a card started, with its notebook already chosen (#199).
  const [exporting, setExporting] = useState<string | null>(null);
  // The notebooks of mine, which a model of mine is one of, with the role the
  // API answered for each (RN-ACC-011).
  const notebooks = useQuery({ queryKey: queryKeys.notebooks(), queryFn: listNotebooks });
  const notebooksById = useMemo(
    () => new Map((notebooks.data ?? []).map((notebook) => [notebook.id, notebook])),
    [notebooks.data],
  );
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
      <PageHeading
        title={t('models.title')}
        count={models?.length}
        help={{ page: 'models', text: t('models.help') }}
        action={
          <button
            type="button"
            // The quiet button every page head uses, as Transfers does (#422).
            className="button is-quiet"
            onClick={() => setCreating(true)}
          >
            <ActionWord icon={<PlusIcon />} word={t('models.new')} />
          </button>
        }
      />

      {state === 'error' ? <p className="status">{t(messageKeyOf(query.error))}</p> : null}
      {state === 'pending' ? <ShelfSkeleton /> : null}
      {models?.length === 0 ? <p className="hint">{t('models.empty')}</p> : null}
      {models && models.length > 0 ? (
        <div className="shelf-grid">
          {models.map((model, index) => {
            const parameters = t('models.parameters', { count: model.parameters.length });
            const own = model.sharedBy === null;
            const strip = index % 2 === 0 ? 'blue' : 'orange';
            const day = formatDay(model.updatedAt, locale);
            const card = (parts: {
              strip: CardParts['strip'];
              corner: ReactNode;
              children?: ReactNode;
            }) => (
              <ShelfCard
                seed={model.notebookId}
                strip={parts.strip}
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
                // A model of mine is a notebook of mine, and opens on its
                // overview as every notebook does (#417); one shared as a
                // model reaches no notebook, only the model (#355).
                to={own ? notebookAddress(model.notebookId) : sharedModelAddress(model.notebookId)}
                openLabel={t('models.open')}
                openShort={t('notebooks.openShort')}
                corner={parts.corner}
              >
                {parts.children}
              </ShelfCard>
            );
            // A model of mine is a notebook of mine: its ⋯ exports, shares
            // and deletes it, as the card of the notebook does (#199, #418).
            const notebook = own ? notebooksById.get(model.notebookId) : undefined;
            if (notebook) {
              return (
                <NotebookActions
                  key={model.notebookId}
                  notebook={notebook}
                  strip={strip}
                  onExport={setExporting}
                  sharedByMe={shared.has(model.notebookId)}
                  kind="model"
                  renderCard={card}
                />
              );
            }
            // One shared with me as a model reaches no notebook (#355): whose
            // it is, and nothing to do to it but open it.
            return (
              <Fragment key={model.notebookId}>
                {card({
                  strip,
                  corner: (
                    <ShelfCorner
                      title={model.name}
                      mark={
                        <OwnershipMark
                          ownership="sharedWithMe"
                          owner={model.sharedBy ?? undefined}
                          kind="model"
                        />
                      }
                    >
                      {null}
                    </ShelfCorner>
                  ),
                })}
              </Fragment>
            );
          })}
        </div>
      ) : null}

      <NewModelDialog open={creating} onClose={() => setCreating(false)} />
      <TransferDialogs
        starting={exporting === null ? null : 'export'}
        notebookId={exporting ?? undefined}
        onClose={() => setExporting(null)}
      />
    </section>
  );
}
