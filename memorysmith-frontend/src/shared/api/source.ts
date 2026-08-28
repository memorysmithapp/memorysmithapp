// The single source that answers the screens: the product API.
//
// There used to be a second one here, a bundled seed the app fell back to when
// VITE_API_ORIGIN was unset, and it was how the interface was designed before
// the API existed. It is gone on purpose. A fallback that answers with
// different data, silently, is worse than no answer: the screen looks right
// and is showing something else, and every bug found that way is found twice.
//
// So a missing origin is now a configuration error, and it says so.

import type { ExportJobDto } from '@memorysmith/contracts';
import * as backend from './backend';
import type {
  NoteDetail,
  SearchHit,
  TemplateDetail,
  VaultStructure,
  VaultSummary,
} from '../types/api';

const configuredOrigin = (import.meta.env['VITE_API_ORIGIN'] as string | undefined)?.replace(
  /\/$/,
  '',
);

if (!configuredOrigin) {
  throw new Error(
    'VITE_API_ORIGIN is not set. The interface reads and writes through the product API and ' +
      'has no offline mode; copy .env.example to .env.local and point it at the API.',
  );
}

export const apiOrigin: string = configuredOrigin;

/** Walks the loaded structure, so a link needs no extra request. */
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

/**
 * The structures the screens have already loaded. A wikilink resolves against
 * this instead of asking the API again: the tree it needs is the tree the page
 * is already showing.
 */
const loaded = new Map<string, VaultStructure>();

export function listVaults(): Promise<VaultSummary[]> {
  return backend.listVaults();
}

export async function getVaultStructure(vaultSlug: string): Promise<VaultStructure> {
  const structure = await backend.getVaultStructure(vaultSlug);
  loaded.set(vaultSlug, structure);
  return structure;
}

export function getNote(vaultSlug: string, noteSlug: string): Promise<NoteDetail> {
  return backend.getNote(vaultSlug, noteSlug);
}

export function getTemplate(vaultSlug: string, folderId: string): Promise<TemplateDetail | null> {
  return backend.getTemplate(vaultSlug, folderId);
}

/** Null means the target does not exist yet, which the UI shows as pending. */
export function resolveNoteUrl(vaultSlug: string, targetSlug: string): string | null {
  return resolveFromStructure(vaultSlug, targetSlug, loaded.get(vaultSlug));
}

/** The whole vault as a downloadable archive, prepared on demand. */
export function exportVault(vaultSlug: string): Promise<ExportJobDto> {
  return backend.exportVault(vaultSlug);
}

export function searchNotes(vaultSlug: string, query: string, k: number): Promise<SearchHit[]> {
  return backend.searchVault(vaultSlug, query, k);
}
