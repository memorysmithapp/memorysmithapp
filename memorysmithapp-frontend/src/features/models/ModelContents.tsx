import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ModelContentsDto, NotebookModelDto } from '@memorysmithapp/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { getModelContents } from '../../shared/api/source';
import { PageSkeleton } from '../../shared/components/skeletons';
import { ChevronRightIcon } from '../../shared/components/icons';
import { ReadOnlyMarkdown } from '../../shared/components/NoteContent';
import { noteNameOf } from '../../shared/api/markdown';

/** The parameters of a model, as a reader sees them. */
export function ParameterList({ parameters }: { parameters: NotebookModelDto['parameters'] }) {
  const { t } = useTranslation();
  if (parameters.length === 0) return <p className="hint">{t('model.noParameters')}</p>;
  return (
    <ul className="parameter-list">
      {parameters.map((parameter) => (
        <li key={parameter.name}>
          <code>{`{{${parameter.name}}}`}</code> · {t(`model.type.${parameter.type}`)} ·{' '}
          {parameter.required
            ? t('model.parameterRequired')
            : t('model.defaultsTo', {
                value: Array.isArray(parameter.default)
                  ? parameter.default.join(', ')
                  : String(parameter.default ?? ''),
              })}
          {parameter.description ? <span className="hint"> — {parameter.description}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** What a model holds, whoever reads it: the community's read leaves the notebook out. */
export type ModelContentsView = Omit<ModelContentsDto, 'notebookId'>;

/**
 * A model as it stands now (#431): what it writes against what it declares
 * (#354), its parameters, and every part a notebook created from it starts as
 * — the Guidance, each folder with its Template and its notes, the files, the
 * tables with how many rows they carry and the dashboards. A model keeps no
 * frozen version, so this is read live. It is read where the notebook cannot
 * be opened, and a notebook is created from it in New notebook (#435).
 */
export function ModelContents({ contents }: { contents: ModelContentsView }) {
  const { t } = useTranslation();
  const { undeclared, unused } = contents.references;
  const notesOf = (folderId: string) => contents.notes.filter((note) => note.folderId === folderId);

  return (
    <section className="model-contents" aria-labelledby="model-contents-heading">
      <p className="hint">{t('model.contentsHint')}</p>
      <ReferenceWarnings undeclared={undeclared} unused={unused} />

      <h2>{t('model.parameters')}</h2>
      <ParameterList parameters={contents.parameters} />

      {/* Each part an accordion of its own, drawn as a note reads (#439). */}
      <h2 id="model-contents-heading">{t('model.contents')}</h2>
      <Part title={t('structure.guidance')}>
        {contents.notebook.guidance ? (
          <ReadOnlyMarkdown markdown={contents.notebook.guidance} />
        ) : (
          <p className="hint">{t('model.none')}</p>
        )}
      </Part>
      {contents.folders.map((folder) => (
        <Part
          key={folder.folderId}
          title={folder.name}
          hint={t('model.folderNotes', { count: notesOf(folder.folderId).length })}
        >
          {folder.description ? <p className="hint">{folder.description}</p> : null}
          {folder.template ? (
            <Part title={t('folder.template')}>
              <ReadOnlyMarkdown markdown={folder.template} />
            </Part>
          ) : null}
          {notesOf(folder.folderId).map((note) => (
            <Part key={note.noteId} title={noteNameOf(note.body) ?? t('model.untitledNote')}>
              <ReadOnlyMarkdown markdown={note.body} />
            </Part>
          ))}
        </Part>
      ))}
      {contents.files.length > 0 ? (
        <Part title={t('attachments.navLabel')} hint={String(contents.files.length)}>
          <ul className="model-parts">
            {contents.files.map((file) => (
              <li key={file.name}>
                {file.name} · {file.mimeType}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}
      {contents.tables.length > 0 ? (
        <Part title={t('tables.navLabel')} hint={String(contents.tables.length)}>
          <ul className="model-parts">
            {contents.tables.map((table) => (
              <li key={table.name}>
                <strong>{table.name}</strong> · {table.columns.join(', ')} ·{' '}
                {t('tables.rows', { count: table.rows })}
                {table.description ? <span className="hint"> — {table.description}</span> : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}
      {contents.dashboards.length > 0 ? (
        <Part title={t('dashboards.navLabel')} hint={String(contents.dashboards.length)}>
          <ul className="model-parts">
            {contents.dashboards.map((dashboard) => (
              <li key={dashboard.name}>
                <strong>{dashboard.name}</strong>
                {dashboard.description ? (
                  <span className="hint"> — {dashboard.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}
    </section>
  );
}

/** One part of a model, folded, as a card of the Templates of a notebook (#439). */
function Part({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <details className="template-card model-part">
      <summary>
        <ChevronRightIcon className="template-card-chevron" />
        <span className="template-card-title">{title}</span>
        {hint ? <span className="template-card-hint">{hint}</span> : null}
      </summary>
      <div className="template-card-body">{children}</div>
    </details>
  );
}

/** The contents of a model shared with the person as a model reader (#355, #431, #435). */
export function ModelContentsPanel({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const contents = useQuery({
    queryKey: queryKeys.modelContents(notebookId),
    queryFn: () => getModelContents(notebookId),
  });
  if (contents.isPending) return <PageSkeleton />;
  if (contents.isError) return <p className="status">{t(messageKeyOf(contents.error))}</p>;
  return <ModelContents contents={contents.data} />;
}

/**
 * What the notebook writes and the model declares, compared (RN-PRT-064): a
 * reference no parameter answers, which a notebook created from it would
 * keep, and a parameter no text uses.
 */
export function ReferenceWarnings({
  undeclared,
  unused,
}: {
  undeclared: readonly string[];
  unused: readonly string[];
}) {
  const { t } = useTranslation();
  return (
    <>
      {undeclared.length > 0 ? (
        <p className="callout-warning" role="alert">
          {t('model.undeclared', { names: undeclared.map((name) => `{{${name}}}`).join(', ') })}
        </p>
      ) : null}
      {unused.length > 0 ? (
        <p className="hint">{t('model.unused', { names: unused.join(', ') })}</p>
      ) : null}
    </>
  );
}

/**
 * The same comparison where the owner edits the parameters, read from the
 * notebook as it stands: with no Contents tab on the page of one's own model,
 * this is where they learn a reference is answered by nothing (#435).
 */
export function ModelReferences({ notebookId }: { notebookId: string }) {
  const contents = useQuery({
    queryKey: queryKeys.modelContents(notebookId),
    queryFn: () => getModelContents(notebookId),
  });
  if (!contents.data) return null;
  return (
    <ReferenceWarnings
      undeclared={contents.data.references.undeclared}
      unused={contents.data.references.unused}
    />
  );
}
