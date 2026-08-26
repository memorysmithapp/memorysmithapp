/**
 * Position: lexicographic fractional index.
 *
 * Order is product content, not a display preference (PP9), and it applies to
 * folders among folders and to notes inside a folder. The naive form, a dense
 * integer `order` column, rewrites every sibling on each drag: in DynamoDB
 * that is N writes inside a transaction capped at 100 items.
 *
 * With a fractional index each item stores a string key, and inserting between
 * "a0" and "a1" produces "a0V". Reordering is a SINGLE write on the moved
 * item, whatever the number of siblings (architecture-guide.md, section 6.4).
 *
 * Ties, possible under concurrency, are broken by the ULID of the item, so the
 * ordering is never undefined. Keys longer than REBALANCE_THRESHOLD are a sign
 * that the siblings should be redistributed; that is rare maintenance, not the
 * hot path (architecture-guide.md, section 17).
 */

import { DomainError } from './errors.js';
import { err, ok, type Result } from './result.js';

/** Digits in ASCII order: 0-9 < A-Z < a-z, so string comparison is the order. */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SMALLEST_INTEGER = 'A00000000000000000000000000';
const POSITION_PATTERN = /^[a-zA-Z][0-9A-Za-z]*$/;

/** Above this length, a rebalance is due (architecture-guide.md, section 6.4). */
export const REBALANCE_THRESHOLD = 12;

/**
 * The "integer part" of a key is a prefix whose first character encodes its own
 * length, which is what lets keys grow in both directions without a bound:
 * 'a'..'z' are lengths 2..27 going up, 'A'..'Z' are lengths 2..27 going down.
 */
function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new Error(`Invalid position: ${head}`);
}

function integerPart(key: string): string {
  const length = integerLength(key.charAt(0));
  if (length > key.length) throw new Error(`Invalid position, truncated integer part: ${key}`);
  return key.slice(0, length);
}

function validateInteger(integer: string): void {
  if (integer.length !== integerLength(integer.charAt(0))) {
    throw new Error(`Invalid integer part of a position: ${integer}`);
  }
}

function incrementInteger(integer: string): string | null {
  validateInteger(integer);
  const [head, ...rest] = integer.split('');
  let carry = true;
  for (let index = rest.length - 1; carry && index >= 0; index--) {
    const digit = DIGITS.indexOf(rest[index] as string) + 1;
    if (digit === DIGITS.length) {
      rest[index] = '0';
    } else {
      rest[index] = DIGITS[digit] as string;
      carry = false;
    }
  }
  if (carry) {
    if (head === 'Z') return 'a' + (DIGITS[0] as string); // crossing from negative to positive
    if (head === 'z') return null; // ran out of headroom upwards
    const nextHead = String.fromCharCode((head as string).charCodeAt(0) + 1);
    // The head encodes the length of the integer part, so growing it adds a
    // digit above 'a' and drops one below it.
    if (nextHead > 'a') rest.push(DIGITS[0] as string);
    else rest.pop();
    return nextHead + rest.join('');
  }
  return (head as string) + rest.join('');
}

function decrementInteger(integer: string): string | null {
  validateInteger(integer);
  const [head, ...rest] = integer.split('');
  let borrow = true;
  for (let index = rest.length - 1; borrow && index >= 0; index--) {
    const digit = DIGITS.indexOf(rest[index] as string) - 1;
    if (digit === -1) {
      rest[index] = DIGITS.slice(-1) as string;
    } else {
      rest[index] = DIGITS[digit] as string;
      borrow = false;
    }
  }
  if (borrow) {
    if (head === 'a') return 'Z' + DIGITS.slice(-1); // crossing from positive to negative
    if (head === 'A') return null; // ran out of headroom downwards
    const previousHead = String.fromCharCode((head as string).charCodeAt(0) - 1);
    // Going down through the lowercase heads shortens the integer part
    // ('b' holds 3 characters, 'a' holds 2); going down through the uppercase
    // heads lengthens it ('Z' holds 2, 'Y' holds 3).
    if (previousHead > 'Z') rest.pop();
    else rest.push(DIGITS.slice(-1));
    return previousHead + rest.join('');
  }
  return (head as string) + rest.join('');
}

