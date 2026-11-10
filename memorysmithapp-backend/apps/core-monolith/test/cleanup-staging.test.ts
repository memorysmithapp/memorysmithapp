/**
 * The staging cleanup (#276, #436): it runs on staging and nowhere else, and
 * it takes only what the functional suite made and then abandoned — the
 * notebooks of an owner gone, the accounts of a run cut short, and an empty
 * subscription whose owner is gone.
 */

import { describe, expect, it } from 'vitest';
import { belongsTo, environmentRefusal, kindOf, main } from '../src/cleanup-staging.js';

describe('the staging cleanup', () => {
  it('refuses production by name, and any environment that is not staging', async () => {
    expect(environmentRefusal('staging')).toBeNull();
    expect(environmentRefusal('production')).toMatch(/staging only; this is production/);
    expect(environmentRefusal('demo')).not.toBeNull();

    process.env['ENVIRONMENT'] = 'production';
    try {
      // It refuses before it reads a table, so no other variable is needed.
      expect(await main(['--apply'])).toBe(1);
    } finally {
      delete process.env['ENVIRONMENT'];
    }
  });

  it('takes a subscription of the suite once its owner is gone, or its run was cut short (#436)', () => {
    const suite = 'functional-mabc123-owner@example.com';
    const now = new Date('2026-11-11T12:00:00.000Z');
    const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000);
    const kind = (ownerEmail: string, ownerExists: boolean, hoursAgo: number) =>
      kindOf({ ownerEmail, ownerExists, requestedAt: at(hoursAgo), now });
    expect(kind(suite, false, 1)).toBe('leftover');
    // A run in progress: its accounts exist, and it began minutes ago.
    expect(kind(suite, true, 1)).toBe('running');
    // A run cut short: its accounts exist a day later.
    expect(kind(suite, true, 24)).toBe('stale');
    // A person, whatever became of their account and however old it is.
    expect(kind('somebody@gmail.com', false, 100)).toBe('person');
    expect(kind('somebody@example.com.br', true, 100)).toBe('person');
  });

  it('removes the items of a subscription, and of nobody else, read off their keys (#436)', () => {
    const removed = new Set(['01GONE']);
    for (const PK of ['S#01GONE', 'S#01GONE#NOTEBOOKS', 'S#01GONE#USER#u1', 'S#01GONE|x']) {
      expect(belongsTo({ PK, SK: 'META' }, removed)).toBe(true);
    }
    expect(belongsTo({ PK: 'USER#u1', SK: 'SUB#01GONE' }, removed)).toBe(true);
    // Another subscription, one whose id starts the same, a share and the catalog stay.
    expect(belongsTo({ PK: 'S#01KEPT', SK: 'META' }, removed)).toBe(false);
    expect(belongsTo({ PK: 'S#01GONEXX', SK: 'META' }, removed)).toBe(false);
    expect(belongsTo({ PK: 'USER#u1', SK: 'SUB#01KEPT' }, removed)).toBe(false);
    expect(belongsTo({ PK: 'USER#u1', SK: 'SHARED#nb' }, removed)).toBe(false);
    expect(belongsTo({ PK: 'CATALOG', SK: 'MODEL#01GONE' }, removed)).toBe(false);
  });
});
