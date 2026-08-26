/**
 * NotePlacement is to notes what FolderTreePlacement is to folders: it turns
 * "put it after this one" into a Position, without reading or rewriting any
 * sibling (architecture-guide.md, section 6.4).
 *
 * The sibling list comes from GSI2, which already returns the notes of a
 * folder IN THE DEFINED ORDER, so the service never sorts and never scans.
 */

import { DomainError, err, ok, Position, type NoteId, type Result } from '@memorysmith/kernel';

/** A sibling, as GSI2 hands it over: identity plus order key. */
export interface NoteOrder {
  readonly noteId: NoteId;
  readonly position: Position;
}

export const NotePlacement = {
  /** Appends at the end, or slots right after `afterNoteId` when given. */
  place(
    siblings: readonly NoteOrder[],
    afterNoteId: NoteId | null,
    moving: NoteId | null = null,
  ): Result<Position, DomainError> {
    if (afterNoteId && moving && afterNoteId.equals(moving)) {
      return err(DomainError.validation('A note cannot be placed after itself'));
    }
    // The note being moved must not anchor against its own current position.
    const others = moving ? siblings.filter((each) => !each.noteId.equals(moving)) : siblings;

    if (afterNoteId === null) {
      const first = others[0]?.position ?? null;
      return ok(Position.between(null, first));
    }
    const index = others.findIndex((each) => each.noteId.equals(afterNoteId));
    if (index === -1) {
      // Unknown anchor: append rather than guess a slot.
      return ok(Position.between(others[others.length - 1]?.position ?? null, null));
    }
    return ok(
      Position.between(others[index]?.position ?? null, others[index + 1]?.position ?? null),
    );
  },

  /** The position of a brand new note: at the end of its folder. */
  append(siblings: readonly NoteOrder[]): Position {
    return Position.between(siblings[siblings.length - 1]?.position ?? null, null);
  },
};
