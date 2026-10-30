/**
 * The environments a tool reaches: read from `cdk.json`, and named the way the
 * infrastructure names its stacks. The same ids are pinned by the teardown
 * test of the infrastructure, so the two sides agree without importing each
 * other.
 */

import { describe, expect, it } from 'vitest';
import { declaredEnvironment, stackIdOf } from '../commands/lib/environments.js';

describe('an environment a tool reaches', () => {
  it('is the one cdk.json declares', () => {
    expect(declaredEnvironment('staging')?.hostedZoneName).toBe('stg.memorysmith.app');
    expect(declaredEnvironment('nowhere')).toBeUndefined();
  });

  it('names its stacks as the infrastructure does', () => {
    expect(stackIdOf('staging', 'FrontendRelease')).toBe('MemorysmithStagingFrontendRelease');
    expect(stackIdOf('production', 'Identity')).toBe('MemorysmithProductionIdentity');
  });
});
