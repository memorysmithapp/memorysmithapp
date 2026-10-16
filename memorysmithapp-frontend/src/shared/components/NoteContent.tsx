import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ENGLISH,
  NoteBody,
  defineTheme,
  toggleTaskAt,
  type AttachAttributes,
  type AttachProgress,
  type EditorWords,
  type EmbeddedNote,
  type KeptFile,
  type KeptFileEntry,
  type LinkChoices,
  type NoteMode,
  type NoteStrings,
} from '@memorysmithapp/markdown-renderer';
import { FILE_MIME_TYPES, rendersAs, type NotebookFileDto } from '@memorysmithapp/contracts';
import '@memorysmithapp/markdown-renderer/styles.css';
import 'katex/dist/katex.min.css';
import {
  fileKept,
  folderOfNote,
  getNote,
  getNotebookFiles,
  linkToFile,
  noteNamesIn,
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
import { fileKindKey } from './file-kind';
import { useTaskWrite, type TaskWriter } from './TaskListWriter';

/** What the page draws where the renderer draws the frontmatter (#300). */
const NoteHeader = createContext<ReactNode>(null);

function NoteHeaderSlot() {
  return <>{useContext(NoteHeader)}</>;
}

/**
 * MemorySmith's look, with the frontmatter left to the page (#291). Every page
 * that draws a Content Slot shows its name and its properties where the page
 * decides — above the body on a note, on a cover or a last page in print — so
 * the renderer draws in their place only what the page hands it as `header`:
 * after the corner of the note, so *Show Markdown*, *Copy* and *Edit* stand
 * above the name and not between the properties and the text (#300).
 */
const READING_THEME = defineTheme({
  name: 'memorysmith',
  components: { properties: NoteHeaderSlot },
});

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
    attachmentOpen: t('note.attachmentOpen'),
    attachmentDownload: t('note.attachmentDownload'),
    fileKinds: Object.fromEntries(
      FILE_MIME_TYPES.map((mimeType) => [mimeType, t(fileKindKey(mimeType))]),
    ),
    updating: t('noteEditor.updating'),
    saved: t('write.saved'),
    notSaved: t('noteEditor.notSaved'),
    edit: t('editor.editShort'),
    view: t('editor.readShort'),
    editUnavailable: t('noteEditor.editUnavailable'),
    editor: editorWords(t),
    loading: t('common.loading'),
    failed: t('errors.unexpected'),
    close: t('common.close'),
    cancel: t('common.cancel'),
  };
}

/**
 * The words of the editor (#300), each under `noteEditor` in the locales. The
 * package names every one it needs, so the list is read from its English and
 * a word added to it reaches a locale test before it reaches a person in
 * English.
 */
export function editorWords(t: TFunction): EditorWords {
  const words: Record<string, unknown> = {};
  for (const key of Object.keys(ENGLISH.editor)) {
    words[key] = key === 'attachQueued' ? undefined : t(`noteEditor.${key}`);
  }
  return {
    ...(words as unknown as EditorWords),
    attachQueued: (count: number) => t('noteEditor.attachQueued', { count }),
  };
}

/** The keys of the editor's words, which every locale carries (#300). */
export const EDITOR_WORD_KEYS = Object.keys(ENGLISH.editor);

/**
 * What the note page gives the editor (#300): the mode it controls, and where
 * each change goes. Without it a surface is read only, as every other surface
 * that draws a Content Slot is.
 */
export interface NoteEditing {
  readonly mode: NoteMode;
  readonly onModeChange: (mode: NoteMode) => void;
  /** Each change of the text; answered with the promise of its save. */
  readonly onChange: (markdown: string) => unknown;
  /**
   * The text the editor starts from and the host's own changes to it — their
   * version after a conflict, the note with an alias — which the editor takes
   * in as changes. Never the echo of what was typed.
   */
  readonly markdown: string;
  /** Keeps a file the author attached, and answers its name. */
  readonly attach: (
    file: File,
    attributes: AttachAttributes,
    progress: (report: AttachProgress) => void,
  ) => Promise<string>;
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
  actions = true,
  editing,
  header,
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
  /**
   * Whether the note offers *Show Markdown* and *Copy Markdown* at its top
   * right (#300): reading a note's Markdown and copying it are reading, so
   * every role has them. A preview and a print, which are pictures of the
   * note, turn them off.
   */
  actions?: boolean;
  /** The editor, where the page offers one (#300). */
  editing?: NoteEditing;
  /** The name and the properties the page draws under the corner of the note, in reading. */
  header?: ReactNode;
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

