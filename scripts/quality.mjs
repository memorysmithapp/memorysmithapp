#!/usr/bin/env node
// The checks of the Quality workflow: what the documents promise about themselves and the version.
// No dependency beyond Node. Run from the root: `pnpm run quality`.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES,
  compareVersions,
  isSemver,
  linkedRepositories,
  namesRepository,
  parseChangelog,
  releasedSections,
  repositoryFromRemote,
} from './lib/changelog.mjs';

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage']);
// Paths from the root that are skipped whole: the worktrees Claude Code creates, each a full copy
// of the repository.
const IGNORED_PATHS = new Set(['.claude/worktrees']);

// Lines that are a version note rather than content: "Last revised …", "Internal development
// document", and the like, at the start of a line, after any list, quote or emphasis marker.
const FOOTER =
  /^\s*(?:[>*_+-]\s*)*(?:last\s+(?:revised|updated|modified|reviewed)|revision\s+date|internal\s+(?:development\s+)?document)\b/i;

function readText(root, path) {
  return readFileSync(join(root, path), 'utf8');
}

// The files git tracks or would track: tracked, and untracked but not ignored. Null when the root
// is not a git work tree, as in the tests' fixtures, which are then walked whole.
function gitFiles(root) {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    // A file deleted in the work tree is still in the index until the deletion is staged.
    return out.split('\0').filter((file) => file !== '' && existsSync(join(root, file)));
  } catch {
    return null;
  }
}

function walk(root, directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const path = relative(root, join(directory, entry.name)).split(sep).join('/');
      if (!IGNORED_DIRECTORIES.has(entry.name) && !IGNORED_PATHS.has(path))
        files.push(...walk(root, join(directory, entry.name)));
    } else {
      files.push(relative(root, join(directory, entry.name)).split(sep).join('/'));
    }
  }
  return files;
}

// The Markdown files the checks read: what git tracks or would track, so a checkout or an output
// that .gitignore keeps out of the repository — the comparison's MemorySmith checkout among them —
// is never read as one of its documents.
export function markdownFiles(root) {
  return (gitFiles(root) ?? walk(root, root))
    .filter((file) => file.toLowerCase().endsWith('.md'))
    .sort();
}

// The lines of a Markdown file outside fenced code blocks, each with its number, and with inline
// code spans blanked, unless asked otherwise, so that nothing quoted as code is read as a link or a
// footer.
export function proseLines(text, { blankCode = true } = {}) {
  const out = [];
  let fence = null;
  text.split('\n').forEach((line, index) => {
    const opening = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (opening && opening[1][0] === fence[0] && opening[1].length >= fence.length) fence = null;
      return;
    }
    if (opening) {
      fence = opening[1];
      return;
    }
    out.push({
      line: index + 1,
      text: blankCode ? line.replace(/(`+)[^`]*?\1/g, (span) => ' '.repeat(span.length)) : line,
    });
  });
  return out;
}

// GitHub's anchor for a heading: lowercase, punctuation dropped, spaces turned into hyphens, and
// "-1", "-2"… appended to repeated headings.
export function headingAnchors(text) {
  const anchors = new Set();
  const seen = new Map();
  for (const { text: line } of proseLines(text, { blankCode: false })) {
    for (const html of line.matchAll(/<a\s+(?:[^>]*\s)?(?:id|name)="([^"]+)"/gi))
      anchors.add(html[1]);
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!heading) continue;
    const slug = heading[1]
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

function linkTargets(text) {
  const targets = [];
  for (const { line, text: content } of proseLines(text)) {
    for (const match of content.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      targets.push({ line, target: match[1].replace(/^<|>$/g, '') });
    }
    // A footnote definition, `[^label]: text`, has the shape of a link definition and is prose.
    const definition = content.match(/^\s{0,3}\[(?!\^)[^\]]+\]:\s*(<[^>]*>|\S+)/);
    if (definition) targets.push({ line, target: definition[1].replace(/^<|>$/g, '') });
  }
  return targets;
}

