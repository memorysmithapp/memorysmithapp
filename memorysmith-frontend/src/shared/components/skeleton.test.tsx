/**
 * A screen waiting for data shows the shape of what is coming, in the position
 * it will occupy, and never a blank area or a bare line of text (§13.2).
 *
 * Two properties are asserted here rather than left to care, because both are
 * the kind that disappear quietly. **A skeleton belongs to `isPending` alone**
 * — over a request that has already failed it is worse than the text it
 * replaced, a page that looks alive and is dead — and **the word has to
 * survive for whoever hears the page**, since a shape announces nothing where
 * a line of text at least said "Loading".
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import type * as Skeletons from './skeletons';
import { renderToStaticMarkup } from 'react-dom/server';
import { queryState } from '../api/query-state';

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
} as unknown as Storage);

let render: (node: ReactElement) => string;
let parts: typeof Skeletons;

beforeAll(async () => {
  await import('../../i18n');
  parts = await import('./skeletons');
  render = renderToStaticMarkup;
});

describe('a placeholder occupies the frame of what it stands in for', () => {
  it('draws the application frame instead of 60vh of nothing', () => {
    const html = render(<parts.AppSkeleton />);
    expect(html).toContain('app-skeleton');
    expect(html).toContain('skeleton');
  });

  it('draws a row of notebook cards where the catalogue was simply empty', () => {
    const html = render(<parts.NotebookCatalogueSkeleton cards={3} />);
    expect((html.match(/notebook-card-skeleton/g) ?? []).length).toBe(3);
  });

  it('draws the space of the subscription in the card it will fill (#198)', () => {
    const html = render(<parts.SpaceSkeleton />);
    expect(html).toContain('home-space-card');
    // The four counts about links are gone from the screen, so they are gone
    // from what the skeleton promises: a skeleton is a claim about what is coming.
    expect(html).not.toContain('stat-tile');
  });

  it('draws a note with a name, properties and a body', () => {
    const html = render(<parts.NoteSkeleton />);
    expect(html).toContain('content-pane');
    expect((html.match(/class="skeleton"/g) ?? []).length).toBeGreaterThan(4);
  });

  it('draws an embed with its frame and its caption', () => {
    const html = render(<parts.TransclusionSkeleton />);
    expect(html).toContain('embed-body');
    expect(html).toContain('embed-source');
  });

  it('draws a tree with depth, and not a stack of identical bars', () => {
    const html = render(<parts.FolderTreeSkeleton />);
    expect(html).toContain('padding-left:1rem');
    expect(html).toContain('padding-left:2rem');
  });
});

describe('a placeholder never talks over the screen reader', () => {
  const all = () => [
    'AppSkeleton',
    'NotebookCatalogueSkeleton',
    'SpaceSkeleton',
    'NoteSkeleton',
    'TemplateSkeleton',
    'TransclusionSkeleton',
    'GraphSkeleton',
    'FolderTreeSkeleton',
  ];

  it.each(all())('%s carries aria-busy and keeps the word', (name) => {
    const Component = parts[name as keyof typeof parts] as () => ReactElement;
    const html = render(<Component />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('visually-hidden');
  });
});

describe('a placeholder belongs to isPending and to nothing else', () => {
  it('is what the pending state asks for, and never the errored one', () => {
    // The decision is `queryState`, and it reads the error first. This is the
    // property #53 fixed and this issue must not undo: a shimmer over a dead
    // request is worse than the line of text it replaced.
    expect(queryState({ isPending: false, isError: true })).toBe('error');
    expect(queryState({ isPending: true, isError: false })).toBe('pending');
  });

  it('leaves rendered content in place during a background refetch', () => {
    // Data in hand and not pending: the page keeps what it is showing.
    expect(queryState({ isPending: false, isError: false, data: { any: 'thing' } })).toBe('ready');
  });
});
