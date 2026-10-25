import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ContextChangedDto, NoteContextDto } from '@memorysmithapp/contracts';
import type { AttachProgress, NoteMode } from '@memorysmithapp/markdown-renderer';
import { getNotebookGraph, updateNote } from '../../shared/api/backend';
import { getNote } from '../../shared/api/source';
import { ApiError, messageKeyOf } from '../../shared/api/error-mapper';
import { noteNameOf, withAlias } from '../../shared/api/markdown';
import { queryKeys } from '../../shared/api/query-keys';
import type { NoteDetail } from '../../shared/types/api';
import type { NoteEditing } from '../../shared/components/NoteContent';
import { AttachRefusal, attachFile } from './attach';
import { ATTACH_PORTS } from './attach-ports';
import { NoteSaves, newSessionId, type RenameCost, type SaveWords } from './note-saves';
import { useEditSessions } from '../../shared/store/edit-sessions';

/**
 * A document an edit session writes (#300, #301): a note, the Guidance of a
 * notebook or the Template of a folder — the three Content Slots, each written
 * whole on a revision.
 */
export interface EditedDocument {
  /** What the session belongs to; another one ends it. */
  readonly id: string;
  readonly raw: string;
  /** `null` while the slot does not exist yet, which the first save creates. */
  readonly revision: string | null;
  /** What a file attached from the editor says it was attached to. */
  readonly purpose: string;
}

/** Where the saves of a session go, and what the page reads again after them. */
export interface EditTarget {
  write(input: {
    content: string;
    baseRevision: string | null;
    session: string;
    keepalive: boolean;
  }): Promise<string | { revision: string; contextChanged?: ContextChangedDto }>;
  reload(): Promise<{ raw: string; revision: string }>;
  /** An edit session opened on the document: what it declares is read now. */
  opened?(): void;
  /** The person read that the context changed (RN-KNW-061). */
  acknowledgeContext?(current: NoteContextDto): void;
  /** A save landed; `renamed` when it changed the name the text states. */
  written(renamed: boolean): void;
  /** The session ended with everything written. */
  closed(): void;
  /**
   * What a rename of a note does to the links of the notebook. A Guidance and
   * a Template have no name a link reaches, so they have none, and a save
   * of theirs never says it renamed anything.
   */
  readonly rename?: {
    nameOf(raw: string): string | null;
    withAlias(raw: string, alias: string): string;
    cost(from: string | null, to: string | null): Promise<RenameCost>;
  };
}

/**
 * An edit session of a reading surface (#300, #301, RN-KNW-052, RN-AUD-013).
 *
 * The pencil at the top right of the document opens one: the editor of the
 * reading surface takes the place of the page, every change it hands is saved
 * after a pause, each save a revision carrying the identifier of the session,
 * and going back to reading ends it. A document always opens in reading, and
 * a new click on the pencil opens a new session. Nothing finalises a session,
 * because there is no draft: what was saved is already a revision.
 *
 * While it is open the page stops reading the document again (#206): the
 * editor holds the text, and a read landing under it would replace what the
 * person is typing with somebody else's text without a word. A divergence
 * reaches the person only through the save that finds it.
 *
 * The last pause is not lost: leaving the page sends what is waiting with
 * `keepalive`, the browser asks before closing a tab with a save waiting, and
 * a link inside the product asks first too, through the one guard of the
 * notebook (`useEditSessions`).
 */
