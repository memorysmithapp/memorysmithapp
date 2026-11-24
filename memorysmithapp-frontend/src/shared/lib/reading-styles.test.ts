/**
 * The renderer's and KaTeX's stylesheets arrive with the first note, and are
 * placed before the application's, where the entry used to import them (#547).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeLink {
  rel: string;
  href: string;
  dataset: Record<string, string>;
  onload?: () => void;
  onerror?: () => void;
}

function fakeDocument() {
  const app = { id: 'app-styles' };
  const order: unknown[] = [app];
  const head = {
    querySelector: () => app,
    insertBefore: (node: FakeLink, before: unknown) => {
      order.splice(order.indexOf(before), 0, node);
    },
  };
  return {
    order,
    app,
    document: { head, createElement: (): FakeLink => ({ rel: '', href: '', dataset: {} }) },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the reading stylesheets (#547)', () => {
  it('go before the application stylesheet, the renderer then KaTeX, once', async () => {
    const fake = fakeDocument();
    vi.stubGlobal('document', fake.document);
    const { readingStyles } = await import('./reading-styles');

    const first = readingStyles();
    expect(readingStyles()).toBe(first);
    const [renderer, katex, app] = fake.order as [FakeLink, FakeLink, unknown];
    expect(app).toBe(fake.app);
    expect(renderer.rel).toBe('stylesheet');
    expect(katex.rel).toBe('stylesheet');
    expect(fake.order).toHaveLength(3);

    renderer.onload?.();
    katex.onerror?.(); // a stylesheet that fails still lets the note draw
    await first;
    expect((first as { status?: string }).status).toBe('fulfilled');
  });

  it('is already fulfilled where there is no document', async () => {
    const { readingStyles } = await import('./reading-styles');
    expect((readingStyles() as { status?: string }).status).toBe('fulfilled');
  });
});
