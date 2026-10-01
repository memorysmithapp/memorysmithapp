/**
 * Where the properties of a note go on paper (#258), remembered per browser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { propertyPlacement, rememberPropertyPlacement } from './print-layout';

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
  it('starts on a side box, before anything was chosen', () => {
    expect(propertyPlacement()).toBe('side');
  });

  it('gives back each of the four choices', () => {
    for (const placement of ['cover', 'end', 'none', 'side'] as const) {
      rememberPropertyPlacement(placement);
      expect(propertyPlacement()).toBe(placement);
    }
  });

  it('keeps no entry for the default', () => {
    rememberPropertyPlacement('cover');
    rememberPropertyPlacement('side');
    expect(localStorage.length).toBe(0);
  });

  it('reads the default out of anything that is not a choice', () => {
    localStorage.setItem('memorysmith.printProperties', 'margin');
    expect(propertyPlacement()).toBe('side');
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
    expect(propertyPlacement()).toBe('side');
  });
});
