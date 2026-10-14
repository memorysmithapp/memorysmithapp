/**
 * How big a node of the graph is drawn (#275).
 *
 * The radius used to be a function of the degree alone, the same constants
 * for a notebook of twenty notes and one of two thousand, saturating at about
 * seventy links: in a well-linked notebook almost every node sat near the
 * ceiling and the size stopped telling one note from another. It is relative
 * now, to the nodes drawn: the degree is placed between the smallest and the
 * largest degree among them, through a square root so that one huge hub does
 * not flatten everybody else to the floor, and mapped onto a range of radii.
 * The most linked node is the largest, the least linked the smallest, and the
 * rest spread between them whatever the size of the notebook.
 *
 * Notes and values keep separate ranges, measured each among its own kind: a
 * value node gathers notes and is what a person aims at to hold its group, so
 * it starts larger. Each floor is above the radius the absolute scale gave a
 * node with no link — 2.2 for a note, 3.5 for a value — so the area that
 * answers the pointer, `max(radius + 4/k, 6/k)`, does not shrink for it.
 */

export interface RadiusRange {
  readonly min: number;
  readonly max: number;
}

export type NodeKind = 'note' | 'value';

export const RADIUS: Readonly<Record<NodeKind, RadiusRange>> = {
  note: { min: 3, max: 13 },
  value: { min: 5, max: 16 },
};

/**
 * Where a set of nodes all have one degree, nothing tells them apart, and they
 * are drawn at one size: the floor when none has a link, which is what an
 * unlinked note is everywhere else, and this share of the range when they all
 * have the same number of them.
 */
const EVEN_SHARE = 0.35;

/**
 * The scale of one kind over the degrees of the nodes drawn: a function from
 * a degree to a radius within `range`. The smallest degree among `degrees`
 * gets `range.min`, the largest `range.max`, and a larger degree never gets a
 * smaller radius. A degree outside the ones it was built over is held to the
 * range.
 */
export function radiusScale(
  degrees: readonly number[],
  range: RadiusRange,
): (degree: number) => number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const degree of degrees) {
    const at = Math.max(0, degree);
    if (at < lo) lo = at;
    if (at > hi) hi = at;
  }
  const span = range.max - range.min;
  if (!(hi > lo)) {
    const even = hi > 0 ? range.min + span * EVEN_SHARE : range.min;
    return () => even;
  }
  const from = Math.sqrt(lo);
  const to = Math.sqrt(hi);
  return (degree) => {
    const share = (Math.sqrt(Math.max(0, degree)) - from) / (to - from);
    return range.min + span * Math.min(1, Math.max(0, share));
  };
}

/**
 * The radius of every node, in the order given, each kind scaled over the
 * nodes of that kind among them. Holding a group calls it over the nodes the
 * group shows, so a minor value does not draw its notes at the floor.
 */
export function radiiOf(
  nodes: ReadonlyArray<{ readonly kind: NodeKind; readonly degree: number }>,
): number[] {
  const scales = {
    note: radiusScale(
      nodes.filter((node) => node.kind === 'note').map((node) => node.degree),
      RADIUS.note,
    ),
    value: radiusScale(
      nodes.filter((node) => node.kind === 'value').map((node) => node.degree),
      RADIUS.value,
    ),
  };
  return nodes.map((node) => scales[node.kind](node.degree));
}

/** The room kept between the edges of two nodes, so that no dot covers another. */
export const COLLISION_GAP = 2;

/**
 * How long a link is drawn: a length between the edges of its two nodes, plus
 * both radii, so that two large nodes are not drawn on top of each other by a
 * link sized for two small ones.
 */
export function linkLength(
  gap: number,
  source: { readonly radius: number },
  target: { readonly radius: number },
): number {
  return gap + source.radius + target.radius;
}
