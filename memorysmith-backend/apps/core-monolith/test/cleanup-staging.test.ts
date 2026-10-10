/**
 * The staging cleanup (#276): it runs on staging and nowhere else, and it
 * takes only what the functional suite made and then abandoned.
 */

import { describe, expect, it } from 'vitest';
import { environmentRefusal, isLeftover, main } from '../src/cleanup-staging.js';

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

  it('takes a subscription of the suite only once its owner is gone', () => {
    const suite = 'functional-mabc123-owner@example.com';
    expect(isLeftover({ ownerEmail: suite, ownerExists: false })).toBe(true);
    // A run in progress: its accounts still exist.
    expect(isLeftover({ ownerEmail: suite, ownerExists: true })).toBe(false);
    // A person, whatever became of their account.
    expect(isLeftover({ ownerEmail: 'somebody@gmail.com', ownerExists: false })).toBe(false);
    expect(isLeftover({ ownerEmail: 'somebody@example.com.br', ownerExists: false })).toBe(false);
  });
});
