import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { ok, SubscriptionId, type SubscriptionContext } from '@memorysmith/kernel';
import {
  createDiscoveryRoutes,
  type DiscoveryRequest,
  type DiscoveryUseCases,
} from '../src/adapters/routes.js';

const NOTEBOOK = '01JBQ2X00000000000000000V1';

function app(asked: string[]): Hono {
  const useCases = {
    health: () => ({
      execute: async () => ok({ orphans: [], pending: [] }),
    }),
  } as unknown as DiscoveryUseCases;
  const subscription = SubscriptionId.fromClaim(NOTEBOOK);
  if (!subscription.ok) throw new Error('fixture');
  const request: DiscoveryRequest = {
    subscription: { subscriptionId: subscription.value } as unknown as SubscriptionContext,
    canRead: async (notebookId) => {
      asked.push(notebookId);
      return notebookId === NOTEBOOK;
    },
  };
  const root = new Hono<{ Variables: { discovery: DiscoveryRequest } }>();
  root.use('*', async (c, next) => {
    c.set('discovery', request);
    await next();
  });
  root.route('/', createDiscoveryRoutes(useCases));
  return root as unknown as Hono;
}

describe('The routes of Discovery read an identifier of the path', () => {
  it('in either case, as the address of a page writes it (#247)', async () => {
    const asked: string[] = [];
    const response = await app(asked).request(`/notebooks/${NOTEBOOK.toLowerCase()}/health`);
    expect(response.status).toBe(200);
    expect(asked).toEqual([NOTEBOOK]);
  });

  it('and answer a segment that is not one as such, not as a notebook out of reach (#248)', async () => {
    const asked: string[] = [];
    const response = await app(asked).request('/notebooks/abc/health');
    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('VALIDATION');
    expect(asked).toEqual([]);
  });
});
