import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getNote } from '../../shared/api/source';
import { foldersAddress } from '../../shared/api/note-address';
import { copyText } from '../../shared/lib/clipboard';
import { WritableContent } from '../../shared/components/WritableContent';
import { NoteSkeleton } from '../../shared/components/skeletons';
import { useDocumentTitle } from '../../shared/components/document-title';
import { canWrite, updateNote } from '../../shared/api/source';

import {
  PropertyValue,
  orderedProperties,
  propertyLabel,
  propertyType,
} from '../../shared/components/PropertyValue';
import { CheckIcon, CopyIcon } from '../../shared/components/icons';
import { folderTrailForNote } from '../structure/trail';
import { NotebookBreadcrumb, folderCrumbs } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';

export function NotePage({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const [copied, setCopied] = useState(false);
  const { data, isPending, isError } = useQuery({
    queryKey: ['note', notebookId, noteId],
    queryFn: () => getNote(notebookId, noteId),
  });

  // The tab names the note, with the same unnamed label the listing shows when
  // the note states no name (RN-DSC-058, RN-KNW-036).
  useDocumentTitle(data ? (data.name ?? t('note.unnamed')) : null, structure.notebook.name);

  async function copyNote() {
    if (!data) return;
    await copyText(data.raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isPending) return <NoteSkeleton />;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  // The reserved keys first, in the order of the specification, then what the
  // notebook invented, in the order the note wrote it (RN-DSC-051). `name` is
  // drawn above as the name of the note and never as a property.
  const properties = orderedProperties(
    Object.entries(data.frontmatter).filter(([, value]) => value !== ''),
  );
  const lists = new Set(data.listProperties);

  return (
    <article className="content-pane">
      <div className="note-header">
        <div>
          <NotebookBreadcrumb
            items={[
              { label: t('structure.root'), to: foldersAddress(notebookId) },
              ...folderCrumbs(notebookId, folderTrailForNote(structure.folders, noteId)),
              { label: data.name ?? t('note.unnamed') },
            ]}
          />
          {/**
           * The frame draws the name of the note, ALWAYS, and every heading of
           * the body is an ordinary heading of the note, always (RN-DSC-054).
           * A heading never names a note, so there is nothing to decide here:
           * when the frontmatter states no name, the frame says so where the
           * name would be (RN-KNW-036).
           */}
          <h1 className={data.name === null ? 'note-unnamed' : undefined}>
            {data.name ?? t('note.unnamed')}
          </h1>
        </div>
        <button
          type="button"
          className={`copy-button${copied ? ' copied' : ''}`}
          onClick={() => void copyNote()}
          title={copied ? t('note.copied') : t('note.copyHint')}
          aria-label={t('note.copy')}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>

      {properties.length > 0 && (
        <details className="properties-box" open>
          <summary>{t('note.properties')}</summary>
          <div className="metadata-container">
            {properties.map(([key, value]) => (
              <div
                className="metadata-property"
                data-property-type={propertyType(value, lists.has(key))}
                key={key}
              >
                <span className="metadata-property-key">{propertyLabel(key, t)}</span>
                <span className="metadata-property-value">
                  <PropertyValue value={value} list={lists.has(key)} notebookId={notebookId} />
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <WritableContent
        raw={data.raw}
        notebookId={notebookId}
        baseRevision={data.revision}
        writable={canWrite(structure.effectiveRole)}
        write={({ raw, baseRevision, keepalive }) =>
          updateNote(
            notebookId,
            data.id,
            { content: raw, baseRevision: baseRevision ?? '' },
            { keepalive: keepalive ?? false },
          )
        }
        invalidates={['note', notebookId, noteId]}
      />
    </article>
  );
}
