/**
 * The version an environment serves and the checks a release passes
 * (architecture-guide.md, sections 20 and 23.3).
 */

import { describe, expect, it } from 'vitest';
import {
  baseVersionOf,
  changelogSection,
  releaseProblems,
  servedVersion,
} from '../commands/lib/release.js';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('the version a deploy serves', () => {
  it('is the version of the packages in production', () => {
    expect(
      servedVersion({
        environment: 'production',
        packageVersion: '0.6.0',
        branch: 'main',
        commitsAhead: 0,
        sha: SHA,
      }),
    ).toBe('0.6.0');
  });

  it('is a release candidate of the version a release branch names, in staging', () => {
    expect(
      servedVersion({
        environment: 'staging',
        packageVersion: '0.5.7',
        branch: 'release/v0.6.0',
        commitsAhead: 12,
        sha: SHA,
      }),
    ).toBe('0.6.0-rc.12+a1b2c3d');
  });

  it('is a development build of the package version on any other branch', () => {
    expect(
      servedVersion({
        environment: 'staging',
        packageVersion: '0.5.7',
        branch: 'fix/banner',
        commitsAhead: 3,
        sha: SHA,
      }),
    ).toBe('0.5.7-dev.3+a1b2c3d');
  });

  it('refuses a package version that is not X.Y.Z', () => {
    expect(() =>
      servedVersion({
        environment: 'production',
        packageVersion: '0.6',
        branch: 'main',
        commitsAhead: 0,
        sha: SHA,
      }),
    ).toThrow('X.Y.Z');
  });
});

const CLAUDE_MD = '## Project identity\n\n### Base version\n0.6.0\n\n### Current state\n';
const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '## [0.6.0] - 2026-09-20',
  '',
  '### Changed',
  '',
  '- A note is named by `name:`. (#109)',
  '',
  '## [0.5.7] - 2026-09-07',
  '',
  '### Fixed',
  '',
  '- An embed in a table cell. (#92)',
  '',
  '[Unreleased]: https://github.com/memorysmithapp/memorysmithapp/compare/v0.6.0...HEAD',
  '[0.6.0]: https://github.com/memorysmithapp/memorysmithapp/compare/v0.5.7...v0.6.0',
].join('\n');

const agreeing = [
  { path: 'package.json', version: '0.6.0' },
  { path: 'memorysmith-infra/package.json', version: '0.6.0' },
];

describe('the checks of a release', () => {
  it('read the base version from CLAUDE.md', () => {
    expect(baseVersionOf(CLAUDE_MD)).toBe('0.6.0');
  });

  it('pass when every manifest, the changelog and the tags agree', () => {
    expect(
      releaseProblems({
        claudeMd: CLAUDE_MD,
        manifests: agreeing,
        changelog: CHANGELOG,
        tagExists: false,
      }),
    ).toEqual([]);
  });

  it('stop a change to what is deployed that did not bump the version, and say so', () => {
    const problems = releaseProblems({
      claudeMd: CLAUDE_MD,
      manifests: agreeing,
      changelog: CHANGELOG,
      tagExists: true,
    });
    expect(problems).toEqual([
      'v0.6.0 is already released. A change to what is deployed needs a new version: bump it on the release branch.',
    ]);
  });

  it('name every manifest that disagrees', () => {
    const problems = releaseProblems({
      claudeMd: CLAUDE_MD,
      manifests: [...agreeing, { path: 'memorysmith-frontend/package.json', version: '0.5.7' }],
      changelog: CHANGELOG,
      tagExists: false,
    });
    expect(problems).toEqual([
      'memorysmith-frontend/package.json is at 0.5.7, and CLAUDE.md declares 0.6.0.',
    ]);
  });

  it('leave alone a manifest that declares no version, which follows the product', () => {
    const problems = releaseProblems({
      claudeMd: CLAUDE_MD,
      manifests: [
        ...agreeing,
        { path: 'memorysmith-backend/packages/markdown-spec/package.json', version: undefined },
      ],
      changelog: CHANGELOG,
      tagExists: false,
    });
    expect(problems).toEqual([]);
  });

  it('refuse a version with no dated section in the changelog', () => {
    const problems = releaseProblems({
      claudeMd: CLAUDE_MD.replace('0.6.0', '0.6.1'),
      manifests: agreeing.map((manifest) => ({ ...manifest, version: '0.6.1' })),
      changelog: CHANGELOG,
      tagExists: false,
    });
    expect(problems).toContain('CHANGELOG.md has no dated section for 0.6.1.');
  });
});

describe('the notes of a release', () => {
  it('are the section of the version, without the compare links', () => {
    expect(changelogSection(CHANGELOG, '0.6.0')).toBe(
      '### Changed\n\n- A note is named by `name:`. (#109)',
    );
  });

  it('do not exist for a version the changelog does not carry', () => {
    expect(changelogSection(CHANGELOG, '0.9.0')).toBeNull();
  });
});
