/**
 * Stress on the integer part of the fractional index. Prepending or appending
 * hundreds of times crosses the head boundaries in both directions ('a0' down
 * to 'Zz' and beyond, 'zz' up and beyond), which is exactly where an ordering
 * scheme like this breaks quietly if the length bookkeeping is wrong.
 */

import { describe, expect, it } from 'vitest';
import { Position } from '../src/position.js';

describe('Position: crossing the integer-part boundaries', () => {
  it('prepends 500 times, staying strictly ordered', () => {
    const keys: string[] = [];
    let first: Position | null = null;
    for (let index = 0; index < 500; index++) {
      first = Position.between(null, first);
      keys.unshift(first.value);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('appends 500 times, staying strictly ordered', () => {
    const keys: string[] = [];
    let last: Position | null = null;
    for (let index = 0; index < 500; index++) {
      last = Position.between(last, null);
      keys.push(last.value);
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps a list consistent under interleaved inserts at both ends', () => {
    let keys: string[] = [Position.between(null, null).value];
    for (let round = 0; round < 200; round++) {
      const head = Position.create(keys[0] as string);
      const tail = Position.create(keys[keys.length - 1] as string);
      expect(head.ok && tail.ok).toBe(true);
      if (!head.ok || !tail.ok) return;
      keys = [
        Position.between(null, head.value).value,
        ...keys,
        Position.between(tail.value, null).value,
      ];
    }
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('round-trips every generated key through create()', () => {
    let previous: Position | null = null;
    for (let index = 0; index < 300; index++) {
      previous = Position.between(previous, null);
      expect(Position.create(previous.value).ok).toBe(true);
    }
  });
});
