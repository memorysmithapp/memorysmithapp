/**
 * Whether a pending link looks broken rather than left on purpose (#217).
 *
 * A link to a name no note carries yet is pending, and a notebook being built
 * carries them on purpose: they are the list of what is still to write
 * (RN-DSC-004). What is not on purpose is a link that almost reaches something
 * the notebook has — the same name in another case or without its accents, or
 * the start of a longer name, as `[[M42]]` beside a note named *M42 Orion
 * Nebula*. This answers which name it most likely meant, or nothing.
 *
 * One rule, read by the connector that shows it to an agent and by the blind
 * evaluation that checks what an agent left, so the two never disagree about
 * what "broken" is.
 */

/** Something a link can reach: a note by its name or an alias, or a kept file. */
export interface LinkCandidate {
  readonly name: string;
  readonly kind: 'note' | 'file';
  /** The note it belongs to, for a note; absent for a file. */
  readonly noteId?: string;
}

/**
 * A name reduced to what a person means by it: no case, no accents, and no
 * spacing or punctuation, so `M-42`, `m42` and `M 42` are the same name.
 */
export function comparableName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * The one candidate a pending target most likely meant, or null.
 *
 * It is the candidate whose comparable name equals the target's; failing that,
 * the ONE candidate whose name begins with the target, or that the target
 * begins with — two or more is an ambiguity, and a guess there would send the
 * agent to rewrite a link that may well be right.
 */
export function likelyMeant(
  target: string,
  candidates: readonly LinkCandidate[],
): LinkCandidate | null {
  const wanted = comparableName(target);
  if (wanted.length < 2) return null;
  const named = candidates.filter((candidate) => comparableName(candidate.name).length > 0);

  const same = unique(named.filter((candidate) => comparableName(candidate.name) === wanted));
  if (same.length === 1) return same[0] ?? null;
  if (same.length > 1) return null;

  // Word by word, so `[[M42]]` meets *M42 Orion Nebula* and never *M4*.
  const asked = words(target);
  const around = unique(
    named.filter((candidate) => {
      const name = words(candidate.name);
      return startsWith(name, asked) || startsWith(asked, name);
    }),
  );
  return around.length === 1 ? (around[0] ?? null) : null;
}

function words(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/** Whether `whole` begins with every word of `start`, and has more of them. */
function startsWith(whole: readonly string[], start: readonly string[]): boolean {
  return (
    start.length > 0 &&
    whole.length > start.length &&
    start.every((word, index) => whole[index] === word)
  );
}

/** A note met by its name and by an alias is one candidate, not two. */
function unique(candidates: readonly LinkCandidate[]): LinkCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.noteId ?? `file:${candidate.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