function currentBranch(root) {
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return '';
  }
}

function currentRepository(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    return repositoryFromRemote(
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return null;
  }
}

// 1. The version has one home, and the changelog agrees with it.
export function checkVersion(root, branch) {
  const problems = [];
  if (!existsSync(join(root, 'package.json'))) return ['package.json: missing at the root'];
  let version;
  try {
    version = JSON.parse(readText(root, 'package.json')).version;
  } catch (error) {
    return [`package.json: not valid JSON (${error.message})`];
  }
  if (!isSemver(version))
    return [`package.json: "version" must be a SemVer version, got ${JSON.stringify(version)}`];
  if (!existsSync(join(root, 'CHANGELOG.md'))) return ['CHANGELOG.md: missing at the root'];

  const released = releasedSections(parseChangelog(readText(root, 'CHANGELOG.md')));
  const latest = released[0]?.title;
  if (latest === version) return problems;
  if (
    branch === `release/v${version}` &&
    (!latest || (isSemver(latest) && compareVersions(version, latest) > 0))
  ) {
    return problems;
  }
  if (!latest && version === '0.1.0') return problems;
  problems.push(
    latest
      ? `package.json: version ${version} is not the latest released section of CHANGELOG.md (${latest}), and the branch "${branch}" is not release/v${version} bumping to it`
      : `package.json: version ${version} has no released section in CHANGELOG.md, and the branch "${branch}" is not release/v${version}`,
  );
  return problems;
}

