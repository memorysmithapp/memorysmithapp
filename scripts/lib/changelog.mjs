// Reads a CHANGELOG.md written in Keep a Changelog 1.1.0. Shared by the quality checks and the
// release workflow, so both read the same sections the same way.

export const CATEGORIES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const SECTION = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/;
const LINK_DEFINITION = /^\[([^\]]+)\]:\s*(\S+)\s*$/;

export function isSemver(version) {
  return typeof version === 'string' && SEMVER.test(version);
}

// Negative when a precedes b, positive when it follows, 0 when equal. Pre-release tags are
// compared as text, which is enough for the versions this organisation cuts.
export function compareVersions(a, b) {
  const [coreA, preA = ''] = a.split('-', 2);
  const [coreB, preB = ''] = b.split('-', 2);
  const partsA = coreA.split('.').map(Number);
  const partsB = coreB.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) return partsA[i] - partsB[i];
  }
  if (preA === preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return preA < preB ? -1 : 1;
}

// Splits the file into its version sections (`## [...]`), the lines of each, and the link
// definitions at the foot.
export function parseChangelog(text) {
  const lines = text.split('\n');
  const sections = [];
  const links = new Map();
  const otherH2 = [];
  let firstLinkLine = -1;
  let current = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const definition = line.match(LINK_DEFINITION);
    if (definition) {
      links.set(definition[1].toLowerCase(), { url: definition[2], line: lineNumber });
      if (firstLinkLine === -1) firstLinkLine = lineNumber;
      current = null;
      return;
    }
    if (line.startsWith('## ')) {
      const match = line.match(SECTION);
      if (!match) {
        otherH2.push({ line: lineNumber, text: line });
        current = null;
        return;
      }
      current = { title: match[1], date: match[2] ?? null, line: lineNumber, lines: [] };
      sections.push(current);
      return;
    }
    if (current) current.lines.push({ line: lineNumber, text: line });
  });

  return { lines, sections, links, otherH2, firstLinkLine };
}

export function releasedSections(changelog) {
  return changelog.sections.filter((section) => section.title !== 'Unreleased');
}

// The GitHub repositories (`owner/name`, lowercase) the link definitions at the foot point at. A
// copy of a repository keeps the links of the one it was copied from until somebody rewrites them.
export function linkedRepositories(changelog) {
  const repositories = new Set();
  for (const { url } of changelog.links.values()) {
    const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
    if (match) repositories.add(match[1].toLowerCase());
  }
  return repositories;
}

// Whether the foot links of the changelog name this repository, and only it.
export function namesRepository(changelog, repository) {
  const linked = linkedRepositories(changelog);
  return linked.size > 0 && [...linked].every((r) => r === repository.toLowerCase());
}

// The `owner/name` of a GitHub remote URL (https or ssh), or null.
export function repositoryFromRemote(url) {
  const match = url?.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  return match ? match[1] : null;
}

// The notes of one released version: the body of its section, trimmed of blank lines.
export function releaseNotes(changelog, version) {
  const section = changelog.sections.find((s) => s.title === version);
  if (!section) return null;
  return section.lines
    .map((l) => l.text)
    .join('\n')
    .trim();
}
