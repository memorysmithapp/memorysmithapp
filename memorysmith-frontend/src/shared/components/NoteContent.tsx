import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  NoteBody,
  defineTheme,
  toggleTaskAt,
  type EmbeddedNote,
  type LinkChoices,
  type NoteStrings,
} from '@memorysmithapp/markdown-renderer';
import '@memorysmithapp/markdown-renderer/styles.css';
import 'katex/dist/katex.min.css';
import {
  folderOfNote,
  getNote,
  notesReaching,
  resolveLinkTarget,
  resolveNoteId,
  resolveNoteUrl,
} from '../api/source';
import { isAttachmentName } from '../api/attachment';
import { linkTargetAddress, noteAddress } from '../api/note-address';
import { queryKeys, type InterfaceQueryKey } from '../api/query-keys';
import { intlLocale } from '../../i18n/intl-locale';
import { effectiveTheme, usePreferences } from '../store/preferences';
import { useWriteStatus } from '../store/write-status';
import { Attachment } from './Attachment';
import { useGroupedWrite, type TaskWriter } from './TaskListWriter';

/**
 * MemorySmith's look, with the frontmatter left to the page (#291). Every page
 * that draws a Content Slot shows its name and its properties where the page
 * decides — above the body on a note, on a cover or a last page in print — so
 * the renderer draws the body alone.
 */
const READING_THEME = defineTheme({ name: 'memorysmith', components: { properties: () => null } });

/** The callout kinds the interface has a word for (#188). */
const CALLOUT_KINDS = [
  'note',
  'info',
  'todo',
  'abstract',
  'summary',
  'tldr',
  'tip',
  'hint',
  'important',
  'success',
  'check',
  'done',
  'question',
  'help',
  'faq',
  'warning',
  'caution',
  'attention',
  'failure',
  'fail',
  'missing',
  'danger',
  'error',
  'bug',
  'example',
  'quote',
  'cite',
] as const;

/**
 * The words of the reading surface in the language of whoever reads, from the
 * locales of the interface: the package carries no language of its own.
 */
export function noteStrings(t: TFunction, locale: string): NoteStrings {
  const callouts: Record<string, string> = {};
  for (const kind of CALLOUT_KINDS) {
    const key = `callout.${kind}`;
    const word = t(key);
    if (word !== key) callouts[kind] = word;
  }
  return {
    callouts,
    properties: t('note.properties'),
    locale,
    yes: t('note.propertyTrue'),
    no: t('note.propertyFalse'),
    footnotes: t('note.footnotes'),
    footnoteBack: (number) => t('note.footnoteBack', { number }),
    pendingLink: t('note.pendingLink'),
    refusedLink: t('note.refusedLink'),
    attachmentMissing: t('note.attachmentMissing'),
    copy: t('note.copy'),
    copied: t('note.copied'),
    remoteImages: (hosts) =>
      t('note.remoteImages', { count: hosts.length, hosts: hosts.join(', ') }),
    linkChoice: (target) => t('note.linkChoice', { target }),
    linkLeadsNowhere: t('note.linkLeadsNowhere'),
    linkLeadsToSeveral: t('note.linkLeadsToSeveral'),
    targetPending: (target) => t('note.targetPending', { target }),
    targetNamed: (target, count) => t('note.targetNamed', { target, count }),
    targetAliased: (target, count) => t('note.targetAliased', { target, count }),
    embedSectionMissing: (section) => t('note.embedSectionMissing', { section }),
    unnamedNote: t('note.unnamed'),
    loading: t('common.loading'),
    failed: t('errors.unexpected'),
    close: t('common.close'),
    cancel: t('common.cancel'),
  };
}

/**
 * A Content Slot drawn by `@memorysmithapp/markdown-renderer` (#291), with
 * task boxes a role that writes can tick.
 *
 * Three surfaces render the same kind of thing — the note, the guidance and
 * the template of a folder — and the package draws all three. What stays here
 * is what belongs to this application: the notebook the names resolve in, the
 * router a link follows, the cache an embed reads through, the words of the
 * locale, and the write of a ticked box.
 *
 * The text written back is the ORIGINAL one: the package reports which box
 * was ticked, `toggleTaskAt` changes that one character, and the grouped
 * writer sends it with the revision it was read at.
 */