// 2. The changelog keeps the format of Keep a Changelog 1.1.0.
export function checkChangelog(root) {
  if (!existsSync(join(root, 'CHANGELOG.md'))) return ['CHANGELOG.md: missing at the root'];
  const changelog = parseChangelog(readText(root, 'CHANGELOG.md'));
  const problems = [];
  const at = (line) => `CHANGELOG.md:${line}`;

  if (changelog.sections[0]?.title !== 'Unreleased') {
    problems.push(
      `${at(changelog.sections[0]?.line ?? 1)}: the first section must be "## [Unreleased]"`,
    );
  }
  for (const other of changelog.otherH2) {
    problems.push(
      `${at(other.line)}: "${other.text}" is not "## [Unreleased]" nor "## [X.Y.Z] - YYYY-MM-DD"`,
    );
  }
  let previous = null;
  for (const section of changelog.sections) {
    if (section.title === 'Unreleased') {
      if (section !== changelog.sections[0])
        problems.push(`${at(section.line)}: [Unreleased] must be the first section`);
      if (section.date) problems.push(`${at(section.line)}: [Unreleased] carries no date`);
    } else {
      if (!isSemver(section.title))
        problems.push(`${at(section.line)}: [${section.title}] is not a SemVer version`);
      if (!section.date)
        problems.push(`${at(section.line)}: [${section.title}] needs " - YYYY-MM-DD" after it`);
      if (
        previous &&
        isSemver(previous) &&
        isSemver(section.title) &&
        compareVersions(previous, section.title) <= 0
      ) {
        problems.push(
          `${at(section.line)}: [${section.title}] must be older than [${previous}] above it`,
        );
      }
      previous = section.title;
    }
    for (const { line, text } of section.lines) {
      const category = text.match(/^###\s+(.*?)\s*$/);
      if (category && !CATEGORIES.includes(category[1])) {
        problems.push(
          `${at(line)}: "${category[1]}" is not a Keep a Changelog category (${CATEGORIES.join(', ')})`,
        );
      }
      if (/^#{4,}\s/.test(text) || /^#\s/.test(text))
        problems.push(
          `${at(line)}: only "## [version]" and "### Category" headings belong in a section`,
        );
    }
    if (!changelog.links.has(section.title.toLowerCase())) {
      problems.push(`${at(section.line)}: [${section.title}] has no compare link at the foot`);
    }
  }
  if (changelog.firstLinkLine !== -1) {
    const trailing = changelog.lines.slice(changelog.firstLinkLine - 1);
    trailing.forEach((text, offset) => {
      if (text.trim() !== '' && !/^\[[^\]]+\]:\s*\S+\s*$/.test(text)) {
        problems.push(
          `${at(changelog.firstLinkLine + offset)}: only link definitions belong after the first one, at the foot`,
        );
      }
    });
  }
  return problems;
}

// 3. .claude/CLAUDE.md is exactly the import of AGENTS.md, and no CLAUDE.md sits at the root. An
// import resolves from the file that holds it, so `@AGENTS.md` there would load nothing, silently.
export function checkClaude(root) {
  const problems = [];
  if (existsSync(join(root, 'CLAUDE.md')))
    problems.push(
      'CLAUDE.md: must not exist at the root; it lives in .claude/CLAUDE.md, and both would load',
    );
  if (!existsSync(join(root, '.claude/CLAUDE.md')))
    return [...problems, '.claude/CLAUDE.md: missing'];
  const text = readText(root, '.claude/CLAUDE.md');
  if (text !== '@../AGENTS.md\n' && text !== '@../AGENTS.md')
    problems.push('.claude/CLAUDE.md: must be exactly the line "@../AGENTS.md"');
  return problems;
}

// 4. Every relative link, and every anchor, of every Markdown file resolves.
export function checkLinks(root) {
  const problems = [];
  const anchorCache = new Map();
  const anchorsOf = (path) => {
    if (!anchorCache.has(path)) anchorCache.set(path, headingAnchors(readFileSync(path, 'utf8')));
    return anchorCache.get(path);
  };
  for (const file of markdownFiles(root)) {
    const absolute = join(root, file);
    for (const { line, target } of linkTargets(readFileSync(absolute, 'utf8'))) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) continue;
      const hash = target.indexOf('#');
      const pathPart = decodeURIComponent(hash === -1 ? target : target.slice(0, hash));
      const anchor = hash === -1 ? null : decodeURIComponent(target.slice(hash + 1));
      const resolved =
        pathPart === ''
          ? absolute
          : pathPart.startsWith('/')
            ? join(root, pathPart)
            : resolve(dirname(absolute), pathPart);
      if (!existsSync(resolved)) {
        problems.push(`${file}:${line}: "${target}" points at a file that does not exist`);
        continue;
      }
      if (
        anchor &&
        statSync(resolved).isFile() &&
        resolved.toLowerCase().endsWith('.md') &&
        !anchorsOf(resolved).has(anchor)
      ) {
        problems.push(`${file}:${line}: "${target}" points at an anchor that does not exist`);
      }
    }
  }
  return problems;
}

// 5. No document carries a version footer.
export function checkFooters(root) {
  const problems = [];
  for (const file of markdownFiles(root)) {
    for (const { line, text } of proseLines(readText(root, file))) {
      if (FOOTER.test(text))
        problems.push(
          `${file}:${line}: a version note or footer ("${text.trim()}"); history lives in CHANGELOG.md and git`,
        );
    }
  }
  return problems;
}

// 6. The links at the foot of the changelog name this repository, which is what lets the release
// workflow publish here: a copy that still links to the repository it came from releases nothing.
export function checkChangelogRepository(root, repository) {
  if (!existsSync(join(root, 'CHANGELOG.md'))) return ['CHANGELOG.md: missing at the root'];
  if (!repository)
    return [
      'cannot tell which repository this is: set GITHUB_REPOSITORY or add an origin remote on GitHub',
    ];
  const changelog = parseChangelog(readText(root, 'CHANGELOG.md'));
  if (namesRepository(changelog, repository)) return [];
  const linked = [...linkedRepositories(changelog)].join(', ') || 'no GitHub repository';
  return [
    `CHANGELOG.md: the links at the foot name ${linked}, not ${repository}; rewrite them for this repository; a repository created from memorysmithapp-template rewrites them when it is adopted`,
  ];
}

