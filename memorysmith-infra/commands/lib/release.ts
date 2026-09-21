/**
 * The version an environment serves, and what a release has to agree on before
 * production takes it (architecture-guide.md, sections 20 and 23).
 *
 * Pure functions over text the repository already holds: `CLAUDE.md`, the
 * manifests and `CHANGELOG.md`. The commands around them only read files and
 * ask git, so what decides is testable without either.
 */

const SEMVER = /^\d+\.\d+\.\d+$/;

export type ServingEnvironment = 'production' | 'staging';

/**
 * The version a deploy serves.
 *
 * Production serves the version of the packages, which is the released one.
 * Staging serves a SemVer prerelease with build metadata, so it sorts before the
 * release it rehearses and still names the exact commit:
 *
 * - on `release/vX.Y.Z`, `X.Y.Z-rc.N+sha7`, because the manifests are bumped
 *   only at the end of the cycle and the branch already knows its version;
 * - on any other branch, `<package version>-dev.N+sha7`.
 *
 * `N` is how many commits the branch is ahead of `main`, which a workstation
 * reproduces with `git rev-list --count origin/main..HEAD`.
 */
export function servedVersion(input: {
  readonly environment: ServingEnvironment;
  readonly packageVersion: string;
  readonly branch: string;
  readonly commitsAhead: number;
  readonly sha: string;
}): string {
  if (!SEMVER.test(input.packageVersion)) {
    throw new Error(`The package version "${input.packageVersion}" is not X.Y.Z.`);
  }
  if (input.environment === 'production') return input.packageVersion;

  const sha = input.sha.slice(0, 7);
  if (!/^[0-9a-f]{7}$/.test(sha)) throw new Error(`"${input.sha}" is not a commit.`);
  const release = /^release\/v(\d+\.\d+\.\d+)$/.exec(input.branch);
  return release
    ? `${release[1]}-rc.${input.commitsAhead}+${sha}`
    : `${input.packageVersion}-dev.${input.commitsAhead}+${sha}`;
}

/** The canonical version, from `CLAUDE.md` § Project identity → Base version. */
export function baseVersionOf(claudeMd: string): string | null {
  const found = /^### Base version\s*\n\s*(\S+)/m.exec(claudeMd);
  return found?.[1] ?? null;
}

/** The notes of one version, as `CHANGELOG.md` writes them, or null when there is no section. */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) return null;
  const next = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
  const body = lines.slice(start + 1, next < 0 ? undefined : next);
  // The compare links at the foot of the file belong to no section.
  const notes = body
    .filter((line) => !/^\[[^\]]+\]: https?:\/\//.test(line))
    .join('\n')
    .trim();
  return notes.length > 0 ? notes : null;
}

/**
 * Why a merge cannot become a release, as sentences naming each reason, or an
 * empty list when it can.
 *
 * The one that stops most is the last: a tag that already exists means the
 * version was released, so a merge that changed code without bumping it would
 * deploy different bytes under a number that already names others.
 */
export function releaseProblems(input: {
  readonly claudeMd: string;
  readonly manifests: ReadonlyArray<{
    readonly path: string;
    readonly version: string | undefined;
  }>;
  readonly changelog: string;
  readonly tagExists: boolean;
}): string[] {
  const problems: string[] = [];
  const base = baseVersionOf(input.claudeMd);
  if (!base || !SEMVER.test(base)) {
    return ['CLAUDE.md declares no Base version of the form X.Y.Z.'];
  }

  for (const manifest of input.manifests) {
    // A manifest that declares no version claims none: the specification in
    // docs/markdown-spec follows the version of the product and has no field.
    if (manifest.version !== undefined && manifest.version !== base) {
      problems.push(`${manifest.path} is at ${manifest.version}, and CLAUDE.md declares ${base}.`);
    }
  }
  if (
    !new RegExp(`^## \\[${base.replace(/\./g, '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(
      input.changelog,
    )
  ) {
    problems.push(`CHANGELOG.md has no dated section for ${base}.`);
  }
  if (!changelogSection(input.changelog, base)) {
    problems.push(`The section of ${base} in CHANGELOG.md is empty.`);
  }
  if (input.tagExists) {
    problems.push(
      `v${base} is already released. A change to what is deployed needs a new version: bump it on the release branch.`,
    );
  }
  return problems;
}
