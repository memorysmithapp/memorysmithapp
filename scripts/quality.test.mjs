// Each check of quality.mjs passes on a well-formed repository and fails on a deliberate violation.
// Run from the root: `pnpm test`.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, test } from 'node:test';
import { parseChangelog, releaseNotes } from './lib/changelog.mjs';
import {
  checkChangelog,
  checkChangelogRepository,
  checkClaude,
  checkFooters,
  checkLinks,
  checkVersion,
  checkWorkspaceVersions,
  headingAnchors,
  runChecks,
} from './quality.mjs';

const CHANGELOG = `# Changelog

Intro with a [link](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Something new.

## [0.2.0] - 2026-10-20

### Fixed

- A fix.

## [0.1.0] - 2026-10-12

### Added

- The first version.

[unreleased]: https://github.com/o/r/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/o/r/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/o/r/releases/tag/v0.1.0
`;

const FILES = {
  'package.json': JSON.stringify({ name: '@memorysmithapp/x', version: '0.2.0' }),
  'CHANGELOG.md': CHANGELOG,
  '.claude/CLAUDE.md': '@../AGENTS.md\n',
  'AGENTS.md':
    '# Agents\n\nSee [the invariant](ARCHITECTURE.md#inv-01-the-version-has-one-home) and [below](#2-reading-map).\n\n## 2. Reading map\n\nText.\n',
  'ARCHITECTURE.md':
    '# Architecture\n\n### INV-01 The version has one home\n\n```md\n[not a link](missing.md)\nLast revised: inside a code block is fine\n```\n',
  'docs/guide.md': 'Back to [the agents](../AGENTS.md).\n',
};

let roots = [];

