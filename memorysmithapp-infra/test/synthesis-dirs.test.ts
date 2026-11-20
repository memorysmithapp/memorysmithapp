/**
 * A case synthesises into a directory the file removes when it ends (#512):
 * an app built without an `outdir` stages its assets, the
 * renderer's browser layer among them, where nothing removes them.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the synthesis directories of the tests (#512)', () => {
  it('are made by appFor or testApp alone', () => {
    const here = import.meta.dirname;
    const builders = readdirSync(here)
      .filter((file) => file.endsWith('.ts') && file !== 'stacks.ts')
      .filter((file) => readFileSync(join(here, file), 'utf8').includes('new App' + '('));
    expect(builders).toEqual([]);
  });
});