export function useEditSession({
  notebookId,
  document,
  target,
}: {
  notebookId: string;
  document: EditedDocument | undefined;
  target: EditTarget;
}): { editing: NoteEditing | undefined; open: boolean } {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [mode, setMode] = useState<NoteMode>('view');
  /** The text the editor starts from, and the host's own changes to it. */
  const [markdown, setMarkdown] = useState('');
  const [pending, setPending] = useState(false);
  const saves = useRef<NoteSaves | null>(null);
  const documentRef = useRef(document);
  documentRef.current = document;
  const targetRef = useRef(target);
  targetRef.current = target;
  const sessionKey = useId();
  const hold = useEditSessions((state) => state.hold);

  const words: SaveWords = {
    conflictTitle: t('editor.conflictTitle'),
    conflictMessage: t('editor.conflictMessage'),
    reload: t('editor.reload'),
    saveAnyway: t('editor.saveAnyway'),
    failedTitle: t('editor.failedTitle'),
    retry: t('editor.retry'),
    renamedTitle: t('editor.renamedTitle'),
    renamed: (from, to, cost) => {
      // Two counts in one sentence, and a plural takes one: each clause is
      // pluralised on its own and then placed (#188).
      const losing = t('editor.renameLosing', { count: cost.losing });
      const gaining = t('editor.renameGaining', { count: cost.gaining });
      if (from === null) return t('editor.named', { to, gaining: capitalised(gaining) });
      if (to === null) return t('editor.unnamed', { losing });
      return t('editor.renamed', { from, to, losing, gaining });
    },
    keepBroken: t('editor.keepBroken'),
    keepAlias: (name) => t('editor.keepAlias', { name }),
    understood: t('editor.understood'),
    contextChangedTitle: t('editor.contextChangedTitle'),
    contextChanged: (changed) =>
      t('editor.contextChanged', {
        parts: changed.map((part) => t(`editor.contextPart.${part}`)).join(', '),
      }),
  };
  const wordsRef = useRef(words);
  wordsRef.current = words;

  /** Ends the session: what is waiting is written, and the page reads the note again. */
  const close = useCallback(() => {
    const ending = saves.current;
    saves.current = null;
    setPending(false);
    if (!ending) return;
    void ending.flush().finally(() => {
      ending.dispose();
      targetRef.current.closed();
    });
  }, []);

  const onModeChange = useCallback(
    (next: NoteMode) => {
      const current = documentRef.current;
      if (next === 'edit' && current) {
        const named = targetRef.current.rename;
        targetRef.current.opened?.();
        saves.current = new NoteSaves(
          {
            write: async ({ content, baseRevision, session, keepalive }) => {
              setPending(true);
              const written = await targetRef.current.write({
                content,
                baseRevision,
                session,
                keepalive,
              });
              return typeof written === 'string' ? { revision: written } : written;
            },
            acknowledgeContext: (current) => targetRef.current.acknowledgeContext?.(current),
            refusalOf: (error) => ({
              code: error instanceof ApiError ? error.code : null,
              currentRevision: currentRevisionOf(error),
              // A refusal of the name names the note that holds it (RN-KNW-042),
              // which is the API's own sentence; the rest is the taxonomy's.
              message:
                error instanceof ApiError && error.code === 'CONFLICT'
                  ? error.message
                  : t(messageKeyOf(error)),
            }),
            reload: () => targetRef.current.reload(),
            replace: setMarkdown,
            nameOf: named ? (raw) => named.nameOf(raw) : () => null,
            withAlias: named ? (raw, alias) => named.withAlias(raw, alias) : (raw) => raw,
            renameCost: named
              ? (from, to) => named.cost(from, to)
              : async () => ({ losing: 0, gaining: 0 }),
            written: (renamed) => {
              setPending(saves.current?.pending ?? false);
              targetRef.current.written(renamed);
            },
            get words() {
              return wordsRef.current;
            },
          },
          { raw: current.raw, revision: current.revision },
          newSessionId(),
        );
        setMarkdown(current.raw);
      } else if (next === 'view') {
        close();
      }
      setMode(next);
    },
    [close, t],
  );

  const onChange = useCallback((text: string) => {
    const session = saves.current;
    if (!session) return undefined;
    setPending(true);
    return session.change(text);
  }, []);

  /**
   * A file the author attached, kept through the upload in parts by URL
   * (RN-PRT-027, RN-KNW-054): hashed a slice at a time and resumed when the
   * connection dropped (RN-KNW-055). The paperclip says each step, and a
   * refusal in the words of the file or the server.
   */
  const attach = useCallback(
    async (
      file: File,
      attributes: { name: string; description: string },
      progress: (report: AttachProgress) => void,
    ): Promise<string> => {
      try {
        const kept = await attachFile(
          ATTACH_PORTS,
          {
            notebookId,
            file,
            name: attributes.name,
            description: attributes.description,
            purpose: documentRef.current?.purpose ?? t('editor.attachPurposeUnnamed'),
          },
          undefined,
          (phase) =>
            progress(
              phase.phase === 'hashing'
                ? {
                    message: t('editor.attachHashing'),
                    ...(phase.total > 0 ? { fraction: phase.read / phase.total } : {}),
                  }
                : {
                    message: t('editor.attachSending', {
                      sent: Math.min(phase.sent + 1, phase.total),
                      total: phase.total,
                    }),
                    ...(phase.total > 0 ? { fraction: phase.sent / phase.total } : {}),
                  },
            ),
        );
        progress({ message: t('editor.attachKept', { name: kept.name }), fraction: 1 });
        // The note reaches the file by name: the list it resolves names from
        // is read again, so the embed draws on the first read.
        await client.invalidateQueries({ queryKey: queryKeys.notebookFiles(notebookId) });
        void client.invalidateQueries({ queryKey: queryKeys.subscriptionUsage() });
        return kept.name;
      } catch (error) {
        throw {
          message:
            error instanceof AttachRefusal
              ? t(`editor.attachRefusal.${error.reason}`)
              : error instanceof ApiError && error.code !== 'INTERNAL'
                ? error.message
                : t(messageKeyOf(error)),
        };
      }
    },
    [client, notebookId, t],
  );

  // Another document, or the page closing: the session ends with what is waiting.
  const documentId = document?.id;
  useEffect(() => {
    setMode('view');
    return () => close();
  }, [documentId, close]);

  /**
   * Leaving the page with a save waiting. `pagehide` fires on a reload, a
   * closed tab and a switch away on a phone, and the request goes out with
   * `keepalive` so the browser finishes it after the page is gone; while a
   * save is waiting, the browser also asks before the tab closes.
   */
  useEffect(() => {
    if (!pending) return;
    const leaving = (): void => void saves.current?.flush({ keepalive: true });
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('pagehide', leaving);
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('pagehide', leaving);
      window.removeEventListener('beforeunload', warn);
    };
  }, [pending]);

  /**
   * A link inside the product, which never reaches `beforeunload`, asks too:
   * the session says it is waiting, and the notebook asks once for all.
   */
  useEffect(() => {
    hold(sessionKey, pending ? () => saves.current?.flush() ?? Promise.resolve() : null);
    return () => hold(sessionKey, null);
  }, [hold, pending, sessionKey]);

  if (!document) return { editing: undefined, open: false };
  return {
    open: mode === 'edit' || pending,
    editing: { mode, onModeChange, onChange, markdown, attach },
  };
}

