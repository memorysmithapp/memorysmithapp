import { useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  sameNotebookStyle,
  type NotebookStyle,
  type PrintOrientation,
  type PrintProperties,
  type PrintTables,
  type StyleAlignment,
  type StyleFont,
} from '@memorysmithapp/contracts';
import { setNotebookStyle } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NoteContent } from '../../shared/components/NoteContent';
import { Segmented } from '../../shared/components/Segmented';
import {
  CoverPageIcon,
  EndPageIcon,
  LandscapeIcon,
  NoPropertiesIcon,
  PortraitIcon,
  SansIcon,
  SerifIcon,
  ShrinkIcon,
  WrapTextIcon,
} from '../../shared/components/icons';
import type { NotebookStructure } from '../../shared/types/api';
import { NotebookBar, contextCrumbs } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';

/**
 * The style of a notebook (#493, RN-KNW-092): how every note in it is drawn
 * and printed, set once, for everybody who reads it.
 *
 * A part of the Notebook Context, beside the Guidance, the folders and the
 * Templates: whoever maintains the notebook changes it (RN-KNW-063), and
 * everybody else reads what it is. The sample on the side is a note drawn in
 * the style being chosen, so a choice is seen before it is saved; a passage of
 * one note that differs is a `:::{style}` block in that note.
 */