function repository(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'quality-'));
  roots.push(root);
  for (const [path, content] of Object.entries({ ...FILES, ...overrides })) {
    if (content === null) continue;
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

test('a well-formed repository passes every check', () => {
  for (const { name, problems } of runChecks(repository(), 'main', 'o/r'))
    assert.deepEqual(problems, [], name);
});

describe('1. the version has one home and agrees with the changelog', () => {
  test('fails when package.json has no version', () => {
    const root = repository({ 'package.json': '{"name":"x"}' });
    assert.match(checkVersion(root, 'main')[0], /must be a SemVer version/);
  });

  test('fails when the version is not the latest released section', () => {
    const root = repository({ 'package.json': '{"version":"0.3.0"}' });
    assert.match(checkVersion(root, 'main')[0], /not the latest released section/);
  });

  test('passes on the release branch bumping to the version', () => {
    const root = repository({ 'package.json': '{"version":"0.3.0"}' });
    assert.deepEqual(checkVersion(root, 'release/v0.3.0'), []);
  });

  test('fails on a release branch of another version', () => {
    const root = repository({ 'package.json': '{"version":"0.3.0"}' });
    assert.equal(checkVersion(root, 'release/v0.4.0').length, 1);
  });

  test('fails on a release branch going backwards', () => {
    const root = repository({ 'package.json': '{"version":"0.1.5"}' });
    assert.equal(checkVersion(root, 'release/v0.1.5').length, 1);
  });

  test('passes on 0.1.0 before the first cut', () => {
    const unreleasedOnly =
      '# Changelog\n\n## [Unreleased]\n\n[unreleased]: https://github.com/o/r/commits/main\n';
    const root = repository({
      'package.json': '{"version":"0.1.0"}',
      'CHANGELOG.md': unreleasedOnly,
    });
    assert.deepEqual(checkVersion(root, 'docs/x'), []);
  });
});

describe('2. CHANGELOG.md keeps its format', () => {
  test('fails when [Unreleased] is not on top', () => {
    const root = repository({
      'CHANGELOG.md': CHANGELOG.replace('## [Unreleased]\n\n### Added\n\n- Something new.\n\n', ''),
    });
    assert.ok(checkChangelog(root).some((p) => /first section must be/.test(p)));
  });

  test('fails on a category Keep a Changelog does not have', () => {
    const root = repository({ 'CHANGELOG.md': CHANGELOG.replace('### Fixed', '### Improvements') });
    assert.ok(
      checkChangelog(root).some((p) => /"Improvements" is not a Keep a Changelog category/.test(p)),
    );
  });

  test('fails when a section has no compare link', () => {
    const root = repository({ 'CHANGELOG.md': CHANGELOG.replace(/\[0\.2\.0\]: .*\n/, '') });
    assert.ok(checkChangelog(root).some((p) => /\[0\.2\.0\] has no compare link/.test(p)));
  });

  test('fails when a released section has no date', () => {
    const root = repository({
      'CHANGELOG.md': CHANGELOG.replace('## [0.2.0] - 2026-10-20', '## [0.2.0]'),
    });
    assert.ok(checkChangelog(root).some((p) => /needs " - YYYY-MM-DD"/.test(p)));
  });

  test('fails when versions are out of order', () => {
    const swapped = CHANGELOG.replace('## [0.2.0] - 2026-10-20', '## [0.0.9] - 2026-10-20').replace(
      '[0.2.0]:',
      '[0.0.9]:',
    );
    assert.ok(
      checkChangelog(repository({ 'CHANGELOG.md': swapped })).some((p) =>
        /must be older than/.test(p),
      ),
    );
  });

  test('fails on content after the links at the foot', () => {
    const root = repository({ 'CHANGELOG.md': `${CHANGELOG}\nA stray paragraph.\n` });
    assert.ok(checkChangelog(root).some((p) => /only link definitions belong/.test(p)));
  });
});

describe('3. .claude/CLAUDE.md is exactly @../AGENTS.md', () => {
  test('fails when .claude/CLAUDE.md says anything else', () => {
    const root = repository({ '.claude/CLAUDE.md': '@../AGENTS.md\n\nAlso read the docs.\n' });
    assert.equal(checkClaude(root).length, 1);
  });

  test('fails when .claude/CLAUDE.md only mentions AGENTS.md in prose', () => {
    assert.equal(checkClaude(repository({ '.claude/CLAUDE.md': 'Read AGENTS.md.\n' })).length, 1);
  });

  test('fails on @AGENTS.md, which inside .claude/ imports nothing', () => {
    assert.match(
      checkClaude(repository({ '.claude/CLAUDE.md': '@AGENTS.md\n' }))[0],
      /exactly the line "@\.\.\/AGENTS\.md"/,
    );
  });

  test('fails when .claude/CLAUDE.md is missing', () => {
    assert.match(checkClaude(repository({ '.claude/CLAUDE.md': null }))[0], /missing/);
  });

  test('fails when a CLAUDE.md also exists at the root', () => {
    assert.match(
      checkClaude(repository({ 'CLAUDE.md': '@AGENTS.md\n' }))[0],
      /must not exist at the root/,
    );
  });
});

describe('4. relative links and anchors resolve', () => {
  test('fails on a link to a missing file', () => {
    const root = repository({ 'docs/guide.md': 'See [nothing](../NOPE.md).\n' });
    assert.match(
      checkLinks(root)[0],
      /docs\/guide\.md:1: "\.\.\/NOPE\.md" points at a file that does not exist/,
    );
  });

  test('fails on a link to a missing anchor in another file', () => {
    const root = repository({ 'AGENTS.md': 'See [it](ARCHITECTURE.md#inv-09-gone).\n' });
    assert.match(checkLinks(root)[0], /points at an anchor that does not exist/);
  });

  test('fails on a missing anchor in the same file', () => {
    assert.equal(checkLinks(repository({ 'AGENTS.md': '[here](#nowhere)\n' })).length, 1);
  });

  test('skips the worktrees under .claude/worktrees', () => {
    assert.deepEqual(
      checkLinks(repository({ '.claude/worktrees/w/AGENTS.md': 'See [nothing](NOPE.md).\n' })),
      [],
    );
  });

  test('still reads a worktrees directory anywhere else', () => {
    assert.equal(
      checkLinks(repository({ 'docs/worktrees/guide.md': 'See [nothing](NOPE.md).\n' })).length,
      1,
    );
  });

  test('ignores links inside code', () => {
    assert.deepEqual(
      checkLinks(repository({ 'AGENTS.md': 'Write `[x](missing.md)` like this.\n' })),
      [],
    );
  });

  test('reads a footnote definition as prose, not as a link definition', () => {
    const root = repository({
      'docs/notes.md': 'A claim.[^1]\n\n[^1]: 43,200 minutes, by the contract.\n',
    });
    assert.deepEqual(checkLinks(root), []);
  });

  test('reads only what git tracks or would track, never what .gitignore keeps out', () => {
    const root = repository({
      '.gitignore': 'checkout/\n',
      'checkout/docs/guide.md': 'A [broken](missing.md) link of another repository.\n',
    });
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    assert.deepEqual(checkLinks(root), []);
    writeFileSync(join(root, 'untracked.md'), 'A [broken](missing.md) link not yet added.\n');
    assert.match(
      checkLinks(root)[0],
      /^untracked\.md:1: "missing\.md" points at a file that does not exist/,
    );
  });

  test('builds anchors the way GitHub does', () => {
    const anchors = headingAnchors(
      "## 4.1 When a commit touches `PRD.md`\n### INV-02 CLAUDE.md is only the import\n## ADR-005 GitHub's defaults, for issues\n## Repeat\n## Repeat\n",
    );
    for (const anchor of [
      '41-when-a-commit-touches-prdmd',
      'inv-02-claudemd-is-only-the-import',
      'adr-005-githubs-defaults-for-issues',
      'repeat',
      'repeat-1',
    ]) {
      assert.ok(anchors.has(anchor), anchor);
    }
  });
});

describe('5. no document carries a version footer', () => {
  for (const footer of [
    '_Last revised: 2026-10-12_',
    'Last updated 2026-10-12, version 0.1.0',
    '*Internal development document*',
    '> Internal document — do not distribute',
  ]) {
    test(`fails on "${footer}"`, () => {
      const root = repository({ 'docs/guide.md': `Content.\n\n---\n\n${footer}\n` });
      assert.equal(checkFooters(root).length, 1);
    });
  }

  test('allows the words inside a sentence', () => {
    assert.deepEqual(
      checkFooters(repository({ 'docs/guide.md': 'No "last revised" footers here.\n' })),
      [],
    );
  });
});

describe('6. CHANGELOG.md links to this repository', () => {
  test('passes when every foot link names the repository, whatever the case', () => {
    assert.deepEqual(checkChangelogRepository(repository(), 'O/R'), []);
  });

  test('fails in a copy whose links still name the repository it came from', () => {
    assert.match(
      checkChangelogRepository(repository(), 'memorysmithapp/created')[0],
      /name o\/r, not memorysmithapp\/created/,
    );
  });

  test('fails when one link names another repository', () => {
    const mixed = CHANGELOG.replace(
      '[0.1.0]: https://github.com/o/r/',
      '[0.1.0]: https://github.com/o/elsewhere/',
    );
    assert.equal(checkChangelogRepository(repository({ 'CHANGELOG.md': mixed }), 'o/r').length, 1);
  });

  test('fails when it cannot tell which repository it runs in', () => {
    assert.match(checkChangelogRepository(repository(), null)[0], /cannot tell which repository/);
  });
});

describe('7. every package of the workspace carries the one version', () => {
  const workspace = {
    'pnpm-workspace.yaml':
      "packages:\n  - 'packages/*'\n  - playground\n\nallowBuilds:\n  - not-a-package\n",
    'packages/a/package.json': JSON.stringify({
      name: '@memorysmithapp/a',
      version: '0.2.0',
      publishConfig: { access: 'public' },
    }),
    'packages/b/package.json': JSON.stringify({
      name: '@memorysmithapp/b',
      version: '0.2.0',
      publishConfig: { access: 'public' },
    }),
    'playground/package.json': JSON.stringify({ name: 'playground', private: true }),
  };

  test('passes when every package has the root version', () => {
    assert.deepEqual(checkWorkspaceVersions(repository(workspace)), []);
  });

  test('passes in a repository with no workspace', () => {
    assert.deepEqual(checkWorkspaceVersions(repository()), []);
  });

  test('fails when a package version differs from the root', () => {
    const problems = checkWorkspaceVersions(
      repository({
        ...workspace,
        'packages/b/package.json': JSON.stringify({
          name: '@memorysmithapp/b',
          version: '0.1.9',
          publishConfig: { access: 'public' },
        }),
      }),
    );
    assert.equal(problems.length, 1);
    assert.match(
      problems[0],
      /packages\/b\/package.json: version "0.1.9" differs from the root's 0.2.0/,
    );
  });

  test('fails when a published package is not declared public', () => {
    const problems = checkWorkspaceVersions(
      repository({
        ...workspace,
        'packages/a/package.json': JSON.stringify({ name: '@memorysmithapp/a', version: '0.2.0' }),
      }),
    );
    assert.match(problems[0], /publishConfig/);
  });

  test('fails when a private package declares another version', () => {
    const problems = checkWorkspaceVersions(
      repository({
        ...workspace,
        'playground/package.json': JSON.stringify({ private: true, version: '9.9.9' }),
      }),
    );
    assert.match(problems[0], /playground\/package.json: version 9.9.9 differs/);
  });
});

test('the release notes of a version are the body of its section', () => {
  assert.equal(releaseNotes(parseChangelog(CHANGELOG), '0.2.0'), '### Fixed\n\n- A fix.');
  assert.equal(releaseNotes(parseChangelog(CHANGELOG), '9.9.9'), null);
});
