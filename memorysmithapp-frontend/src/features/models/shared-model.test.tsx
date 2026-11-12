/**
 * A model shared as a model reader opens on pages of its own (#355), with no
 * notebook around it: nothing on them may read the notebook's context, which
 * is what crashed the page on staging. It reads what the model holds, and
 * creates nothing there (#435); the page of one's own model has no Contents,
 * since its notebook is read by navigating it. Rendered to static markup from
 * data the cache already holds.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  ModelContentsDto,
  ModelHistoryDto,
  NotebookModelDto,
} from '@memorysmithapp/contracts';
import { queryKeys } from '../../shared/api/query-keys';
import type { NotebookStructure } from '../../shared/types/api';

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
      fromModel: null,
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
let ModelPage: () => React.JSX.Element;

beforeAll(async () => {
  await (await import('../../i18n')).default.changeLanguage('en_US');
  ({ SharedModelPage, ModelPage } = await import('./ModelPage'));
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
    expect(html).toContain('class="model-history-who is-agent">Claude</td>');
    expect(html).toContain('Guidance written');
    expect(html).toContain('Say who signs the minutes');
  });

  it('opens what it holds as it stands, and creates no notebook there (#431, #435)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=contents`);
    expect(html).toMatch(/id="model-tab-contents"[^>]*aria-selected="true"/);
    expect(html).toContain('One note per assembly.');
    expect(html).not.toContain('Create a notebook');
    expect(html).not.toContain('<form');
  });

  it('draws its history as the list of a folder (#435)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=history`);
    expect(html).toContain('class="tables-grid folder-notes-table model-history-table"');
  });

  it('has no tab of versions any more (#431)', () => {
    const html = render(`/models/${NOTEBOOK.toLowerCase()}?tab=versions`);
    expect(html).not.toContain('model-tab-versions');
    expect(html).toMatch(/id="model-tab-about"[^>]*aria-selected="true"/);
  });
});

describe("the page of one's own model (#435)", () => {
  const STRUCTURE = {
    notebook: { id: NOTEBOOK, name: 'Assemblies' },
    permissions: { writeContent: true, maintain: true, administer: true },
    folders: [],
  } as unknown as NotebookStructure;

  const render = (address: string) => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.model(NOTEBOOK), { ...MODEL, sharedBy: null });
    client.setQueryData(queryKeys.modelHistory(NOTEBOOK), HISTORY);
    client.setQueryData(queryKeys.modelContents(NOTEBOOK), CONTENTS);
    return renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[address]}>
          <Routes>
            <Route
              path="/notebooks/:notebookId"
              element={<Outlet context={{ structure: STRUCTURE }} />}
            >
              <Route path="model" element={<ModelPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('has no Contents nor History tab, and no button to create a notebook (#435, #446)', () => {
    const html = render(`/notebooks/${NOTEBOOK.toLowerCase()}/model`);
    expect(html).toContain('role="tablist"');
    expect(html).not.toContain('model-tab-history');
    expect(html).not.toContain('model-tab-contents');
    expect(html).not.toContain('Create a notebook');
  });

  it('opens its first tab when the address asks for what it holds', () => {
    const html = render(`/notebooks/${NOTEBOOK.toLowerCase()}/model?tab=contents`);
    expect(html).toMatch(/id="model-tab-about"[^>]*aria-selected="true"/);
    expect(html).not.toContain('One note per assembly.');
  });

  it('opens its first tab when the address asks for its history, which its overview shows (#446)', () => {
    const html = render(`/notebooks/${NOTEBOOK.toLowerCase()}/model?tab=history`);
    expect(html).toMatch(/id="model-tab-about"[^>]*aria-selected="true"/);
    expect(html).not.toContain('model-history-table');
  });
});
