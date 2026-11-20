import { describe, expect, it } from 'vitest';
import {
  FIRST_ATTRIBUTE_SLOT,
  GRAPH_COLORS,
  KIND_SLOT,
  colorOrder,
  freeAttributeSlot,
  slotToken,
} from './graph-colors';

describe('the colours of the notebook graph (#502)', () => {
  it('draws one order of the list per notebook, the same every time', () => {
    const order = colorOrder('01JBQ2X00000000000000000V1');
    expect([...order].sort()).toEqual(Array.from({ length: GRAPH_COLORS }, (_, at) => at));
    expect(colorOrder('01jbq2x00000000000000000v1')).toEqual(order);
    const others = [
      '01JBQ2X00000000000000000V2',
      '01JBQ2X00000000000000000V3',
      '01J8X2K9QZ3M4N5P6R7S8T9V0A',
    ];
    expect(others.some((id) => colorOrder(id).join() !== order.join())).toBe(true);
  });

  it('gives each kind its own colour, the attributes the next ones, and ink once the list ran out', () => {
    const order = colorOrder('01JBQ2X00000000000000000V1');
    const kinds = Object.values(KIND_SLOT).map((slot) => slotToken(slot, order));
    expect(new Set(kinds).size).toBe(4);
    expect(kinds.every((token) => /^--graph-[1-6]$/.test(token))).toBe(true);
    expect(freeAttributeSlot([])).toBe(FIRST_ATTRIBUTE_SLOT);
    expect(freeAttributeSlot([FIRST_ATTRIBUTE_SLOT])).toBe(FIRST_ATTRIBUTE_SLOT + 1);
    expect(slotToken(FIRST_ATTRIBUTE_SLOT + 1, order)).toMatch(/^--graph-[1-6]$/);
    expect(slotToken(GRAPH_COLORS, order)).toBe('--graph-none');
    expect(slotToken(GRAPH_COLORS + 3, order)).toBe('--graph-none');
  });
});
