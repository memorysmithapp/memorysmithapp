// DTO shapes mirror the future internal API (architecture-guide.md §14.1).
// The seed adapter fills them today; the HTTP client will fill them tomorrow.

export interface VaultSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  noteCount: number;
}

export interface NoteSummary {
  id: string;
  slug: string;
  title: string;
  folderId: string;
}

export interface FolderNode {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  slugPath: string;
  description: string;
  position: number;
  hasTemplate: boolean;
  noteCount: number;
  notes: NoteSummary[];
  children: FolderNode[];
}

export interface VaultStructure {
  vault: VaultSummary;
  guidance: string | null;
  folders: FolderNode[];
}

export interface NoteDetail {
  id: string;
  vaultSlug: string;
  slug: string;
  title: string;
  folderNames: string[];
  frontmatter: Record<string, string>;
  body: string;
  raw: string;
}

export interface TemplateDetail {
  folderId: string;
  body: string;
}
