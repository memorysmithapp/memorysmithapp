import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type {
  ModelContentsDto,
  NotebookModelDto,
  ParameterValueDto,
  TransferDto,
} from '@memorysmithapp/contracts';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { queryKeys } from '../../shared/api/query-keys';
import { createFromModel, getModelContents } from '../../shared/api/source';
import { PageSkeleton } from '../../shared/components/skeletons';
import { CreateFromModelForm } from './CreateFromModel';

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

type Create = (input: {
  name: string;
  values: Record<string, ParameterValueDto>;
}) => Promise<TransferDto>;

/**
 * A model as it stands now (#431): what it writes against what it declares
 * (#354), its parameters, the notebook created from it, and every part such a
 * notebook starts as — the Guidance, each folder with its Template and its
 * notes, the files, the tables with how many rows they carry and the
 * dashboards. A model keeps no frozen version, so this is read live.
 */
export function ModelContents({
  contents,
  create,
}: {
  contents: ModelContentsView;
  create: Create;
}) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const { undeclared, unused } = contents.references;

  return (
    <section className="model-contents" aria-labelledby="model-contents-heading">
      <p className="hint">{t('model.contentsHint')}</p>
      {undeclared.length > 0 ? (
        <p className="callout-warning" role="alert">
          {t('model.undeclared', { names: undeclared.map((name) => `{{${name}}}`).join(', ') })}
        </p>
      ) : null}
      {unused.length > 0 ? (
        <p className="hint">{t('model.unused', { names: unused.join(', ') })}</p>
      ) : null}

      <h2>{t('model.parameters')}</h2>
      <ParameterList parameters={contents.parameters} />

      {creating ? (
        <section className="model-create" aria-label={t('model.create')}>
          <h2>{t('model.create')}</h2>
          <CreateFromModelForm
            parameters={contents.parameters}
            onCancel={() => setCreating(false)}
            create={create}
          />
        </section>
      ) : (
        <p className="model-create">
          <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
            {t('model.create')}
          </button>
        </p>
      )}

      <h2 id="model-contents-heading">{t('model.contents')}</h2>
      <details className="template-card">
        <summary>{t('structure.guidance')}</summary>
        <pre className="model-source">{contents.notebook.guidance ?? t('model.none')}</pre>
      </details>
      {contents.folders.map((folder) => (
        <details key={folder.folderId} className="template-card">
          <summary>
            {folder.name}
            {folder.description ? <span className="hint"> — {folder.description}</span> : null}
          </summary>
          {folder.template ? <pre className="model-source">{folder.template}</pre> : null}
          {contents.notes
            .filter((note) => note.folderId === folder.folderId)
            .map((note) => (
              <pre key={note.noteId} className="model-source">
                {note.body}
              </pre>
            ))}
        </details>
      ))}
      {contents.files.length > 0 ? (
        <>
          <h2>{t('attachments.navLabel')}</h2>
          <ul className="model-parts">
            {contents.files.map((file) => (
              <li key={file.name}>
                {file.name} · {file.mimeType}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {contents.tables.length > 0 ? (
        <>
          <h2>{t('tables.navLabel')}</h2>
          <ul className="model-parts">
            {contents.tables.map((table) => (
              <li key={table.name}>
                <strong>{table.name}</strong> · {table.columns.join(', ')} ·{' '}
                {t('tables.rows', { count: table.rows })}
                {table.description ? <span className="hint"> — {table.description}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {contents.dashboards.length > 0 ? (
        <>
          <h2>{t('dashboards.navLabel')}</h2>
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
        </>
      ) : null}
    </section>
  );
}

/** The contents of a model the person reads, its own or shared as a model reader (#355, #431). */
export function ModelContentsPanel({ notebookId }: { notebookId: string }) {
  const { t } = useTranslation();
  const contents = useQuery({
    queryKey: queryKeys.modelContents(notebookId),
    queryFn: () => getModelContents(notebookId),
  });
  if (contents.isPending) return <PageSkeleton />;
  if (contents.isError) return <p className="status">{t(messageKeyOf(contents.error))}</p>;
  return (
    <ModelContents
      contents={contents.data}
      create={(input) => createFromModel(notebookId, input)}
    />
  );
}
