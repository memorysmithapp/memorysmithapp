/**
 * The colours of the notebook graph (#502). The note blue is the notes',
 * always, and the orange is the agents' activity's: neither is in the list.
 * One fixed list of colours is shared by the kinds of node a notebook keeps
 * besides its notes — folders, files, tables, dashboards, one colour each —
 * and by the attributes switched on in the gear, one colour each. Once the
 * list runs out, everything else wears ink.
 *
 * The order the list is used in is drawn at random once per notebook, seeded
 * by its identifier: the same notebook shows the same colours in every
 * browser and on every visit, and nothing is stored.
 */

/** How many colours the list holds: `--graph-1` to `--graph-6` in `styles.css`. */
export const GRAPH_COLORS = 6;

/** The position each kind of node takes in the notebook's order; the attributes take the next ones. */
export const KIND_SLOT = { folder: 0, file: 1, table: 2, dashboard: 3 } as const;
export const FIRST_ATTRIBUTE_SLOT = 4;

/** FNV-1a over the identifier, the seed of the notebook's order. */
function seedOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small generator that answers the same numbers for the same seed. */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The order of the list in this notebook: a shuffle of `0..GRAPH_COLORS-1`, the same every time. */
export function colorOrder(notebookId: string): number[] {
  const random = generator(seedOf(notebookId.toUpperCase()));
  const order = Array.from({ length: GRAPH_COLORS }, (_, index) => index);
  for (let at = order.length - 1; at > 0; at -= 1) {
    const other = Math.floor(random() * (at + 1));
    [order[at], order[other]] = [order[other]!, order[at]!];
  }
  return order;
}

/** The custom property a slot wears in this order: a colour of the list, or ink once it ran out. */
export function slotToken(slot: number, order: readonly number[]): string {
  const color = slot >= 0 ? order[slot] : undefined;
  return color === undefined ? '--graph-none' : `--graph-${color + 1}`;
}

/** The lowest slot an attribute may take that no switched-on attribute holds. */
export function freeAttributeSlot(taken: Iterable<number>): number {
  const used = new Set(taken);
  let slot = FIRST_ATTRIBUTE_SLOT;
  while (used.has(slot)) slot += 1;
  return slot;
}