export function NoteContent({
  raw,
  notebookId,
  baseRevision,
  writable,
  write,
  invalidates,
}: {
  raw: string;
  notebookId: string;
  baseRevision: string | null;
  writable: boolean;
  write: TaskWriter;
  /**
   * What to read again once this write lands. It is typed as a key this
   * interface actually HOLDS (#170): invalidating a key nobody registered is
   * a silent no-op.
   */
  invalidates: InterfaceQueryKey;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const theme = usePreferences((state) => state.theme);
  const paper = usePreferences((state) => state.paper);
  const scheme = effectiveTheme(theme, paper);

  /**
   * What the screen holds is no longer what the server holds, either because
   * this write landed or because somebody else's did. Both answers are the
   * same: read it again.
   */
  const reload = useCallback(() => {
    void client.invalidateQueries({ queryKey: invalidates });
  }, [client, invalidates]);

  /**
   * The status belongs to the document being read. Leaving it clears the
   * frame, so a message never outlives what it was about.
   */
  useEffect(() => () => useWriteStatus.getState().clear(), []);

  const { text, toggle } = useGroupedWrite({
    raw,
    baseRevision,
    write,
    onWritten: reload,
    onConflict: reload,
  });

  const onToggleTask = useCallback(
    (ordinal: number) => {
      const next = toggleTaskAt(text, ordinal);
      if (next !== null) toggle(next);
    },
    [text, toggle],
  );

  // The language decides the words; `i18n.language` makes the memo follow a
  // change of it, which `t` alone would not.
  const language = i18n.language;
  const strings = useMemo(() => noteStrings(t, intlLocale(language)), [t, language]);

  /**
   * The notes a target no single note answers may lead to, which only
   * Discovery knows, because only it reads the aliases (RN-DSC-046).
   */
  const choose = useCallback(
    async (name: string): Promise<LinkChoices> => {
      const resolved = await client.fetchQuery({
        queryKey: queryKeys.linkTarget(notebookId, name),
        queryFn: () => resolveLinkTarget(notebookId, name),
      });
      return {
        by: resolved.by,
        notes: resolved.notes.map((note) => {
          const folder = folderOfNote(notebookId, note.noteId);
          return {
            name: note.name,
            address: noteAddress(notebookId, note.noteId),
            trail: folder.trail,
            folderDescription: folder.description,
          };
        }),
      };
    },
    [client, notebookId],
  );

  /** An embed expands ONE note, read through the cache the note page reads. */
  const loadNote = useCallback(
    async (name: string): Promise<EmbeddedNote | null> => {
      const noteId = resolveNoteId(notebookId, name);
      if (noteId === null) return null;
      const note = await client.fetchQuery({
        queryKey: queryKeys.note(notebookId, noteId),
        queryFn: () => getNote(notebookId, noteId),
      });
      return { markdown: note.raw, name: note.name, address: noteAddress(notebookId, noteId) };
    },
    [client, notebookId],
  );

  return (
    <NoteBody
      markdown={text}
      resolve={(name) => resolveNoteUrl(notebookId, name)}
      reaches={(name) => notesReaching(notebookId, name).length}
      choose={choose}
      targetAddress={(name) => linkTargetAddress(notebookId, name)}
      navigate={(address) => void navigate(address)}
      loadNote={loadNote}
      keeps={(name) => isAttachmentName(notebookId, name)}
      renderAttachment={({ name, width, height }) => (
        <Attachment notebookId={notebookId} name={name} width={width} height={height} />
      )}
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
      writable={writable}
      onToggleTask={onToggleTask}
      strings={strings}
      theme={READING_THEME}
      scheme={scheme}
    />
  );
}
