/**
 * How a note is laid on paper (#258), remembered per browser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  orientation,
  propertyPlacement,
  rememberOrientation,
  rememberPropertyPlacement,
  rememberTableFit,
  tableFit,
} from './print-layout';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('where the properties of a note go on paper', () => {
  it('starts on a cover page, before anything was chosen', () => {
    expect(propertyPlacement()).toBe('cover');
  });

  it('gives back each of the three choices', () => {
    for (const placement of ['end', 'none', 'cover'] as const) {
      rememberPropertyPlacement(placement);
      expect(propertyPlacement()).toBe(placement);
    }
  });

  it('keeps no entry for the default', () => {
    rememberPropertyPlacement('end');
    rememberPropertyPlacement('cover');
    expect(localStorage.length).toBe(0);
  });

  it('reads the default out of anything that is not a choice', () => {
    localStorage.setItem('memorysmith.printProperties', 'margin');
    expect(propertyPlacement()).toBe('cover');
  });

  it('reads the box beside the text, which was removed, as the default', () => {
    // It ran past the edge of the paper, and a browser may still hold it.
    localStorage.setItem('memorysmith.printProperties', 'side');
    expect(propertyPlacement()).toBe('cover');
  });

  it('survives a browser that refuses storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
    });
    expect(() => rememberPropertyPlacement('end')).not.toThrow();
    expect(() => rememberTableFit('shrink')).not.toThrow();
    expect(() => rememberOrientation('landscape')).not.toThrow();
    expect(propertyPlacement()).toBe('cover');
    expect(tableFit()).toBe('wrap');
    expect(orientation()).toBe('portrait');
  });
});

describe('how a wide table fits, and which way the sheet lies', () => {
  it('wraps the text of a table and lies upright, before anything was chosen', () => {
    expect(tableFit()).toBe('wrap');
    expect(orientation()).toBe('portrait');
  });

  it('remembers each, apart from the other and from the properties', () => {
    rememberTableFit('shrink');
    rememberOrientation('landscape');
    rememberPropertyPlacement('none');
    expect(tableFit()).toBe('shrink');
    expect(orientation()).toBe('landscape');
    expect(propertyPlacement()).toBe('none');
    rememberOrientation('portrait');
    expect(orientation()).toBe('portrait');
    expect(tableFit()).toBe('shrink');
  });
});
