/**
 * How Home was left, per browser (#257). A browser that refuses storage opens
 * Home as a row and never throws, because the convenience may not be what
 * keeps somebody from their notebooks.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeExpanded, rememberHomeExpanded } from './home-layout';

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

function refusingStorage(): Storage {
  const refuse = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  return { getItem: refuse, setItem: refuse, removeItem: refuse } as unknown as Storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Home remembers whether its notebooks fill the page', () => {
  it('opens as a row when nothing was remembered', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(homeExpanded()).toBe(false);
  });

  it('gives back an expanded Home, and a row once it is collapsed again', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    rememberHomeExpanded(true);
    expect(homeExpanded()).toBe(true);
    rememberHomeExpanded(false);
    expect(homeExpanded()).toBe(false);
  });

  it('opens as a row, and throws nothing, in a browser that refuses storage', () => {
    vi.stubGlobal('localStorage', refusingStorage());
    expect(() => rememberHomeExpanded(true)).not.toThrow();
    expect(homeExpanded()).toBe(false);
  });
});
