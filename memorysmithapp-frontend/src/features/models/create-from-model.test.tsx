/**
 * A boolean parameter of a model is a box of its own size beside its name
 * (#411): it was drawn inside a field whose rule gave every input the shape
 * of a text box, and stretched across the dialog. And New notebook from a
 * model keeps Cancel and Create in its footer all along, Create waiting for a
 * model and its required parameters (#435).
 */

import { readFileSync } from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NotebookModelDto, ParameterDeclarationDto } from '@memorysmithapp/contracts';
import { queryKeys } from '../../shared/api/query-keys';

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
let dialog: (parameters: ParameterDeclarationDto[] | null, origin?: 'mine' | 'community') => string;

beforeAll(async () => {
  await (await import('../../i18n')).default.changeLanguage('en_US');
  const { CreateFromModelFields, EMPTY_DRAFT } = await import('./CreateFromModel');
  const { FromModel } = await import('./NewNotebookDialog');
  form = (parameters) =>
    renderToStaticMarkup(
      <CreateFromModelFields parameters={parameters} draft={EMPTY_DRAFT} onChange={() => {}} />,
    );
  // New notebook from a model, on its picker (`null`) or with a model chosen (#435).
  dialog = (parameters, origin = 'mine') => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.models(), []);
    const model = { ...MODEL, parameters: parameters ?? [] };
    client.setQueryData(queryKeys.model(MODEL.notebookId), model);
    client.setQueryData(queryKeys.catalogModel('community-1'), model);
    const item =
      origin === 'mine'
        ? { id: MODEL.notebookId, name: 'Assemblies' }
        : { id: 'community-1', name: 'Assemblies', by: 'Ana' };
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FromModel onClose={() => {}} initial={parameters ? { origin, item } : null} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };
}, 30_000);

const MODEL = {
  notebookId: '01J8X2K9QZ3M4N5P6R7S8T9V0A',
  objective: 'Run the assemblies of one condominium',
  description: '',
  audience: '',
  parameters: [],
  basedOn: null,
  declaredAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  licence: 'CC0-1.0',
  sharedBy: null,
} satisfies NotebookModelDto;

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

describe('New notebook from a model (#435, #437)', () => {
  const create = (html: string) => html.match(/<button type="submit"[^>]*>Create<\/button>/)?.[0];

  it('is one form from the start: the model field, Choose model, the name, Cancel and a disabled Create (#437)', () => {
    const html = dialog(null);
    // The list opens on Choose model, not in the form.
    expect(html).not.toContain('role="combobox"');
    expect(html).toContain('No model chosen yet');
    expect(html).toContain('>Choose model</button>');
    expect(html).toContain('Name of the new notebook');
    expect(html).toMatch(
      /<div class="ask-dialog-foot"><button type="button" class="button is-quiet">Cancel<\/button><button type="submit"/,
    );
    expect(create(html)).toContain('disabled=""');
  });

  it('says the model chosen in its field, with its parameters under it', () => {
    const html = dialog([parameter({ name: 'city', type: 'text', required: true, default: null })]);
    expect(html).not.toContain('role="combobox"');
    expect(html).toMatch(/class="new-notebook-chosen"><strong>Assemblies<\/strong>/);
    expect(html).toContain('>Choose model</button>');
    expect(html).toContain('id="value-city"');
    expect(html).toContain('class="ask-dialog-foot"');
  });

  it('keeps Create disabled until every required parameter is filled', () => {
    const required = parameter({ name: 'city', type: 'text', required: true, default: null });
    expect(create(dialog([required]))).toContain('disabled=""');
    // A box always says yes or no, so a required one never holds Create back.
    expect(create(dialog([parameter({ required: true, default: null })]))).not.toContain(
      'disabled',
    );
    expect(create(dialog([parameter({})]))).not.toContain('disabled');
  });

  it('chooses a community model the same way', () => {
    const html = dialog([], 'community');
    expect(html).toContain(' — Ana');
    expect(create(html)).not.toContain('disabled');
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

  it('shows the name of the model filled in as the parameters are typed (#448)', async () => {
    const { CreateFromModelFields } = await import('./CreateFromModel');
    const parameters: ParameterDeclarationDto[] = [
      {
        name: 'obra',
        description: 'A obra',
        example: 'Aurora',
        type: 'text',
        required: true,
        default: null,
      },
    ];
    const draw = (name: string) =>
      renderToStaticMarkup(
        <CreateFromModelFields
          parameters={parameters}
          draft={{ name, typed: { obra: 'Residencial Aurora' } }}
          onChange={() => {}}
          modelName="Obra {{obra}}"
        />,
      );
    expect(draw('')).toContain('value="Obra Residencial Aurora"');
    // A name of the person's own is theirs.
    expect(draw('Minha obra')).toContain('value="Minha obra"');
  });
});
