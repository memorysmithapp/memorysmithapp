/**
 * A boolean parameter of a model is a box of its own size beside its name
 * (#411): it was drawn inside a field whose rule gave every input the shape
 * of a text box, and stretched across the dialog.
 */

import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ParameterDeclarationDto } from '@memorysmithapp/contracts';

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

let form: (parameters: ParameterDeclarationDto[]) => string;

beforeAll(async () => {
  await import('../../i18n');
  const { CreateFromModelForm } = await import('./CreateFromModel');
  form = (parameters) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CreateFromModelForm notebookId="n" version={1} parameters={parameters} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, 30_000);

const parameter = (over: Partial<ParameterDeclarationDto>): ParameterDeclarationDto => ({
  name: 'withMinutes',
  description: 'Whether the meetings keep minutes',
  example: '',
  type: 'boolean',
  required: false,
  default: true,
  ...over,
});

describe('a boolean parameter when a notebook is created from a model (#411)', () => {
  it('is a box beside its name, which is the label clicked', () => {
    const html = form([parameter({})]);
    expect(html).toMatch(
      /<label class="parameter-required"><input id="value-withMinutes" type="checkbox" checked=""\/><span>withMinutes<\/span><\/label>/,
    );
    expect(html).not.toContain('for="value-withMinutes"');
  });

  it('keeps the hint below it', () => {
    expect(form([parameter({})])).toMatch(
      /<\/label><span class="field-hint">Whether the meetings keep minutes/,
    );
  });

  it('leaves a text parameter as a field with its label above', () => {
    const html = form([parameter({ name: 'city', type: 'text', default: null })]);
    expect(html).toContain('<label for="value-city" class="field-label">city</label>');
  });
});

describe('the shape of a field that takes text (#411)', () => {
  const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

  it('never applies to a box or a radio', () => {
    expect(css).not.toMatch(/^\.field input \{/m);
    expect(css).toMatch(
      /^\.field input:where\(:not\(\[type='checkbox'\], \[type='radio'\]\)\) \{\s*width: 100%;/m,
    );
  });
});
