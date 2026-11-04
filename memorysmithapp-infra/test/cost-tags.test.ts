/**
 * The tags the bill of the account is grouped by (#280): which ones the command
 * activates, and that it is safe to run again.
 */

import { describe, expect, it } from 'vitest';
import { COST_TAGS, costTagsRefusal, planCostTags } from '../commands/lib/cost-tags.js';
import { readText } from '../commands/lib/repository.js';

describe('the cost allocation tags', () => {
  it('are the project and the environment, never the version', () => {
    expect([...COST_TAGS]).toEqual(['app:project', 'app:environment']);
    expect(COST_TAGS).not.toContain('app:version');
  });

  it('activates what billing lists as inactive', () => {
    expect(
      planCostTags([
        { TagKey: 'app:project', Status: 'Inactive' },
        { TagKey: 'app:environment', Status: 'Inactive' },
        { TagKey: 'app:version', Status: 'Inactive' },
      ]),
    ).toEqual({ activate: ['app:project', 'app:environment'], active: [], unseen: [] });
  });

  it('activates nothing twice, so running it again changes nothing', () => {
    expect(
      planCostTags([
        { TagKey: 'app:project', Status: 'Active' },
        { TagKey: 'app:environment', Status: 'Active' },
      ]),
    ).toEqual({ activate: [], active: ['app:project', 'app:environment'], unseen: [] });
  });

  it('says which tags billing has not seen yet, instead of failing on them', () => {
    expect(planCostTags([{ TagKey: 'app:environment', Status: 'Active' }])).toEqual({
      activate: [],
      active: ['app:environment'],
      unseen: ['app:project'],
    });
  });

  it('are put on every stack of an environment by the app', () => {
    const app = readText('memorysmithapp-infra/bin/app.ts');
    for (const key of COST_TAGS) expect(app).toContain(`Tags.of(stack).add('${key}'`);
  });
});

describe('a member account of an organization (#380)', () => {
  it('is told that the tags belong to the management account', () => {
    const refusal = costTagsRefusal({
      name: 'AccessDeniedException',
      message:
        "Failed to list Cost Allocation Tags: Linked account doesn't have access to cost allocation tags.",
    });
    expect(refusal).toContain('management account');
    expect(refusal).toContain('Nothing was changed.');
  });

  it('leaves any other refusal to fail as it is', () => {
    expect(
      costTagsRefusal({ name: 'AccessDeniedException', message: 'User is not authorized' }),
    ).toBe(null);
    expect(costTagsRefusal({ name: 'ThrottlingException', message: 'Linked account' })).toBe(null);
  });
});
