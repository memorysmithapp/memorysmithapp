/**
 * NoteRelocation applies the slug conflict policy of a cross-vault move.
 *
 * The slug is unique WITHIN THE VAULT (RN-KNW-020), so only a change of vault
 * can collide, and when it does the caller must have said what to do about it
 * (RN-KNW-022). Living in the domain rather than in the use case keeps the
 * rule testable without any I/O: what the use case supplies is a predicate,
 * not a repository.
 */

import { DomainError, err, ok, Slug, type Result } from '@memorysmith/kernel';
import type { SlugConflictPolicy } from '../values.js';

/** Answers "is this slug taken in the destination vault?". */
export type SlugTaken = (slug: Slug) => boolean;

const MAX_SUFFIX = 50;

export const NoteRelocation = {
  resolveSlug(
    current: Slug,
    isTaken: SlugTaken,
    policy: SlugConflictPolicy,
  ): Result<Slug, DomainError> {
    if (!isTaken(current)) return ok(current);

    if (!policy.renames) {
      return err(
        DomainError.conflict(
          `The destination vault already holds a note with the slug "${current.value}"`,
          { slug: current.value },
        ),
      );
    }

    // RENAME was asked for explicitly, so a suffix here is a decision the
    // caller made, not a silent invention by the server (RN-AGT-004).
    for (let suffix = 2; suffix <= MAX_SUFFIX; suffix++) {
      const candidate = Slug.create(`${current.value}-${suffix}`);
      if (!candidate.ok) return candidate;
      if (!isTaken(candidate.value)) return ok(candidate.value);
    }
    return err(
      DomainError.conflict(
        `Could not free a slug derived from "${current.value}" in the destination vault`,
      ),
    );
  },
};
