import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { modelAddress, notebookAddress } from '../../shared/api/note-address';
import { queryKeys } from '../../shared/api/query-keys';
import { getModelVersion } from '../../shared/api/source';
import { useDocumentTitle } from '../../shared/components/document-title';
import { NotebookBar } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';
import { CreateFromModelForm } from './CreateFromModel';
import { ParameterList } from './ModelPage';

/**
 * A version of a model, read whole (#353): what it froze — its changelog, its
 * parameters, the Guidance, every folder with its Template, every note and
 * file — and what it writes against what it declares (#354). It is what the
 * owner reviews before sharing it, and where a notebook is created from it.
 */
export function ModelVersionPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const number = Number(useParams().version);
  const { structure } = useOutletContext<NotebookOutletContext>();
  const [creating, setCreating] = useState(false);
  useDocumentTitle(t('model.versionTitle', { number }), structure.notebook.name);
  const version = useQuery({
    queryKey: queryKeys.modelVersion(notebookId, number),
    queryFn: () => getModelVersion(notebookId, number),
  });

  const crumbs = [
    { label: t('structure.heading'), to: notebookAddress(notebookId) },
    { label: t('model.title'), to: modelAddress(notebookId) },
    { label: `v${number}` },
  ];

  if (version.isPending) {
    return (
      <>
        <NotebookBar crumbs={crumbs} />
        <p className="hint">{t('common.loading')}</p>
      </>
    );
  }
  if (version.isError || !version.data) {
    return (
      <>
        <NotebookBar crumbs={crumbs} />
        <p className="status">{t(messageKeyOf(version.error))}</p>
      </>
    );
  }
  const view = version.data;
  const { undeclared, unused } = view.references;

  return (
    <>
      <NotebookBar crumbs={crumbs} />
      <article className="content-pane model-version-page">
        <h1>{t('model.versionTitle', { number })}</h1>
        {view.version.changelog ? <p className="page-intro">{view.version.changelog}</p> : null}
        <p>
          <strong>{t('model.objective')}:</strong> {view.objective}
        </p>
        {undeclared.length > 0 ? (
          <p className="callout-warning" role="alert">
            {t('model.undeclared', { names: undeclared.map((name) => `{{${name}}}`).join(', ') })}
          </p>
        ) : null}
        {unused.length > 0 ? (
          <p className="hint">{t('model.unused', { names: unused.join(', ') })}</p>
        ) : null}

        <h2>{t('model.parameters')}</h2>
        <ParameterList parameters={view.parameters} />

        {creating ? (
          <section className="model-create" aria-label={t('model.create')}>
            <h2>{t('model.create')}</h2>
            <CreateFromModelForm
              notebookId={notebookId}
              version={number}
              parameters={view.parameters}
              onCancel={() => setCreating(false)}
            />
          </section>
        ) : (
          <button type="button" className="button is-primary" onClick={() => setCreating(true)}>
            {t('model.create')}
          </button>
        )}

        <h2>{t('model.contents')}</h2>
        <details className="template-card">
          <summary>{t('structure.guidance')}</summary>
          <pre className="model-source">{view.notebook.guidance ?? t('model.none')}</pre>
        </details>
        {view.folders.map((folder) => (
          <details key={folder.folderId} className="template-card">
            <summary>
              {folder.name}
              <span className="hint"> — {folder.description}</span>
            </summary>
            {folder.template ? <pre className="model-source">{folder.template}</pre> : null}
            {view.notes
              .filter((note) => note.folderId === folder.folderId)
              .map((note) => (
                <pre key={note.noteId} className="model-source">
                  {note.body}
                </pre>
              ))}
          </details>
        ))}
        {view.files.length > 0 ? (
          <>
            <h2>{t('attachments.navLabel')}</h2>
            <ul>
              {view.files.map((file) => (
                <li key={file.name}>
                  {file.name} · {file.mimeType}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </article>
    </>
  );
}
