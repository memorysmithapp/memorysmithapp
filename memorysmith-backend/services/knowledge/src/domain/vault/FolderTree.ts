/**
 * FolderTree: the collection of folders of a vault, and the place where the
 * structural questions are answered.
 *
 * It holds no invariant of its own: the Vault aggregate is the consistency
 * boundary (architecture-guide.md, section 6.1), and this type is what lets it
 * answer "who are the siblings", "how deep is this" and "would this move
 * create a cycle" without walking the whole thing every time.
 */

import type { FolderId, Position } from '@memorysmith/kernel';
import type { Folder } from './Folder.js';

export class FolderTree {
  private readonly byId: Map<string, Folder>;

  private constructor(folders: Folder[]) {
    this.byId = new Map(folders.map((folder) => [folder.id.value, folder]));
  }

  static empty(): FolderTree {
    return new FolderTree([]);
  }

  static fromFolders(folders: Folder[]): FolderTree {
    return new FolderTree(folders);
  }

  get size(): number {
    return this.byId.size;
  }

  get(id: FolderId): Folder | null {
    return this.byId.get(id.value) ?? null;
  }

  has(id: FolderId): boolean {
    return this.byId.has(id.value);
  }

  all(): Folder[] {
    return [...this.byId.values()];
  }

  /**
   * Children in the DEFINED order. Ties, possible under concurrency, are
   * broken by the ULID of the folder, so the ordering is never undefined
   * (architecture-guide.md, section 6.4).
   */
  childrenOf(parentFolderId: FolderId | null): Folder[] {
    return this.all()
      .filter((folder) =>
        parentFolderId === null
          ? folder.parentFolderId === null
          : (folder.parentFolderId?.equals(parentFolderId) ?? false),
      )
      .sort((left, right) => {
        const byPosition = left.position.compare(right.position);
        return byPosition !== 0 ? byPosition : left.id.value.localeCompare(right.id.value);
      });
  }

  /** The whole tree, depth-first, in the defined order: the export order. */
  inOrder(parentFolderId: FolderId | null = null): Folder[] {
    return this.childrenOf(parentFolderId).flatMap((folder) => [
      folder,
      ...this.inOrder(folder.id),
    ]);
  }

  /** 1 for a root folder, so the limit of 6 reads as "6 levels" (RN-KNW-003). */
  depthOf(id: FolderId): number {
    let depth = 1;
    let current = this.get(id);
    while (current?.parentFolderId) {
      const parent: Folder | null = this.get(current.parentFolderId);
      if (!parent) break;
      depth += 1;
      current = parent;
    }
    return depth;
  }

  /** Depth a folder would have if placed under this parent. */
  depthUnder(parentFolderId: FolderId | null): number {
    return parentFolderId === null ? 1 : this.depthOf(parentFolderId) + 1;
  }

  /** The tallest subtree hanging from this folder, counted in levels. */
  heightOf(id: FolderId): number {
    const children = this.childrenOf(id);
    if (children.length === 0) return 1;
    return 1 + Math.max(...children.map((child) => this.heightOf(child.id)));
  }

  descendantsOf(id: FolderId): Folder[] {
    return this.childrenOf(id).flatMap((child) => [child, ...this.descendantsOf(child.id)]);
  }

  /** Would moving `id` under `candidateParent` create a cycle (RN-KNW-004)? */
  isDescendant(candidateParent: FolderId, of: FolderId): boolean {
    if (candidateParent.equals(of)) return true;
    return this.descendantsOf(of).some((folder) => folder.id.equals(candidateParent));
  }

  /** I1: the slug is unique among siblings (RN-KNW-002). */
  hasSiblingSlug(parentFolderId: FolderId | null, slug: string, except?: FolderId): boolean {
    return this.childrenOf(parentFolderId).some(
      (folder) => folder.slug.value === slug && !(except && folder.id.equals(except)),
    );
  }

  /** The position that places a folder right after `afterFolderId`. */
  positionAfter(
    parentFolderId: FolderId | null,
    afterFolderId: FolderId | null,
  ): {
    previous: Position | null;
    next: Position | null;
  } {
    const siblings = this.childrenOf(parentFolderId);
    if (afterFolderId === null) {
      return { previous: null, next: siblings[0]?.position ?? null };
    }
    const index = siblings.findIndex((folder) => folder.id.equals(afterFolderId));
    if (index === -1) {
      // Unknown anchor: append at the end rather than guess a slot.
      return { previous: siblings[siblings.length - 1]?.position ?? null, next: null };
    }
    return {
      previous: siblings[index]?.position ?? null,
      next: siblings[index + 1]?.position ?? null,
    };
  }

  withFolder(folder: Folder): FolderTree {
    return new FolderTree([...this.all().filter((f) => !f.id.equals(folder.id)), folder]);
  }

  without(ids: FolderId[]): FolderTree {
    const removed = new Set(ids.map((id) => id.value));
    return new FolderTree(this.all().filter((folder) => !removed.has(folder.id.value)));
  }
}
