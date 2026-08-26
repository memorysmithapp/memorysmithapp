// Which source answers the screens.
//
// With VITE_API_ORIGIN set, the SPA talks to the real backend and every write
// is a real write. Without it, it reads the bundled seed and is a navigable
// prototype, which is how the interface was designed before the API existed.
//
// The two implement the same contract on purpose: the screens never learn
// which one is answering, and the day the seed goes away nothing above this
// file changes.

import * as seed from './client';
import * as backend from './backend';
import type { NoteDetail, TemplateDetail, VaultStructure, VaultSummary } from '../types/api';

export interface VaultSource {
  readonly isLive: boolean;
  listVaults(): Promise<VaultSummary[]>;
  getVaultStructure(vaultSlug: string): Promise<VaultStructure>;
  getNote(vaultSlug: string, noteSlug: string): Promise<NoteDetail>;
  getTemplate(vaultSlug: string, folderId: string): Promise<TemplateDetail | null>;
  resolveNoteUrl(vaultSlug: string, targetSlug: string, structure?: VaultStructure): string | null;
}

const liveOrigin = (import.meta.env['VITE_API_ORIGIN'] as string | undefined)?.replace(/\/$/, '');

/** Walks the loaded structure, so a live link needs no extra request. */
function resolveFromStructure(
  vaultSlug: string,
  targetSlug: string,
  structure: VaultStructure | undefined,
): string | null {
  if (!structure) return null;
  const walk = (nodes: VaultStructure['folders']): string | null => {
    for (const node of nodes) {
      if (node.notes.some((note) => note.slug === targetSlug)) {
        return `/vaults/${vaultSlug}/root/${node.slugPath}/${targetSlug}`;
      }
      const found = walk(node.children);
      if (found) return found;
    }
    return null;
  };
  return walk(structure.folders);
}

export const source: VaultSource = liveOrigin
  ? {
      isLive: true,
      listVaults: backend.listVaults,
      getVaultStructure: backend.getVaultStructure,
      getNote: backend.getNote,
      getTemplate: backend.getTemplate,
      resolveNoteUrl: (vaultSlug, targetSlug, structure) =>
        resolveFromStructure(vaultSlug, targetSlug, structure),
    }
  : {
      isLive: false,
      listVaults: seed.listVaults,
      getVaultStructure: seed.getVaultStructure,
      getNote: seed.getNote,
      getTemplate: seed.getTemplate,
      resolveNoteUrl: (vaultSlug, targetSlug) => seed.resolveNoteUrl(vaultSlug, targetSlug),
    };

export const isLive = Boolean(liveOrigin);
export const apiOrigin = liveOrigin ?? null;

/**
 * The structures the screens have already loaded. A wikilink resolves against
 * this instead of asking the API again: the tree it needs is the tree the page
 * is already showing.
 */
const loaded = new Map<string, VaultStructure>();

export function listVaults(): Promise<VaultSummary[]> {
  return source.listVaults();
}

export async function getVaultStructure(vaultSlug: string): Promise<VaultStructure> {
  const structure = await source.getVaultStructure(vaultSlug);
  loaded.set(vaultSlug, structure);
  return structure;
}

export function getNote(vaultSlug: string, noteSlug: string): Promise<NoteDetail> {
  return source.getNote(vaultSlug, noteSlug);
}

export function getTemplate(vaultSlug: string, folderId: string): Promise<TemplateDetail | null> {
  return source.getTemplate(vaultSlug, folderId);
}

/** Null means the target does not exist yet, which the UI shows as pending. */
export function resolveNoteUrl(vaultSlug: string, targetSlug: string): string | null {
  return source.resolveNoteUrl(vaultSlug, targetSlug, loaded.get(vaultSlug));
}
