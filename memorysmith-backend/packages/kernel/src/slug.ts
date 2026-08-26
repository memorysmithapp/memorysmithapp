/**
 * Slug: the normalized, URL-safe name a folder or a note is addressed by.
 *
 * Note slugs are unique within the vault, not within the folder, because that
 * is how links resolve (RN-KNW-020); folder slugs are unique among siblings
 * (RN-KNW-002). Uniqueness itself is enforced by guard items in DynamoDB; this
 * type only guarantees the shape.
 */

import { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';

const MAX_LENGTH = 80;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Folds accents, lowercases, and collapses everything that is neither a letter
 * nor a digit into single hyphens. Deterministic: the same title always yields
 * the same slug, which is what makes create_note idempotent (RN-AGT-004).
 */
export function slugify(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, '');
}

export class Slug {
  private readonly __slug!: void;
  private constructor(readonly value: string) {}

  /** Accepts an already normalized slug and rejects anything else. */
  static create(raw: string): Result<Slug, DomainError> {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) {
      return err(DomainError.validation(`Slug must have 1 to ${MAX_LENGTH} characters`));
    }
    if (!SLUG_PATTERN.test(raw)) {
      return err(
        DomainError.validation(
          'Slug accepts lowercase letters, digits and single hyphens between them',
        ),
      );
    }
    return ok(new Slug(raw));
  }

  /** Derives a slug from free text: a title, a folder name. */
  static from(raw: string): Result<Slug, DomainError> {
    const normalized = slugify(raw ?? '');
    if (normalized.length === 0) {
      return err(DomainError.validation(`Cannot derive a slug from "${String(raw)}"`));
    }
    return Slug.create(normalized);
  }

  equals(other: unknown): boolean {
    return other instanceof Slug && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