export function StylePage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const maintains = structure.permissions.maintain;
  const client = useQueryClient();

  useDocumentTitle(t('structure.style'), structure.notebook.name);

  /** What is being chosen, which starts as what the notebook says. */
  const [draft, setDraft] = useState<NotebookStyle>(structure.style);
  const [savedAt, setSavedAt] = useState<NotebookStyle | null>(null);
  const changed = !sameNotebookStyle(draft, structure.style);

  const save = useMutation({
    mutationFn: (style: NotebookStyle) => setNotebookStyle(notebookId, style),
    onSuccess: (style) => {
      client.setQueryData<NotebookStructure>(queryKeys.notebookStructure(notebookId), (current) =>
        current ? { ...current, style } : current,
      );
      void client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
      setDraft(style);
      setSavedAt(style);
    },
  });

  const choose = <K extends keyof NotebookStyle>(key: K, value: NotebookStyle[K]) => {
    setSavedAt(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const align = (value: StyleAlignment) => ({
    value,
    label: t(`style.align.${value}`),
    disabled: !maintains,
  });
  const alignments = (['left', 'center', 'right', 'justify'] as const).map(align);

  return (
    <>
      <NotebookBar crumbs={contextCrumbs(notebookId, t, t('structure.style'))} />
      <article className="content-pane is-wide style-page">
        <p className="page-intro">{t(maintains ? 'style.intro' : 'style.introReader')}</p>
        <div className="style-layout">
          <form
            className="style-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (maintains && changed && !save.isPending) save.mutate(draft);
            }}
          >
            <fieldset className="style-group">
              <legend>{t('style.screen')}</legend>
              <Setting label={t('style.font')}>
                <Segmented<StyleFont>
                  label={t('style.font')}
                  value={draft.font}
                  onChange={(value) => choose('font', value)}
                  options={[
                    {
                      value: 'sans',
                      label: t('style.fonts.sans'),
                      icon: <SansIcon />,
                      disabled: !maintains,
                    },
                    {
                      value: 'serif',
                      label: t('style.fonts.serif'),
                      icon: <SerifIcon />,
                      disabled: !maintains,
                    },
                  ]}
                />
              </Setting>
              <Setting label={t('style.headings')}>
                <Segmented<StyleAlignment>
                  label={t('style.headings')}
                  value={draft.headings}
                  onChange={(value) => choose('headings', value)}
                  options={alignments}
                />
              </Setting>
              <Setting label={t('style.text')}>
                <Segmented<StyleAlignment>
                  label={t('style.text')}
                  value={draft.text}
                  onChange={(value) => choose('text', value)}
                  options={alignments}
                />
              </Setting>
              <Setting label={t('style.tables')} hint={t('style.tablesHint')}>
                <Segmented<StyleAlignment>
                  label={t('style.tables')}
                  value={draft.tables}
                  onChange={(value) => choose('tables', value)}
                  options={alignments}
                />
              </Setting>
            </fieldset>

            <fieldset className="style-group">
              <legend>{t('style.print')}</legend>
              <Setting label={t('style.properties')}>
                <Segmented<PrintProperties>
                  label={t('style.properties')}
                  value={draft.properties}
                  onChange={(value) => choose('properties', value)}
                  options={[
                    {
                      value: 'cover',
                      label: t('style.placement.cover'),
                      icon: <CoverPageIcon />,
                      disabled: !maintains,
                    },
                    {
                      value: 'end',
                      label: t('style.placement.end'),
                      icon: <EndPageIcon />,
                      disabled: !maintains,
                    },
                    {
                      value: 'none',
                      label: t('style.placement.none'),
                      icon: <NoPropertiesIcon />,
                      disabled: !maintains,
                    },
                  ]}
                />
              </Setting>
              <Setting label={t('style.orientation')}>
                <Segmented<PrintOrientation>
                  label={t('style.orientation')}
                  value={draft.orientation}
                  onChange={(value) => choose('orientation', value)}
                  options={orientations(t, maintains)}
                />
              </Setting>
              <Setting label={t('style.printTables')}>
                <Segmented<PrintTables>
                  label={t('style.printTables')}
                  value={draft.printTables}
                  onChange={(value) => choose('printTables', value)}
                  options={[
                    {
                      value: 'wrap',
                      label: t('style.fit.wrap'),
                      icon: <WrapTextIcon />,
                      disabled: !maintains,
                    },
                    {
                      value: 'shrink',
                      label: t('style.fit.shrink'),
                      icon: <ShrinkIcon />,
                      disabled: !maintains,
                    },
                  ]}
                />
              </Setting>
            </fieldset>

            {maintains ? (
              <div className="style-actions">
                <p className="style-status" role="status">
                  {save.isError
                    ? t(messageKeyOf(save.error))
                    : savedAt && !changed
                      ? t('style.saved')
                      : changed
                        ? t('style.unsaved')
                        : ''}
                </p>
                <button
                  type="button"
                  className="button is-quiet"
                  disabled={!changed || save.isPending}
                  onClick={() => {
                    setSavedAt(null);
                    setDraft(structure.style);
                  }}
                >
                  {t('style.undo')}
                </button>
                <button
                  type="submit"
                  className="button is-primary"
                  disabled={!changed || save.isPending}
                >
                  {save.isPending ? t('style.saving') : t('style.save')}
                </button>
              </div>
            ) : null}
          </form>

          <section className="style-sample" aria-label={t('style.sampleLabel')}>
            <p className="style-sample-label">{t('style.sampleLabel')}</p>
            <NoteContent
              raw={t('style.sample')}
              notebookId={notebookId}
              baseRevision={null}
              writable={false}
              write={() => Promise.reject(new Error('A sample writes nothing.'))}
              invalidates={queryKeys.notebookStructure(notebookId)}
              actions={false}
              noteStyle={draft}
            />
          </section>
        </div>
      </article>
    </>
  );
}

function orientations(
  t: (key: string) => string,
  maintains: boolean,
): Array<{ value: PrintOrientation; label: string; icon: ReactNode; disabled: boolean }> {
  return [
    {
      value: 'portrait',
      label: t('style.orient.portrait'),
      icon: <PortraitIcon />,
      disabled: !maintains,
    },
    {
      value: 'landscape',
      label: t('style.orient.landscape'),
      icon: <LandscapeIcon />,
      disabled: !maintains,
    },
  ];
}

/** One setting: its name over its choices, and what it means when it needs saying. */
function Setting({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="style-setting">
      <span className="style-setting-label" aria-hidden="true">
        {label}
      </span>
      {children}
      {hint ? <p className="style-setting-hint">{hint}</p> : null}
    </div>
  );
}
