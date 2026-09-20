/**
 * What each event of the bus does to the projections of one subscription.
 *
 * It lives apart from the Lambda so that a test can feed it the envelope
 * exactly as the relay publishes it, validated by the same contract. A test
 * that built the event by hand is how a move with no content went unnoticed:
 * the hand-made event carried a reference the real one never did (#141).
 */

import type { EventEnvelope } from '@memorysmith/contracts';
import type { ProjectFiles, ProjectNote, ProjectStructure } from '../application/projections.js';

export interface Projectors {
  readonly note: ProjectNote;
  readonly structure: ProjectStructure;
  /** What the notebook keeps beside its notes (#166). */
  readonly files: ProjectFiles;
}

export async function dispatch(projectors: Projectors, envelope: EventEnvelope): Promise<void> {
  const payload = envelope.payload as Record<string, string>;
  const contentRef = envelope.contentRef
    ? { contentId: envelope.contentRef.contentId, versionId: envelope.contentRef.versionId }
    : null;
  const rawVersion = (envelope.payload as Record<string, unknown>)['version'];
  const version = typeof rawVersion === 'number' ? rawVersion : undefined;

  switch (envelope.type) {
    case 'NotebookCreated':
    case 'NotebookRenamed':
      await projectors.structure.onNotebook(String(payload['notebookId']), String(payload['name']));
      break;

    case 'FolderAdded':
    case 'FolderRenamed':
    case 'FolderDescribed':
    case 'FolderMoved':
      await projectors.structure.onFolder(String(payload['notebookId']), {
        folderId: String(payload['folderId']),
        name: String(payload['name'] ?? ''),
        description: String(payload['description'] ?? ''),
        parentFolderId: payload['toParentFolderId'] ?? payload['parentFolderId'] ?? null,
      });
      break;

    case 'FolderRemoved': {
      const removedFolderIds = (envelope.payload['removedFolderIds'] as string[]) ?? [];
      // The notes first: what says a note is invalid is the folder above it,
      // and the folders are what the next line forgets (RN-KNW-046).
      await projectors.note.onFoldersRemoved(String(payload['notebookId']), removedFolderIds);
      await projectors.structure.onFoldersRemoved(String(payload['notebookId']), removedFolderIds);
      break;
    }

    case 'NotebookDeleted':
      await projectors.note.onNotebookDeleted(String(payload['notebookId']));
      await projectors.structure.onNotebookDeleted(String(payload['notebookId']));
      break;

    case 'NotePurged':
      // The purge arrives after the deletion that caused it, so this is almost
      // always a no-op. It is recorded above any version a note reaches, so
      // nothing about the note is projected again, whatever arrives late (#141).
      await projectors.note.project({
        kind: 'purged',
        notebookId: String(payload['notebookId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['folderId']),
        contentRef: null,
      });
      break;

    /**
     * What a notebook keeps beside its notes (#166). It is not indexed and it
     * is no edge: what the graph needs to know is that the NAME answers, so a
     * note referencing it stops being told its picture does not exist.
     */
    case 'FileKept':
      await projectors.files.onKept(String(payload['notebookId']), String(payload['name']));
      break;

    case 'FileDeleted':
      await projectors.files.onDeleted(String(payload['notebookId']), String(payload['name']));
      break;

    case 'NoteCreated':
    case 'NoteUpdated':
      await projectors.note.project({
        kind: 'written',
        notebookId: String(payload['notebookId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['folderId']),
        contentRef,
        version,
      });
      break;

    case 'NoteMoved':
      // The folder is part of the embedded prefix, so a move reindexes the
      // note even though its words did not change (RN-DSC-012).
      await projectors.note.project({
        kind: 'moved',
        notebookId: String(payload['toNotebookId']),
        fromNotebookId: String(payload['fromNotebookId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['toFolderId']),
        contentRef,
        version,
      });
      break;

    case 'NoteDeleted':
      await projectors.note.project({
        kind: 'deleted',
        notebookId: String(payload['notebookId']),
        noteId: String(payload['noteId']),
        folderId: String(payload['folderId']),
        contentRef: null,
        version,
      });
      break;

    default:
      // Everything else on the bus is somebody else's business.
      break;
  }
}
