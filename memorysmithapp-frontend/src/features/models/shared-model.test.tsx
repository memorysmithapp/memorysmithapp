/**
 * A model shared as a model reader opens on pages of its own (#355), with no
 * notebook around it: nothing on them may read the notebook's context, which
 * is what crashed the page on staging. Rendered to static markup from data the
 * cache already holds.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  ModelContentsDto,
  ModelHistoryDto,
  NotebookModelDto,
} from '@memorysmithapp/contracts';
import { queryKeys } from '../../shared/api/query-keys';

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';

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

const MODEL = {
  notebookId: NOTEBOOK,
  objective: 'Run the assemblies of one condominium',
  description: '',
  audience: 'Property managers',
  parameters: [],
  basedOn: null,
  declaredAt: '2026-10-25T10:00:00.000Z',
  updatedAt: '2026-10-25T10:00:00.000Z',
  licence: 'CC0-1.0',
  sharedBy: 'owner@example.com',
} satisfies NotebookModelDto;

const HISTORY = {
  changes: [
    {
      occurredAt: '2026-10-26T09:00:00.000Z',
      since: '2026-10-26T09:00:00.000Z',
      saves: 1,
      type: 'GuidanceUpdated',
      subject: 'Notebook',
      subjectId: NOTEBOOK,
      name: null,
      agent: 'Claude',
      message: 'Say who signs the minutes',
    },
  ],
  truncated: false,
} satisfies ModelHistoryDto;

const CONTENTS = {
  notebookId: NOTEBOOK,
  objective: MODEL.objective,
  description: '',
  audience: '',
  parameters: [],
  basedOn: null,
  notebook: { name: 'Assemblies', description: '', guidance: 'One note per assembly.' },
  folders: [],
  notes: [],
  files: [],
  tables: [],
  dashboards: [],
  references: { undeclared: [], unused: [] },
} satisfies ModelContentsDto;

let SharedModelPage: () => React.JSX.Element;

beforeAll(async () => {
  await (await import('../../i18n')).default.changeLanguage('en_US');
  ({ SharedModelPage } = await import('./ModelPage'));
}, 30_000);

describe('a model shared as a model reader', () => {
  const render = (address: string) => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.model(NOTEBOOK), MODEL);
    client.setQueryData(queryKeys.modelHistory(NOTEBOOK), HISTORY);
    client.setQueryData(queryKeys.modelContents(NOTEBOOK), CONTENTS);
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[address]}>
          <Routes>
            <Route path="/models/:notebookId" element={<SharedModelPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('renders outside any notebook, with whose it is and what it says of itself', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}`);
    expect(html).toContain('owner@example.com');
    expect(html).toContain('Run the assemblies of one condominium');
  });

  it('shows one part at a time, the community closed to a reader (#400)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}`);
    expect(html).toContain('role="tablist"');
    expect(html).toMatch(/id="model-tab-community"[^>]*disabled=""/);
    expect(html).not.toContain('/versions/');
  });

  it('opens its history, with who made each change and the line left (#431)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=history`);
    expect(html).toMatch(/id="model-tab-history"[^>]*aria-selected="true"/);
    expect(html).toContain('<span class="history-author">Claude</span>');
    expect(html).toContain('Guidance written');
    expect(html).toContain('Say who signs the minutes');
  });

  it('opens what it holds as it stands, where a notebook is created from it (#431)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=contents`);
    expect(html).toContain('One note per assembly.');
    expect(html).toContain('Create a notebook from this model');
  });

  it('has no tab of versions any more (#431)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=versions`);
    expect(html).not.toContain('model-tab-versions');
    expect(html).toMatch(/id="model-tab-about"[^>]*aria-selected="true"/);
  });
});
