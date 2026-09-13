import { describe, expect, it } from 'vitest';
import { environmentDeclared } from './EnvironmentBanner';

describe('the environment banner', () => {
  it('declares nothing in production', () => {
    expect(environmentDeclared({ environment: 'production', version: '0.6.0' })).toBeNull();
  });

  it('declares the environment and the exact version everywhere else', () => {
    expect(environmentDeclared({ environment: 'staging', version: '0.6.0-rc.12+a1b2c3d' })).toEqual(
      { environment: 'staging', version: '0.6.0-rc.12+a1b2c3d' },
    );
  });

  it('declares nothing before the configuration is loaded', () => {
    expect(environmentDeclared(null)).toBeNull();
  });
});
