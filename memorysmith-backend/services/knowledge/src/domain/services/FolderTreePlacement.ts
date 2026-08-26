/**
 * FolderTreePlacement resolves "put it after X inside Y" into a concrete
 * (parentFolderId, Position), and validates the two structural invariants that
 * a placement can break: maximum depth (I2, RN-KNW-003) and cycles (I3,
 * RN-KNW-004). Architecture-guide.md, section 6.6.
 *
 * It is a domain service and not a method of the tree because the decision
 * involves the destination, the anchor and the subtree that travels along,
 * which is a rule about three things rather than a property of one.
 */

import { DomainError, err, ok, Position, type FolderId, type Result } from '@memorysmith/kernel';
import type { FolderTree } from '../vault/FolderTree.js';
import { VAULT_LIMITS } from '../values.js';

export interface Placement {
  readonly parentFolderId: FolderId | null;
  readonly position: Position;
}

export const FolderTreePlacement = {
  /** Where a NEW folder goes. */
  forNewFolder(
    tree: FolderTree,
    parentFolderId: FolderId | null,
    afterFolderId: FolderId | null,
  ): Result<Placement, DomainError> {
    if (parentFolderId && !tree.has(parentFolderId)) {
      return err(DomainError.notFound('The parent folder does not exist in this vault'));
    }
    if (tree.depthUnder(parentFolderId) > VAULT_LIMITS.maxDepth) {
      return err(
        DomainError.validation(`The folder tree goes at most ${VAULT_LIMITS.maxDepth} levels deep`),
      );
    }
    // A new folder with no anchor goes to the END of its level.
    const anchors = tree.positionAfter(parentFolderId, afterFolderId, 'last');
    return ok({ parentFolderId, position: Position.between(anchors.previous, anchors.next) });
  },

  /** Where an EXISTING folder goes, subtree included. */
  forMove(
    tree: FolderTree,
    folderId: FolderId,
    newParentFolderId: FolderId | null,
    afterFolderId: FolderId | null,
  ): Result<Placement, DomainError> {
    const folder = tree.get(folderId);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));
    if (newParentFolderId && !tree.has(newParentFolderId)) {
      return err(DomainError.notFound('The destination folder does not exist in this vault'));
    }
    if (newParentFolderId && tree.isDescendant(newParentFolderId, folderId)) {
      return err(DomainError.validation('A folder cannot be moved into its own subtree'));
    }
    const resultingDepth = tree.depthUnder(newParentFolderId) + tree.heightOf(folderId) - 1;
    if (resultingDepth > VAULT_LIMITS.maxDepth) {
      return err(
        DomainError.validation(
          `The move would push the tree past ${VAULT_LIMITS.maxDepth} levels deep`,
        ),
      );
    }
    // A move with no anchor lands at the end of the destination level.
    const anchors = tree.positionAfter(newParentFolderId, afterFolderId, 'last');
    return ok({
      parentFolderId: newParentFolderId,
      position: Position.between(anchors.previous, anchors.next),
    });
  },

  /**
   * Where a folder goes when only the order changes. The moved folder must not
   * anchor against its own current position, or the new key would not be
   * strictly between its neighbours.
   */
  forReorder(
    tree: FolderTree,
    folderId: FolderId,
    afterFolderId: FolderId | null,
  ): Result<Position, DomainError> {
    const folder = tree.get(folderId);
    if (!folder) return err(DomainError.notFound('Folder not found in this vault'));
    if (afterFolderId?.equals(folderId)) {
      return err(DomainError.validation('A folder cannot be placed after itself'));
    }
    // Reordering with no anchor means "first": that is what dragging an item
    // to the top of the list expresses.
    const anchors = tree.positionAfter(folder.parentFolderId, afterFolderId, 'first');
    const previous = anchors.previous?.equals(folder.position) ? null : anchors.previous;
    const next = anchors.next?.equals(folder.position) ? null : anchors.next;
    return ok(Position.between(previous, next));
  },
};
