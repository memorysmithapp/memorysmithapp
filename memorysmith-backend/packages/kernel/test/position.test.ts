import { describe, expect, it } from 'vitest';
import { Position, rebalancedPositions, REBALANCE_THRESHOLD } from '../src/position.js';

/** Sorting by the raw string is the whole point: DynamoDB does exactly this. */
function sorted(positions: Position[]): string[] {
  return positions.map((position) => position.value).sort();
}

describe('Position', () => {
  it('starts an empty list at a0', () => {
    expect(Position.between(null, null).value).toBe('a0');
    expect(Position.first().value).toBe('a0');
  });

  it('appends after the last sibling', () => {
    const first = Position.between(null, null);
    const second = Position.between(first, null);
    const third = Position.between(second, null);
    expect(first.value < second.value).toBe(true);
    expect(second.value < third.value).toBe(true);
  });

  it('prepends before the first sibling', () => {
    const first = Position.between(null, null);
    const before = Position.between(null, first);
    expect(before.value < first.value).toBe(true);
  });

  it('inserts strictly between two neighbours', () => {
    const left = Position.between(null, null);
    const right = Position.between(left, null);
    const middle = Position.between(left, right);
    expect(left.value < middle.value).toBe(true);
    expect(middle.value < right.value).toBe(true);
  });

  it('keeps inserting between the same two neighbours without collapsing', () => {
    const left = Position.between(null, null);
    const right = Position.between(left, null);
    let previous = left;
    const generated: Position[] = [];
    for (let index = 0; index < 50; index++) {
      previous = Position.between(previous, right);
      generated.push(previous);
    }
    const values = generated.map((position) => position.value);
    expect(new Set(values).size).toBe(values.length);
    expect(sorted(generated)).toEqual(values);
    expect(values.every((value) => value > left.value && value < right.value)).toBe(true);
  });

  it('reorders with a single new key, never touching the siblings', () => {
    // Four siblings; move the last one to the second slot.
    const a = Position.between(null, null);
    const b = Position.between(a, null);
    const c = Position.between(b, null);
    const d = Position.between(c, null);
    const moved = Position.between(a, b);
    expect(sorted([a, moved, b, c, d])).toEqual([a, moved, b, c, d].map((p) => p.value));
  });

  it('flags keys that grew past the rebalance threshold', () => {
    // Repeatedly inserting immediately before the same neighbour is the worst
    // case: each insertion halves the remaining gap.
    const left = Position.between(null, null);
    let right = Position.between(left, null);
    for (let index = 0; index < 80; index++) right = Position.between(left, right);
    expect(right.value.length).toBeGreaterThan(REBALANCE_THRESHOLD);
    expect(right.needsRebalance).toBe(true);
  });

  it('rebalances a list into short ascending keys', () => {
    const positions = rebalancedPositions(30);
    expect(positions).toHaveLength(30);
    expect(sorted(positions)).toEqual(positions.map((position) => position.value));
    expect(positions.every((position) => position.needsRebalance === false)).toBe(true);
  });

  it('rejects a malformed stored value', () => {
    expect(Position.create('a0').ok).toBe(true);
    expect(Position.create('').ok).toBe(false);
    expect(Position.create('0a').ok).toBe(false);
    expect(Position.create('a-0').ok).toBe(false);
  });

  it('refuses to build a key between siblings given out of order', () => {
    const left = Position.between(null, null);
    const right = Position.between(left, null);
    expect(() => Position.between(right, left)).toThrow();
  });
});
