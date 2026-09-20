import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import { BookIcon, CheckIcon, CopyIcon, PencilIcon } from '../../shared/components/icons';
import { NoteEditor, type EditOutcome } from './NoteEditor';
import { NoteHistory } from './NoteHistory';
import { withAlias } from '../../shared/api/markdown';
import { ApiError } from '../../shared/api/error-mapper';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../shared/api/query-keys';
import { useBlocker } from 'react-router-dom';
import { folderTrailForNote } from '../structure/trail';
import { NotebookBreadcrumb, folderCrumbs } from '../structure/NotebookBreadcrumb';
import type { NotebookOutletContext } from '../structure/NotebookLayout';
import { useNotebookId } from '../structure/route-ids';

export function NotePage({ noteId }: { noteId: string }) {
  const { t } = useTranslation();
  const notebookId = useNotebookId();
  const { structure } = useOutletContext<NotebookOutletContext>();
  const [copied, setCopied] = useState(false);
  /**
   * Reading or writing (#169). An open book means "you are editing, go back to
   * reading"; a pencil means "you are reading, go and edit". Only somebody
   * whose effective role in this notebook writes ever sees it: a reader gets
   * the copy button alone, never a pencil that would refuse them.
   */
  const [editing, setEditing] = useState(false);
  const [writing, setWriting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  /**
   * Whether the history is open. It is state and not just an attribute of the
   * `<details>` because React renders the children of a closed one anyway:
   * mounted eagerly, the history asked the trail for every note anybody
   * opened, which is a request nobody wanted and, for the length of one
   * defect, the render that took the page down.
   */
  const [historyOpen, setHistoryOpen] = useState(false);
  const client = useQueryClient();

  /**
   * Leaving with typing still in hand asks once (#169). The browser asks its
   * own question when the tab is closing; this is the other half, for a link
   * inside the product, which never reaches `beforeunload` at all. Losing
   * twenty minutes of typing to a misclicked link is the kind of loss that
   * never gets reported as a defect and never gets forgiven either.
   */
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(t('editor.leaveWarning'))) blocker.proceed();
    else blocker.reset();
  }, [blocker, t]);
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.note(notebookId, noteId),
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

  /**
   * The write the editor confirms. It goes through the door that already
   * exists and was paid for twice this cycle (#153, #154): the revision the
   * screen loaded with travels with it, and a divergence means somebody else
   * wrote — which is a sentence and an offer to read it again, not a failure.
   *
   * A rename into a name the folder already holds is refused NAMING the note
   * that holds it (RN-KNW-042), and that refusal is shown as it arrives.
   */
  async function writeNote(outcome: EditOutcome) {
    if (!data) return;
    setWriting(true);
    setRefusal(null);
    const content =
      outcome.keepAlias && data.name ? withAlias(outcome.content, data.name) : outcome.content;
    try {
      await updateNote(notebookId, data.id, {
        content,
        baseRevision: data.revision,
        message: outcome.message.trim(),
      });
      setEditing(false);
      await client.invalidateQueries({ queryKey: queryKeys.note(notebookId, noteId) });
      await client.invalidateQueries({ queryKey: queryKeys.noteHistory(notebookId, noteId) });
      /**
       * The name of a note is the INDEX of the notebook (#170). The structure
       * is what draws the tree, the outline and the breadcrumb, and it is also
       * what `notesReaching` answers out of — so a rename that does not reach
       * here leaves every `[[…]]` in the notebook painting by the name the
       * note used to have: the new one pending though it resolves, the old one
       * resolved though it reaches nothing.
       *
       * The aliases go with it, because the editor offers keeping the old name
       * as one, and that is precisely the case where those links must keep
       * resolving.
       */
      await client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
      await client.invalidateQueries({ queryKey: queryKeys.notebookNames(notebookId) });
    } catch (error) {
      setRefusal(
        error instanceof ApiError
          ? error.code === 'CONFLICT'
            ? t('editor.conflict')
            : error.message
          : t('editor.failed'),
      );
    } finally {
      setWriting(false);
    }
  }

  if (isPending) return <NoteSkeleton />;
  if (isError || !data) return <p className="status">{t('common.notFound')}</p>;

  // The reserved keys first, in the order of the specification, then what the
  // notebook invented, in the order the note wrote it (RN-DSC-051). `name` is
  // drawn above as the name of the note and never as a property.
  const writable = canWrite(structure.effectiveRole);
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
        <div className="note-tools">
          <button
            type="button"
            className={`copy-button${copied ? ' copied' : ''}`}
            onClick={() => void copyNote()}
            title={copied ? t('note.copied') : t('note.copyHint')}
            aria-label={t('note.copy')}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          {writable ? (
            <button
              type="button"
              className="copy-button"
              onClick={() => {
                setRefusal(null);
                setEditing((on) => !on);
              }}
              title={editing ? t('editor.read') : t('editor.edit')}
              aria-label={editing ? t('editor.read') : t('editor.edit')}
            >
              {editing ? <BookIcon /> : <PencilIcon />}
            </button>
          ) : null}
        </div>
      </div>

      {refusal ? <p className="editor-refusal">{refusal}</p> : null}

      {editing ? (
        <NoteEditor
          initial={data.raw}
          currentName={data.name}
          notebookId={notebookId}
          busy={writing}
          onCancel={() => setEditing(false)}
          onConfirm={(outcome) => void writeNote(outcome)}
          onDirty={setDirty}
        />
      ) : null}

      {!editing && properties.length > 0 && (
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

      {editing ? null : (
        <WritableContent
          raw={data.raw}
          notebookId={notebookId}
          baseRevision={data.revision}
          writable={writable}
          write={({ raw, baseRevision, keepalive }) =>
            updateNote(
              notebookId,
              data.id,
              { content: raw, baseRevision: baseRevision ?? '' },
              { keepalive: keepalive ?? false },
            )
          }
          invalidates={queryKeys.note(notebookId, noteId)}
        />
      )}

      {/*
        What happened to this note, and the line each author left about it
        (RN-AUD-012). Closed by default: it is the answer to a question
        somebody asks, never the note itself.
      */}
      <details
        className="history-box"
        open={historyOpen}
        onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
      >
        <summary>{t('history.heading')}</summary>
        {historyOpen ? <NoteHistory notebookId={notebookId} noteId={noteId} /> : null}
      </details>
    </article>
  );
}