  const { text, toggle } = useTaskWrite({
    raw,
    baseRevision,
    write,
    onWritten: reload,
    onConflict: reload,
  });

  /**
   * The promise of the write, which the item waits on under *Updating…*
   * (#300). The package asks for the next tick only once this one settled.
   */
  const onToggleTask = useCallback(
    (ordinal: number): Promise<void> | undefined => {
      const next = toggleTaskAt(text, ordinal);
      return next === null ? undefined : toggle(next);
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

  /**
   * A kept file, described for the package to draw it by its type (#300): an
   * image, a player or a card. The bytes come from a link minted for it, which
   * points at the files host and never at the API.
   */
  const fileOf = useCallback(
    async (name: string): Promise<KeptFile | null> => {
      const file = fileKept(notebookId, name);
      if (!file) return null;
      return keptFile(file, await linkOf(client, notebookId, file));
    },
    [client, notebookId],
  );

  /**
   * The files the attach dialog lists. Only a picture is shown there, so only
   * a picture is given an address: minting one for every recording and
   * document of a notebook to draw a list of names would be a request each.
   */
  const files = useCallback(async (): Promise<KeptFileEntry[]> => {
    const kept = await client.fetchQuery({
      queryKey: queryKeys.notebookFiles(notebookId),
      queryFn: () => getNotebookFiles(notebookId),
    });
    return Promise.all(
      kept.map(async (file) => ({
        name: file.name,
        ...keptFile(
          file,
          rendersAs(file.mimeType) === 'image'
            ? await linkOf(client, notebookId, file).catch(() => null)
            : null,
        ),
      })),
    );
  }, [client, notebookId]);

  /** The names offered after `[[`: those that start with what was typed, then those that hold it. */
  const suggest = useCallback(
    (query: string): string[] => suggestNames(noteNamesIn(notebookId), query),
    [notebookId],
  );

  return (
    <NoteHeader.Provider value={header ?? null}>
      <NoteBody
        markdown={editing?.mode === 'edit' ? editing.markdown : text}
        resolve={(name) => resolveNoteUrl(notebookId, name)}
        reaches={(name) => notesReaching(notebookId, name).length}
        choose={choose}
        targetAddress={(name) => linkTargetAddress(notebookId, name)}
        navigate={(address) => void navigate(address)}
        loadNote={loadNote}
        keeps={(name) => isAttachmentName(notebookId, name)}
        fileOf={fileOf}
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
        actions={actions}
        {...(editing
          ? {
              editable: true,
              mode: editing.mode,
              onModeChange: editing.onModeChange,
              onChange: editing.onChange,
              attach: editing.attach,
              files,
              suggest,
            }
          : {})}
      />
    </NoteHeader.Provider>
  );
}

/** How many names `[[` offers at most. */
const SUGGESTIONS = 12;

/**
 * The names of notes that start with what was typed, then those that hold it,
 * each group in the order of the notebook; compared after NFC and without
 * regard to case, so *ata* finds *Ata 12*.
 */
export function suggestNames(names: readonly string[], query: string): string[] {
  const wanted = query.normalize('NFC').trim().toLocaleLowerCase();
  const unique = [...new Set(names)];
  if (wanted.length === 0) return unique.slice(0, SUGGESTIONS);
  const key = (name: string) => name.normalize('NFC').toLocaleLowerCase();
  const starting = unique.filter((name) => key(name).startsWith(wanted));
  const holding = unique.filter(
    (name) => !key(name).startsWith(wanted) && key(name).includes(wanted),
  );
  return [...starting, ...holding].slice(0, SUGGESTIONS);
}

/** The link to a kept file, through the cache every surface reads it from. */
function linkOf(
  client: ReturnType<typeof useQueryClient>,
  notebookId: string,
  file: NotebookFileDto,
) {
  return client.fetchQuery({
    queryKey: queryKeys.fileLink(notebookId, file.fileId),
    queryFn: () => linkToFile(notebookId, file.fileId),
    // A link lasts an hour; asking again halfway through is cheaper than
    // finding out it expired while somebody was reading.
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * A kept file as the package draws it, by its type; the package offers *Open*
 * only for a type a browser shows (#171), as this page did.
 */
function keptFile(
  file: NotebookFileDto,
  link: { url: string; downloadUrl: string } | null,
): KeptFile {
  return {
    mimeType: file.mimeType,
    bytes: file.bytes,
    url: link?.url ?? '',
    ...(link ? { downloadUrl: link.downloadUrl } : {}),
    ...(file.description.length > 0 ? { description: file.description } : {}),
  };
}