// The directories pnpm-workspace.yaml names, read from its `packages:` list. Only the two forms this
// repository uses are understood: a directory, and a directory followed by `/*`.
export function workspacePackages(root) {
  if (!existsSync(join(root, 'pnpm-workspace.yaml'))) return [];
  const directories = [];
  let inPackages = false;
  for (const line of readText(root, 'pnpm-workspace.yaml').split('\n')) {
    if (/^\S/.test(line)) inPackages = /^packages:\s*$/.test(line);
    const entry = inPackages && line.match(/^\s+-\s+['"]?([^'"#\s]+)['"]?/);
    if (!entry) continue;
    const pattern = entry[1].replace(/\/$/, '');
    if (pattern.endsWith('/*')) {
      const parent = join(root, pattern.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const child of readdirSync(parent, { withFileTypes: true })) {
        if (child.isDirectory()) directories.push(`${pattern.slice(0, -2)}/${child.name}`);
      }
    } else {
      directories.push(pattern);
    }
  }
  return directories
    .filter((directory) => existsSync(join(root, directory, 'package.json')))
    .sort();
}

// 7. Every package of the workspace carries the one version, and a published one is public: the
// root package.json is the home of the version, and the npm organisation publishes public packages only.
export function checkWorkspaceVersions(root) {
  const problems = [];
  let version;
  try {
    version = JSON.parse(readText(root, 'package.json')).version;
  } catch {
    return ['package.json: missing or not valid JSON at the root'];
  }
  for (const directory of workspacePackages(root)) {
    const path = `${directory}/package.json`;
    let manifest;
    try {
      manifest = JSON.parse(readText(root, path));
    } catch (error) {
      problems.push(`${path}: not valid JSON (${error.message})`);
      continue;
    }
    if (manifest.private === true) {
      if (manifest.version !== undefined && manifest.version !== version) {
        problems.push(
          `${path}: version ${manifest.version} differs from the root's ${version}; a private package declares the root's version or none`,
        );
      }
      continue;
    }
    if (manifest.version !== version) {
      problems.push(
        `${path}: version ${JSON.stringify(manifest.version)} differs from the root's ${version}`,
      );
    }
    if (manifest.publishConfig?.access !== 'public') {
      problems.push(
        `${path}: a published package declares "publishConfig": { "access": "public" }, or "private": true when it is never published`,
      );
    }
  }
  return problems;
}

export function runChecks(
  root,
  branch = currentBranch(root),
  repository = currentRepository(root),
) {
  return [
    {
      name: 'The version has one home and agrees with CHANGELOG.md',
      problems: checkVersion(root, branch),
    },
    { name: 'CHANGELOG.md keeps the Keep a Changelog format', problems: checkChangelog(root) },
    { name: '.claude/CLAUDE.md is exactly @../AGENTS.md', problems: checkClaude(root) },
    { name: 'Relative links and anchors resolve', problems: checkLinks(root) },
    { name: 'No document carries a version footer', problems: checkFooters(root) },
    {
      name: 'CHANGELOG.md links to this repository',
      problems: checkChangelogRepository(root, repository),
    },
    {
      name: 'Every package of the workspace carries the one version',
      problems: checkWorkspaceVersions(root),
    },
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? '.');
  const results = runChecks(root);
  for (const { name, problems } of results) {
    process.stdout.write(`${problems.length === 0 ? 'ok  ' : 'FAIL'} ${name}\n`);
    for (const problem of problems) process.stdout.write(`       ${problem}\n`);
  }
  const failed = results.filter((r) => r.problems.length > 0).length;
  process.stdout.write(
    failed === 0 ? '\nAll checks passed.\n' : `\n${failed} of ${results.length} checks failed.\n`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}
