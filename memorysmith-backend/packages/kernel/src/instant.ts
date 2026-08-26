/**
 * A point in time, always UTC and always serialized as ISO 8601.
 * Wrapping Date keeps timezone handling out of aggregates and makes the
 * chronological sort keys of the audit trail unambiguous
 * (architecture-guide.md, section 12.2).
 */

import { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';

export class Instant {
  private readonly __instant!: void;
  private constructor(readonly epochMillis: number) {}

  static now(): Instant {
    return new Instant(Date.now());
  }

  static fromEpochMillis(millis: number): Result<Instant, DomainError> {
    if (!Number.isInteger(millis) || millis < 0) {
      return err(DomainError.validation(`Not a valid instant: ${String(millis)}`));
    }
    return ok(new Instant(millis));
  }

  static fromISO(iso: string): Result<Instant, DomainError> {
    const parsed = typeof iso === 'string' ? Date.parse(iso) : Number.NaN;
    if (Number.isNaN(parsed)) {
      return err(DomainError.validation(`Not a valid ISO 8601 instant: ${String(iso)}`));
    }
    return ok(new Instant(parsed));
  }

  isBefore(other: Instant): boolean {
    return this.epochMillis < other.epochMillis;
  }

  isAfter(other: Instant): boolean {
    return this.epochMillis > other.epochMillis;
  }

  isAtOrBefore(other: Instant): boolean {
    return this.epochMillis <= other.epochMillis;
  }

  equals(other: unknown): boolean {
    return other instanceof Instant && other.epochMillis === this.epochMillis;
  }

  plusDays(days: number): Instant {
    return new Instant(this.epochMillis + days * 86_400_000);
  }

  /** Epoch seconds, the unit DynamoDB TTL attributes are expressed in. */
  toEpochSeconds(): number {
    return Math.floor(this.epochMillis / 1000);
  }

  toISOString(): string {
    return new Date(this.epochMillis).toISOString();
  }

  toString(): string {
    return this.toISOString();
  }

  toJSON(): string {
    return this.toISOString();
  }
}
