/**
 * A notebook model has no versions (#431): it is read as it stands, it keeps
 * the history of its notebook, and a notebook is created from the model
 * itself. What the interface asks of the API is pinned here, so no address of
 * a version is asked for again.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn(async (..._args: unknown[]) => ({}));
const publicRequest = vi.fn(async (..._args: unknown[]) => ({}));

vi.mock('./http', () => ({
  request: (...args: unknown[]) => request(...args),
  publicRequest: (...args: unknown[]) => publicRequest(...args),
}));

const NOTEBOOK = '01J8X2K9QZ3M4N5P6R7S8T9V0A';
const PUBLIC = '01J8X2K9QZ3M4N5P6R7S8T9V0P';

beforeEach(() => {
  request.mockClear();
  publicRequest.mockClear();
});

describe('what the interface asks of a model (#431)', () => {
  it('creates a notebook from the model itself, with its name and values and no version', async () => {
    const { createFromModel } = await import('./backend');
    await createFromModel(NOTEBOOK, { name: 'Assemblies 2027', values: { city: 'Porto' } });
    expect(request).toHaveBeenCalledWith(`/portability/models/${NOTEBOOK}/notebooks`, {
      method: 'POST',
      body: { name: 'Assemblies 2027', values: { city: 'Porto' } },
    });
  });

  it('reads the model as it stands and its history', async () => {
    const { getModelContents, getModelHistory } = await import('./backend');
    await getModelContents(NOTEBOOK);
    await getModelHistory(NOTEBOOK);
    expect(request.mock.calls.map((call) => call[0])).toEqual([
      `/portability/models/${NOTEBOOK}/contents`,
      `/portability/models/${NOTEBOOK}/history`,
    ]);
  });

  it('reads a published model through the edge, and creates from it signed in', async () => {
    const { createFromCatalog, getCatalogContents, getCatalogHistory } = await import('./backend');
    await getCatalogContents(PUBLIC);
    await getCatalogHistory(PUBLIC);
    await createFromCatalog(PUBLIC, { name: '', values: {} });
    expect(publicRequest.mock.calls.map((call) => call[0])).toEqual([
      `/public/catalog/${PUBLIC}/contents`,
      `/public/catalog/${PUBLIC}/history`,
    ]);
    expect(request).toHaveBeenCalledWith(`/portability/catalog/${PUBLIC}/notebooks`, {
      method: 'POST',
      body: { name: '', values: {} },
    });
  });

  it('asks for no address of a version', async () => {
    const backend = await import('./backend');
    await backend.createFromModel(NOTEBOOK, { name: 'x', values: {} });
    await backend.createFromCatalog(PUBLIC, { name: 'x', values: {} });
    const asked = [...request.mock.calls, ...publicRequest.mock.calls].map((call) =>
      String(call[0]),
    );
    expect(asked.some((path) => path.includes('/versions'))).toBe(false);
    expect(Object.keys(backend).filter((name) => /version/i.test(name))).toEqual([]);
  });
});
