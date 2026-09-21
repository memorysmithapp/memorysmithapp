/**
 * Aggregate to DTO. The wire shape is the contract package, so the frontend
 * and the backend cannot drift: both import the same schemas.
 */

import type { ContentRef, Role } from '@memorysmith/kernel';
import type {
  ContentDto,
  FolderDto,
  NoteDto,
  NoteSummaryDto,
  NotebookFileDto,
  NotebookDetailDto,
  NotebookSummaryDto,
} from '@memorysmith/contracts';
import type { Note } from '../../../domain/note/Note.js';
import type { NotebookFile } from '../../../domain/file/NotebookFile.js';
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
    hasTemplate: notebook.hasTemplate(folder.id),
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
  /** The Guidance as its own aggregate answered it, content and revision. */
  guidance: { content: string; ref: ContentRef } | null,
): NotebookDetailDto {
  return {
    ...notebookToSummary(notebook, role),
    // The tree in the DEFINED order, which is signal and not decoration (PP9).
    folders: notebook.folders.inOrder().map((folder) => folderToDto(folder, notebook)),
    guidance: guidance ? { content: guidance.content, revision: guidance.ref.toJSON() } : null,
  };
}

export function noteToSummary(note: Note): NoteSummaryDto {
  return {
    noteId: note.id.value,
    notebookId: note.notebookId.value,
    folderId: note.folderId.value,
    name: note.name,
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

/**
 * A file of a notebook as the API answers it (#166). No URL here: a link is
 * minted when it is asked for, because it expires and a listing that carried
 * one would age in the hands of whoever read it.
 */
export function fileToDto(file: NotebookFile): NotebookFileDto {
  return {
    fileId: file.id.value,
    name: file.name,
    description: file.description,
    mimeType: file.mimeType,
    tags: [...file.tags],
    path: file.path,
    bytes: file.contentRef.bytes,
    sha256: file.contentRef.sha256,
    updatedAt: file.updatedBy.at.toISOString(),
    authorship: file.updatedBy.toJSON(),
  };
}
