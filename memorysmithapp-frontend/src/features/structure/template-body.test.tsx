/**
 * The boxes of a folder Template (#440): a Template is the shape a note of
 * the folder starts from, not a record of what was done, so its boxes show
 * their state and answer no click, even for whoever maintains the notebook.
 * Rendered to static markup.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  removeItem: (key: string) => void stored.delete(key),
  setItem: (key: string, value: string) => void stored.set(key, value),
} as Storage);

let draw: (writable: boolean) => string;

beforeAll(async () => {
  await import('../../i18n');
  const { TemplateBody } = await import('./TemplateBody');
  draw = (writable) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TemplateBody
            notebookId="01J8X2K9QZ3M4N5P6R7S8T9V0A"
            folder={{ id: '01J8X2K9QZ3M4N5P6R7S8T9VF1', name: 'Risks' }}
            template={{
              folderId: '01J8X2K9QZ3M4N5P6R7S8T9VF1',
              body: '---\nname: <What may happen>\n---\n\n# Mitigation\n\n- [ ] One action\n- [x] Another\n',
              revision: 'r1',
            }}
            writable={writable}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, 30_000);

describe('the boxes of a folder Template (#440)', () => {
  it('show their state and answer no click, even for whoever maintains the notebook', () => {
    for (const writable of [true, false]) {
      const html = draw(writable);
      const boxes = html.match(/<input[^>]*type="checkbox"[^>]*>/g) ?? [];
      expect(boxes).toHaveLength(2);
      for (const box of boxes) expect(box).toContain('disabled=""');
      expect(boxes.filter((box) => box.includes('checked=""'))).toHaveLength(1);
    }
  });
});
