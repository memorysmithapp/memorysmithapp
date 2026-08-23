// The API surface the UI consumes. Today every function is backed by the seed
// adapter; wiring the real backend means swapping these bodies for HTTP calls
// without touching any component.

import type { FolderNode, NoteDetail, TemplateDetail, VaultStructure, VaultSummary } from '../types/api';
import { guidanceDescription, guidanceTitle, splitFrontmatter } from './markdown';
import { seedVaults, type SeedFolder, type SeedVault } from './seed-source';

function vaultNoteCount(vault: SeedVault): number {
  return vault.notesBySlug.size;
}

async function toSummary(vault: SeedVault): Promise<VaultSummary> {
  const guidance = vault.guidance ? await vault.guidance() : null;
  return {
    id: vault.slug,
    slug: vault.slug,
    name: guidance ? guidanceTitle(guidance, vault.slug) : vault.slug,
    description: guidance ? guidanceDescription(guidance) : '',
    noteCount: vaultNoteCount(vault),
  };
}

export async function listVaults(): Promise<VaultSummary[]> {
  const vaults = [...seedVaults().values()];
  return Promise.all(vaults.map(toSummary));
}

async function toFolderNode(folder: SeedFolder): Promise<FolderNode> {
  return {
    id: folder.dirPath,
    parentId: folder.parentDirPath,
    name: folder.name,
    slug: folder.slug,
    slugPath: folder.slugPath,
    description: folder.description ? (await folder.description()).trim() : '',
    position: folder.position,
    hasTemplate: Boolean(folder.template),
    noteCount: folder.notes.length,
    notes: folder.notes.map((n) => ({ id: n.path, slug: n.slug, title: n.title, folderId: folder.dirPath })),
    children: [],
  };
}

export async function getVaultStructure(vaultSlug: string): Promise<VaultStructure> {
  const vault = seedVaults().get(vaultSlug);
  if (!vault) throw new Error('NOT_FOUND');

  const nodes = await Promise.all([...vault.folders.values()].map((f) => toFolderNode(f)));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots: FolderNode[] = [];
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const byPosition = (a: FolderNode, b: FolderNode) =>
    a.position - b.position || a.name.localeCompare(b.name);
  for (const node of nodes) node.children.sort(byPosition);
  roots.sort(byPosition);

  return {
    vault: await toSummary(vault),
    guidance: vault.guidance ? await vault.guidance() : null,
    folders: roots,
  };
}

export async function getNote(vaultSlug: string, noteSlug: string): Promise<NoteDetail> {
  const vault = seedVaults().get(vaultSlug);
  const note = vault?.notesBySlug.get(noteSlug);
  if (!vault || !note) throw new Error('NOT_FOUND');

  const raw = await note.load();
  const { frontmatter, body } = splitFrontmatter(raw);

  const folderNames: string[] = [];
  let dir: string | null = note.folderDirPath;
  while (dir) {
    const folder = vault.folders.get(dir);
    if (!folder) break;
    folderNames.unshift(folder.name);
    dir = folder.parentDirPath;
  }

  return {
    id: note.path,
    vaultSlug,
    slug: note.slug,
    title: note.title,
    folderNames,
    frontmatter,
    body,
  };
}

export async function getTemplate(vaultSlug: string, folderId: string): Promise<TemplateDetail | null> {
  const vault = seedVaults().get(vaultSlug);
  const folder = vault?.folders.get(folderId);
  if (!vault || !folder) throw new Error('NOT_FOUND');
  if (!folder.template) return null;
  return { folderId, body: await folder.template() };
}

export function resolveNoteUrl(vaultSlug: string, targetSlug: string): string | null {
  const vault = seedVaults().get(vaultSlug);
  if (!vault?.notesBySlug.has(targetSlug)) return null;
  return `/vaults/${vaultSlug}/notes/${targetSlug}`;
}
