// DTO shapes mirror the future internal API (architecture-guide.md §14.1).
// The seed adapter fills them today; the HTTP client will fill them tomorrow.

import type { SearchHitDto } from '@memorysmith/contracts';

export interface NotebookSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  noteCount: number;
  /** ISO instant of the last write in the notebook, formatted at the edge. */
  updatedAt: string;
  /** min(subscription role, notebook ceiling), owner above both (RN-ACC-011). */
  effectiveRole: string;
}

export interface NoteSummary {
  id: string;
  /** `null` when the content of the note states no name a link could name. */
  name: string | null;
  folderId: string;
}

export interface FolderNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  position: number;
  hasTemplate: boolean;
  noteCount: number;
  notes: NoteSummary[];
  children: FolderNode[];
}

export interface NotebookStructure {
  notebook: NotebookSummary;
  guidance: string | null;
  /** The revision of the guidance slot, null when nothing is written yet. */
  guidanceRevision: string | null;
  /** min(papel de assinatura, teto do caderno), owner acima dos dois. */
  effectiveRole: string;
  folders: FolderNode[];
}

export interface NoteDetail {
  id: string;
  notebookId: string;
  /** The folder the note lives in, which the breadcrumb reads and no address carries. */
  folderId: string;
  /** `null` when the frontmatter of the note states no name a link could use. */
  name: string | null;
  folderNames: string[];
  frontmatter: Record<string, string>;
  /** Which of those the notebook wrote as a list; they are drawn as chips. */
  listProperties: string[];
  body: string;
  raw: string;
  /** The revision a write has to echo back (RN-AGT-005). */
  revision: string; /** When it last changed, which the history of the note reaches a moment later. */
  updatedAt: string;
}

/**
 * One hit of a notebook search, exactly as the API publishes it. The note is
 * resolved by its identifier against the structure the caller has already
 * loaded; the excerpt is the passage around the match, cut from the text as the
 * author wrote it, and the section is the heading it fell under when it fell
 * under one.
 */
export type SearchHit = SearchHitDto;

export interface TemplateDetail {
  folderId: string;
  body: string;
  /** The revision a write has to echo back (RN-KNW-034). */
  revision: string;
}