/** The edit session of the note page (#300): a rename says what it did to the links. */
export function useNoteEditSession({
  notebookId,
  note,
  context,
}: {
  notebookId: string;
  note: NoteDetail | undefined;
  /**
   * The context the page has read for this note — the Guidance, the folder's
   * Template and the structure — declared with each save of a session, as it
   * was when the session opened (RN-KNW-061). Null while it is still loading,
   * which declares nothing.
   */
  context: NoteContextDto | null;
}): { editing: NoteEditing | undefined; open: boolean } {
  const { t } = useTranslation();
  const client = useQueryClient();
  const noteId = note?.id ?? '';
  const readNow = useRef(context);
  readNow.current = context;
  const declared = useRef<NoteContextDto | null>(null);
  return useEditSession({
    notebookId,
    document: note && {
      id: note.id,
      raw: note.raw,
      revision: note.revision,
      purpose: note.name
        ? t('editor.attachPurpose', { note: note.name })
        : t('editor.attachPurposeUnnamed'),
    },
    target: {
      write: async ({ content, baseRevision, session, keepalive }) => {
        const written = await updateNote(
          notebookId,
          noteId,
          {
            content,
            baseRevision: baseRevision ?? '',
            session,
            ...(declared.current ? { context: declared.current } : {}),
          },
          { keepalive },
        );
        return {
          revision: written.revision.versionId,
          ...(written.contextChanged ? { contextChanged: written.contextChanged } : {}),
        };
      },
      opened: () => {
        declared.current = readNow.current;
      },
      acknowledgeContext: (current) => {
        declared.current = current;
      },
      reload: async () => {
        const fresh = await getNote(notebookId, noteId);
        return { raw: fresh.raw, revision: fresh.revision };
      },
      written: (renamed) => {
        void client.invalidateQueries({ queryKey: queryKeys.noteHistory(notebookId, noteId) });
        if (!renamed) return;
        /**
         * The name of a note is the INDEX of the notebook (#170): the tree, the
         * outline, the breadcrumb and every `[[…]]` read it, and so does the
         * alias the rename notice offers to keep.
         */
        void client.invalidateQueries({ queryKey: queryKeys.notebookStructure(notebookId) });
        void client.invalidateQueries({ queryKey: queryKeys.notebookNames(notebookId) });
      },
      closed: () => {
        void client.invalidateQueries({ queryKey: queryKeys.note(notebookId, noteId) });
        void client.invalidateQueries({ queryKey: queryKeys.noteHistory(notebookId, noteId) });
      },
      rename: {
        nameOf: noteNameOf,
        withAlias,
        cost: (from, to) => renameCost(notebookId, noteId, from, to),
      },
    },
  });
}

function capitalised(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/** The revision a divergence states, which *Save anyway* writes on. */
function currentRevisionOf(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== 'CONFLICT') return null;
  const details = error.details as { currentRevision?: unknown } | undefined;
  const revision = details?.currentRevision;
  if (typeof revision === 'string') return revision;
  // The API states a revision as the reference of its content.
  const versionId = (revision as { versionId?: unknown } | undefined)?.versionId;
  return typeof versionId === 'string' ? versionId : null;
}

/**
 * What a rename did to the notebook's links, read from the graph before the
 * index catches up with the new name: the notes that linked to this one, which
 * reached it by its old name and now go pending, and the pending links waiting
 * for the new name, which now resolve.
 */
async function renameCost(
  notebookId: string,
  noteId: string,
  from: string | null,
  to: string | null,
): Promise<RenameCost> {
  const graph = await getNotebookGraph(notebookId);
  const at = graph.nodes.findIndex((node) => node.noteId === noteId);
  const linking = new Set(
    graph.edges
      .filter(([source, target]) => target === at && source !== at)
      .map(([source]) => source),
  );
  const wanted = to?.normalize('NFC');
  const waiting = graph.pending.filter(
    (link) =>
      wanted !== undefined && link.targetName.normalize('NFC') === wanted && link.from !== at,
  );
  return { losing: from === null || at === -1 ? 0 : linking.size, gaining: waiting.length };
}
