/**
 * Aggregate to DTO. The wire shape is the contract package, so the frontend
 * and the backend cannot drift: both import the same schemas.
 */

import type { Role } from '@memorysmith/kernel';
import type {
  ContentDto,
  FolderDto,
  NoteDto,
  NoteSummaryDto,
  NotebookDetailDto,
  NotebookSummaryDto,
} from '@memorysmith/contracts';
import type { Note } from '../../../domain/note/Note.js';
import type { Notebook } from '../../../domain/notebook/Notebook.js';
import type { Folder } from '../../../domain/notebook/Folder.js';

export function folderToDto(folder: Folder, notebook: Notebook): FolderDto {
  return {
    folderId: folder.id.value,
    parentFolderId: folder.parentFolderId?.value ?? null,
    name: folder.name.value,
    slug: folder.slug.value,
    description: folder.description.value,
    position: folder.position.value,
    hasTemplate: folder.hasTemplate,
    noteCount: notebook.noteCountOf(folder.id),
  };
}

export function notebookToSummary(notebook: Notebook, role: Role): NotebookSummaryDto {
  return {
    notebookId: notebook.id.value,
    name: notebook.name.value,
    slug: notebook.slug.value,
    description: notebook.description.value,
    noteCount: notebook.noteCount,
    hasGuidance: notebook.hasGuidance,
    updatedAt: notebook.updatedAt.toISOString(),
    effectiveRole: role.name,
  };
}

export function notebookToDetail(
  notebook: Notebook,
  role: Role,
  guidance: string | null,
): NotebookDetailDto {
  return {
    ...notebookToSummary(notebook, role),
    // The tree in the DEFINED order, which is signal and not decoration (PP9).
    folders: notebook.folders.inOrder().map((folder) => folderToDto(folder, notebook)),
    guidance:
      guidance !== null && notebook.guidanceRef
        ? { content: guidance, revision: notebook.guidanceRef.toJSON() }
        : null,
  };
}

export function noteToSummary(note: Note): NoteSummaryDto {
  return {
    noteId: note.id.value,
    notebookId: note.notebookId.value,
    folderId: note.folderId.value,
    title: note.title,
    position: note.position.value,
    bytes: note.bodyRef.bytes,
    updatedAt: note.updatedBy.at.toISOString(),
    updatedBy: note.updatedBy.toJSON(),
  };
}

export function noteToDto(note: Note, content: string): NoteDto {
  return {
    ...noteToSummary(note),
    content,
    // The revision the caller must echo back as baseRevision (RN-AGT-005).
    revision: note.bodyRef.toJSON(),
    createdBy: note.createdBy.toJSON(),
    deletedAt: note.deletedAt?.toISOString() ?? null,
  };
}

export function contentToDto(content: string, revision: NoteDto['revision']): ContentDto {
  return { content, revision };
}