/**
 * A string strictly between `before` and `after` in the fractional part,
 * where an empty `before` means "the beginning" and a null `after` means
 * "the end".
 */
function midpoint(before: string, after: string | null): string {
  if (after !== null && before >= after) {
    throw new Error(`Cannot find a midpoint: ${before} is not before ${after}`);
  }
  if (before.slice(-1) === '0' || (after !== null && after.slice(-1) === '0')) {
    throw new Error('Fractional part must not carry a trailing zero');
  }
  if (after !== null) {
    let common = 0;
    while ((before[common] ?? '0') === after[common]) common++;
    if (common > 0) {
      return after.slice(0, common) + midpoint(before.slice(common), after.slice(common));
    }
  }
  const digitBefore = before ? DIGITS.indexOf(before.charAt(0)) : 0;
  const digitAfter = after !== null ? DIGITS.indexOf(after.charAt(0)) : DIGITS.length;
  if (digitAfter - digitBefore > 1) {
    return DIGITS[Math.round(0.5 * (digitBefore + digitAfter))] as string;
  }
  if (after !== null && after.length > 1) return after.slice(0, 1);
  return (DIGITS[digitBefore] as string) + midpoint(before.slice(1), null);
}

function keyBetween(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(`Positions out of order: ${before} >= ${after}`);
  }
  if (before === null && after === null) return 'a0';

  if (before === null) {
    const integer = integerPart(after as string);
    const fraction = (after as string).slice(integer.length);
    if (integer === SMALLEST_INTEGER) return integer + midpoint('', fraction);
    if (integer < (after as string)) return integer;
    const decremented = decrementInteger(integer);
    if (decremented === null) throw new Error('Position space exhausted downwards');
    return decremented;
  }

  const integerBefore = integerPart(before);
  const fractionBefore = before.slice(integerBefore.length);

  if (after === null) {
    const incremented = incrementInteger(integerBefore);
    return incremented === null ? integerBefore + midpoint(fractionBefore, null) : incremented;
  }

  const integerAfter = integerPart(after);
  const fractionAfter = after.slice(integerAfter.length);
  if (integerBefore === integerAfter) {
    return integerBefore + midpoint(fractionBefore, fractionAfter);
  }
  const incremented = incrementInteger(integerBefore);
  if (incremented === null) throw new Error('Position space exhausted upwards');
  if (incremented < after) return incremented;
  return integerBefore + midpoint(fractionBefore, null);
}

export class Position {
  private readonly __position!: void;
  private constructor(readonly value: string) {}

  static create(raw: string): Result<Position, DomainError> {
    if (typeof raw !== 'string' || !POSITION_PATTERN.test(raw)) {
      return err(DomainError.validation(`Not a valid position: ${String(raw)}`));
    }
    try {
      integerPart(raw);
    } catch {
      return err(DomainError.validation(`Not a valid position: ${raw}`));
    }
    return ok(new Position(raw));
  }

  /**
   * The one operation the whole ordering design exists for: a key strictly
   * between two siblings, computed without reading or rewriting any other one.
   */
  static between(previous: Position | null, next: Position | null): Position {
    return new Position(keyBetween(previous?.value ?? null, next?.value ?? null));
  }

  /** The first position of an empty list. */
  static first(): Position {
    return new Position('a0');
  }

  /** Keys this long mean the siblings are due for a rebalance. */
  get needsRebalance(): boolean {
    return this.value.length > REBALANCE_THRESHOLD;
  }

  compare(other: Position): number {
    return this.value < other.value ? -1 : this.value > other.value ? 1 : 0;
  }

  equals(other: unknown): boolean {
    return other instanceof Position && other.value === this.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/**
 * Redistributes `count` siblings evenly, used by the on-demand rebalance
 * command. Returns keys in ascending order.
 */
export function rebalancedPositions(count: number): Position[] {
  const positions: Position[] = [];
  let previous: Position | null = null;
  for (let index = 0; index < count; index++) {
    previous = Position.between(previous, null);
    positions.push(previous);
  }
  return positions;
}
