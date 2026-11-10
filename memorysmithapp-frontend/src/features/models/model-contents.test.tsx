/**
 * A notebook model read as it stands (#431): what a notebook created from it
 * starts as, part by part, and what it writes against what it declares
 * (#354). It replaced the page of a frozen version. Rendered to static markup.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { i18n as I18n } from 'i18next';
import type { ModelContentsView } from './ModelContents';

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

const CONTENTS: ModelContentsView = {
  objective: 'Run the assemblies of one condominium',
  description: '',
  audience: '',
  basedOn: null,
  parameters: [
    {
      name: 'condominium',
      description: 'Its name',
      example: 'Solar',
      type: 'text',
      required: true,
      default: null,
    },
  ],
  notebook: { name: 'Assemblies', description: '', guidance: 'Write one note per assembly.' },
  folders: [
    {
      folderId: 'f1',
      parentFolderId: null,
      name: 'Minutes',
      description: 'One per assembly',
      template: '# Minutes of {{condominium}}',
    },
  ],
  notes: [{ noteId: 'n1', folderId: 'f1', body: 'The first assembly of {{condominium}}' }],
  files: [{ name: 'bylaws.pdf', mimeType: 'application/pdf' }],
  tables: [{ name: 'Costs', description: 'What it spends', columns: ['item', 'value'], rows: 2 }],
  dashboards: [{ name: 'Budget', description: 'Spending by month' }],
  references: { undeclared: ['city'], unused: ['year'] },
};

let i18n: I18n;
let draw: (contents: ModelContentsView) => string;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const { ModelContents } = await import('./ModelContents');
  draw = (contents) =>
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ModelContents contents={contents} create={async () => Promise.reject(new Error())} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
}, 30_000);

describe('a model as it stands (#431)', () => {
  it('shows every part a notebook created from it starts as', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CONTENTS);
    expect(html).toContain('Write one note per assembly.');
    expect(html).toContain('Minutes');
    expect(html).toContain('# Minutes of {{condominium}}');
    expect(html).toContain('The first assembly of {{condominium}}');
    expect(html).toContain('bylaws.pdf · application/pdf');
    expect(html).toContain('<strong>Costs</strong> · item, value · 2 rows');
    expect(html).toContain('<strong>Budget</strong>');
    expect(html).toContain('{{condominium}}');
  });

  it('warns of what it writes and does not declare, and of what it declares and never writes', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CONTENTS);
    expect(html).toContain('This model writes {{city}}, which no parameter declares');
    expect(html).toContain('Declared and not written anywhere: year.');
  });

  it('creates a notebook from the model itself, never from a version', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CONTENTS);
    expect(html).toContain('Create a notebook from this model');
    expect(html).not.toMatch(/version/i);
  });

  it('leaves out the parts it does not hold', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw({
      ...CONTENTS,
      files: [],
      tables: [],
      dashboards: [],
      references: { undeclared: [], unused: [] },
    });
    expect(html).not.toContain('Attachments');
    expect(html).not.toContain('Dashboards');
    expect(html).not.toContain('callout-warning');
  });

  it('speaks pt_BR', async () => {
    await i18n.changeLanguage('pt_BR');
    const html = draw(CONTENTS);
    expect(html).toContain('Criar um caderno a partir deste modelo');
    expect(html).toContain('Orientação');
    await i18n.changeLanguage('en_US');
  });
});
