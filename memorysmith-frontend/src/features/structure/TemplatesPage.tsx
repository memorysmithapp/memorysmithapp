import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link, useLocation, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { canWrite, deleteTemplate, getTemplate, putTemplate } from '../../shared/api/source';
import { DeleteContentSlot } from '../../shared/components/DeleteContentSlot';
import { messageKeyOf } from '../../shared/api/error-mapper';
import { folderAddress } from '../../shared/api/note-address';
import { queryState } from '../../shared/api/query-state';
import { TemplateSkeleton } from '../../shared/components/skeletons';
import { WritableContent } from '../../shared/components/WritableContent';
import { useDocumentTitle } from '../../shared/components/document-title';
import type { FolderNode } from '../../shared/types/api';
import { templateAnchor } from './StructureOutline';
import { NotebookBreadcrumb } from './NotebookBreadcrumb';
import type { NotebookOutletContext } from './NotebookLayout';
import { useNotebookId } from './route-ids';
import { queryKeys } from '../../shared/api/query-keys';

interface TemplatedFolder {
  folder: FolderNode;
  path: string[];
}

function collectTemplated(folders: FolderNode[], trail: string[] = []): TemplatedFolder[] {
  return folders.flatMap((folder) => {
    const path = [...trail, folder.name];
    const own = folder.hasTemplate ? [{ folder, path }] : [];
    return [...own, ...collectTemplated(folder.children, path)];
  });
}

// Every Template of the notebook, one per folder that declares one, in folder
// order. The template is the folder's suggested note layout; the server never
// validates against it.
export function TemplatesPage() {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { hash } = useLocation();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const templated = collectTemplated(structure.folders);

  useDocumentTitle(t('structure.templates'), structure.notebook.name);

  const queries = useQueries({
    queries: templated.map(({ folder }) => ({
      queryKey: queryKeys.template(notebookId, folder.id),
      queryFn: () => getTemplate(notebookId, folder.id),
    })),
  });
  const allLoaded = queries.every((q) => !q.isPending);

  useEffect(() => {
    if (!hash || !allLoaded) return;
    const target = document.getElementById(hash.slice(1));
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: 'start' });
  }, [hash, allLoaded]);

  return (
    <article className="content-pane">
      <NotebookBreadcrumb items={[{ label: t('structure.templates') }]} />
      <p className="content-kicker">{t('structure.templates')}</p>
      <h1>{structure.notebook.name}</h1>
      <p className="hint">{t('folder.templateHint')}</p>

      {templated.length === 0 && <p>{t('structure.noTemplates')}</p>}
      {templated.map(({ folder, path }, index) => {
        const query = queries[index];
        const template = query?.data;
        // A card whose template failed to load says so. Falling through to
        // "Loading…" would leave one box of the page waiting forever, and the
        // others answering, which reads as a slow template rather than a
        // failed one.
        const failed = query ? queryState(query) === 'error' : false;
        const anchor = templateAnchor(folder);
        return (
          <details
            key={folder.id}
            id={anchor}
            className="template-box"
            open={hash === `#${anchor}`}
          >
            <summary>
              {path.join(' / ')}
              <Link to={folderAddress(notebookId, folder.id)} className="template-folder-link">
                {t('structure.openFolder')}
              </Link>
            </summary>
            {template ? (
              <>
                <WritableContent
                  raw={template.body}
                  notebookId={notebookId}
                  baseRevision={template.revision}
                  writable={canWrite(structure.effectiveRole)}
                  write={({ raw, baseRevision, keepalive }) =>
                    putTemplate(notebookId, folder.id, raw, baseRevision, {
                      keepalive: keepalive ?? false,
                    })
                  }
                  invalidates={queryKeys.template(notebookId, folder.id)}
                />
                {canWrite(structure.effectiveRole) && (
                  <DeleteContentSlot
                    confirmation={t('folder.deleteTemplateConfirm')}
                    remove={() => deleteTemplate(notebookId, folder.id)}
                    // The list of folders with a Template comes from the
                    // structure, so the card leaves the page with the slot.
                    invalidates={queryKeys.notebookStructure(notebookId)}
                  />
                )}
              </>
            ) : failed ? (
              <p className="status">{t(messageKeyOf(query?.error))}</p>
            ) : (
              <TemplateSkeleton />
            )}
          </details>
        );
      })}
    </article>
  );
}
