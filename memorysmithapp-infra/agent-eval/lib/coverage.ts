/**
 * Every skill the connector announces has a case (architecture-guide.md,
 * section 19). The index is read live, from what `whoami` serves, so a skill
 * added to the product without a case stops the next round before it starts.
 */

/** The skill names of the index `whoami` prints, in the order it prints them. */
export function skillsAnnounced(whoami: string): string[] {
  const start = whoami.indexOf('## Skills');
  if (start < 0) return [];
  const section = whoami.slice(start).split('\n## ')[0] ?? '';
  return [...section.matchAll(/^- `([a-z0-9-]+)`/gm)].map((match) => match[1] ?? '');
}

export function uncoveredSkills(
  announced: readonly string[],
  cases: readonly { readonly skills: readonly string[] }[],
): string[] {
  const covered = new Set(cases.flatMap((each) => each.skills));
  return announced.filter((skill) => !covered.has(skill));
}
