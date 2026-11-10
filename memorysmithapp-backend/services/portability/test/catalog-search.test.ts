/**
 * The search of the community catalog asks whether each author's subscription
 * grants access once, and all of them at once (#420): it used to ask them one
 * after another, so the answer waited for their sum.
 */

import { describe, expect, it } from 'vitest';
import { SearchCatalog } from '../src/application/Catalog.js';
import type { CatalogEntry, CatalogStore } from '../src/domain/CommunityCatalog.js';

function entryOf(publicId: string, subscriptionId: string, updatedAt: string): CatalogEntry {
  return {
    publicId,
    subscriptionId,
    notebookId: `notebook-${publicId}`,
    ownerUserId: `user-${subscriptionId}`,
    authorName: 'Ana',
    authorEmail: 'ana@example.com',
    name: `Model ${publicId}`,
    objective: 'Procurement',
    description: '',
    audience: '',
    language: 'pt-BR',
    basedOn: null,
    publishedAt: updatedAt,
    updatedAt,
    parameters: [],
  };
}

describe('the search of the catalog', () => {
  it('asks each subscription once, all at once, and keeps out a suspended one', async () => {
    const entries = [
      entryOf('m1', 'sub-a', '2026-11-01T00:00:00.000Z'),
      entryOf('m2', 'sub-b', '2026-11-03T00:00:00.000Z'),
      entryOf('m3', 'sub-a', '2026-11-02T00:00:00.000Z'),
      entryOf('m4', 'sub-c', '2026-11-04T00:00:00.000Z'),
    ];
    const asked: string[] = [];
    let asking = 0;
    let mostAtOnce = 0;
    const search = new SearchCatalog({
      catalog: { list: async () => entries } as unknown as CatalogStore,
      access: {
        grants: async (subscriptionId: string) => {
          asked.push(subscriptionId);
          asking += 1;
          mostAtOnce = Math.max(mostAtOnce, asking);
          await new Promise((resolve) => setTimeout(resolve, 5));
          asking -= 1;
          return subscriptionId !== 'sub-b';
        },
      },
    });

    const found = await search.execute({ text: '', language: null });

    // The newest first, the suspended author's model left out (RN-SUB-007).
    expect(found.map((model) => model.publicId)).toEqual(['m4', 'm3', 'm1']);
    expect([...asked].sort()).toEqual(['sub-a', 'sub-b', 'sub-c']);
    expect(mostAtOnce).toBe(3);
  });
});
