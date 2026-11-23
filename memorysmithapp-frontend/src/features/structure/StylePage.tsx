import { useState, type ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  sameNotebookStyle,
  type NotebookStyle,
  type PrintOrientation,
  type PrintTables,
  type StyleAlignment,
  type StyleFont,
  type StyleNumbering,
} from '@memorysmithapp/contracts';
import { setNotebookStyle } from '../../shared/api/source';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NoteContent } from '../../shared/components/NoteContent';
import { Segmented } from '../../shared/components/Segmented';
import {
  AppendixIcon,
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
import {
  CONTENTS_LISTS,
  contentsForm,
  contentsOfForm,
  keysOf,
  propertiesForm,
  propertiesOfForm,
  type ContentsForm,
  type PropertiesForm,
  type Where,
} from './style-settings';
import { Button } from '../../shared/components/Button';

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
  /** The keys drawn, as typed: a comma between two keys, none for all of them (#530). */
  const [keysText, setKeysText] = useState(() => keysTextOf(structure.style));
  const properties = propertiesForm(draft.properties);
  const contents = contentsForm(draft.contents);

  const save = useMutation({
    mutationFn: (style: NotebookStyle) => setNotebookStyle(notebookId, style),
    onSuccess: (style) => {
      client.setQueryData<NotebookStructure>(queryKeys.notebookStructure(notebookId), (current) =>
        current ? { ...current, style } : current,
      );
      void client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
      setDraft(style);
      setKeysText(keysTextOf(style));
      setSavedAt(style);
    },
  });

  const choose = <K extends keyof NotebookStyle>(key: K, value: NotebookStyle[K]) => {
    setSavedAt(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };
  /** A change of the properties (#530) or of the contents (#521), kept in the renderer's structure. */
  const setProperties = (change: Partial<PropertiesForm>) =>
    choose('properties', propertiesOfForm({ ...properties, ...change }, draft.properties));
  const setContents = (change: Partial<ContentsForm>) =>
    choose('contents', contentsOfForm({ ...contents, ...change }, draft.contents));
  const where = (prefix: string, order: readonly Where[], icons?: Record<Where, ReactNode>) =>
    order.map((value) => ({
      value,
      label: t(`${prefix}.${value}`),
      ...(icons ? { icon: icons[value] } : {}),
      disabled: !maintains,
    }));
  const placeIcons: Record<Where, ReactNode> = {
    start: <CoverPageIcon />,
    end: <EndPageIcon />,
    none: <NoPropertiesIcon />,
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
              <Setting label={t('style.numbering')}>
                <Segmented<StyleNumbering>
                  label={t('style.numbering')}
                  value={draft.numbering}
                  onChange={(value) => choose('numbering', value)}
                  options={(['none', 'decimal'] as const).map((value) => ({
                    value,
                    label: t(`style.numberings.${value}`),
                    disabled: !maintains,
                  }))}
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
              {draft.text === 'justify' || draft.tables === 'justify' ? (
                <Setting label={t('style.hyphenate')} hint={t('style.hyphenateHint')}>
                  <Segmented<'off' | 'on'>
                    label={t('style.hyphenate')}
                    value={draft.hyphenate ? 'on' : 'off'}
                    onChange={(value) => choose('hyphenate', value === 'on')}
                    options={[
                      { value: 'off', label: t('style.hyphens.off'), disabled: !maintains },
                      { value: 'on', label: t('style.hyphens.on'), disabled: !maintains },
                    ]}
                  />
                </Setting>
              ) : null}
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
              <legend>{t('style.properties')}</legend>
              <p className="style-setting-hint">{t('style.propertiesHint')}</p>
              <Setting label={t('style.onScreen')}>
                <Segmented<Where>
                  label={`${t('style.properties')} · ${t('style.onScreen')}`}
                  value={properties.screen}
                  onChange={(value) => setProperties({ screen: value })}
                  options={where('style.placement', ['start', 'end', 'none'], placeIcons)}
                />
              </Setting>
              <Setting label={t('style.inPrint')}>
                <Segmented<Where>
                  label={`${t('style.properties')} · ${t('style.inPrint')}`}
                  value={properties.print}
                  onChange={(value) => setProperties({ print: value })}
                  options={where('style.placement', ['start', 'end', 'none'], placeIcons)}
                />
              </Setting>
              {properties.screen === 'none' && properties.print === 'none' ? null : (
                <>
                  <label className="field style-field">
                    <span className="field-label">{t('style.propertyKeys')}</span>
                    <input
                      type="text"
                      value={keysText}
                      disabled={!maintains}
                      placeholder={t('style.propertyKeysAll')}
                      onChange={(event) => {
                        setKeysText(event.target.value);
                        setProperties({ keys: keysOf(event.target.value) });
                      }}
                    />
                    <span className="field-hint">{t('style.propertyKeysHint')}</span>
                  </label>
                  <label className="field style-field">
                    <span className="field-label">{t('style.propertiesTitle')}</span>
                    <input
                      type="text"
                      value={properties.title ?? ''}
                      maxLength={120}
                      disabled={!maintains}
                      onChange={(event) =>
                        setProperties({
                          title: event.target.value.trim() === '' ? null : event.target.value,
                        })
                      }
                    />
                    <span className="field-hint">{t('style.propertiesTitleHint')}</span>
                  </label>
                  {properties.screen === 'none' ? null : (
                    <Setting label={t('style.fold')}>
                      <Segmented<'open' | 'closed'>
                        label={t('style.fold')}
                        value={properties.fold}
                        onChange={(value) => setProperties({ fold: value })}
                        options={(['open', 'closed'] as const).map((value) => ({
                          value,
                          label: t(`style.folds.${value}`),
                          disabled: !maintains,
                        }))}
                      />
                    </Setting>
                  )}
                </>
              )}
            </fieldset>

            <fieldset className="style-group">
              <legend>{t('style.contents')}</legend>
              <p className="style-setting-hint">{t('style.contentsHint')}</p>
              <Setting label={t('style.onScreen')}>
                <Segmented<Where>
                  label={`${t('style.contents')} · ${t('style.onScreen')}`}
                  value={contents.screen}
                  onChange={(value) => setContents({ screen: value })}
                  options={where('style.contentsPlacement', ['none', 'start', 'end'])}
                />
              </Setting>
              <Setting label={t('style.inPrint')}>
                <Segmented<Where>
                  label={`${t('style.contents')} · ${t('style.inPrint')}`}
                  value={contents.print}
                  onChange={(value) => setContents({ print: value })}
                  options={where('style.contentsPlacement', ['none', 'start', 'end'])}
                />
              </Setting>
              {contents.screen === 'none' && contents.print === 'none' ? null : (
                <div className="style-setting">
                  <span className="style-setting-label">{t('style.contentsLists')}</span>
                  {CONTENTS_LISTS.map((list) => (
                    <label className="style-check" key={list}>
                      <input
                        type="checkbox"
                        checked={contents.lists[list]}
                        disabled={!maintains}
                        onChange={(event) =>
                          setContents({
                            lists: { ...contents.lists, [list]: event.target.checked },
                          })
                        }
                      />
                      {t(`style.lists.${list}`)}
                      {list === 'headings' && contents.lists.headings ? (
                        <select
                          aria-label={t('style.contentsDepth')}
                          value={contents.depth}
                          disabled={!maintains}
                          onChange={(event) => setContents({ depth: Number(event.target.value) })}
                        >
                          {[1, 2, 3, 4, 5, 6].map((depth) => (
                            <option key={depth} value={depth}>
                              {t('style.depth', { count: depth })}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </label>
                  ))}
                  <p className="style-setting-hint">{t('style.contentsPagesHint')}</p>
                  {contents.print === 'none' ? null : (
                    <label className="style-check">
                      <input
                        type="checkbox"
                        checked={draft.contentsPages}
                        disabled={!maintains}
                        onChange={(event) => choose('contentsPages', event.target.checked)}
                      />
                      {t('style.contentsOwnPages')}
                    </label>
                  )}
                </div>
              )}
            </fieldset>

            <fieldset className="style-group">
              <legend>{t('style.print')}</legend>
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
                    {
                      value: 'appendices',
                      label: t('style.fit.appendices'),
                      icon: <AppendixIcon />,
                      disabled: !maintains,
                    },
                  ]}
                />
              </Setting>
              {draft.printTables === 'appendices' ? (
                <Setting label={t('style.appendixOrientation')} hint={t('style.appendicesHint')}>
                  <Segmented<'document' | PrintOrientation>
                    label={t('style.appendixOrientation')}
                    value={draft.appendixOrientation ?? 'document'}
                    onChange={(value) =>
                      choose('appendixOrientation', value === 'document' ? null : value)
                    }
                    options={[
                      {
                        value: 'document',
                        label: t('style.orient.document'),
                        disabled: !maintains,
                      },
                      ...orientations(t, maintains),
                    ]}
                  />
                </Setting>
              ) : null}
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
                <Button
                  variant="quiet"
                  disabled={!changed || save.isPending}
                  onClick={() => {
                    setSavedAt(null);
                    setDraft(structure.style);
                    setKeysText(keysTextOf(structure.style));
                  }}
                >
                  {t('style.undo')}
                </Button>
                <Button type="submit" variant="primary" disabled={!changed || save.isPending}>
                  {save.isPending ? t('style.saving') : t('style.save')}
                </Button>
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

/** The keys a style prints, as the field shows them. */
function keysTextOf(style: NotebookStyle): string {
  return propertiesForm(style.properties).keys?.join(', ') ?? '';
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
