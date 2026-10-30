/**
 * A WBS tree (#369): the hierarchy a table states in an outline code, `1`,
 * `1.2`, `1.2.3`, with the progress of its rows rolled up from child to parent.
 *
 * A row whose parent is not among the rows, because a filter left it out or
 * the table never had it, hangs from the nearest code it does have, so nothing
 * drawn disappears. A parent's progress is the mean of its children, weighted
 * when the table says how much each one weighs; what it says of itself counts
 * only when it has no children.
 */

export interface WbsNode {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly progress: number | null;
  readonly depth: number;
  readonly children: readonly WbsNode[];
}

interface Row {
  readonly rowId: string;
  readonly values: Record<string, unknown>;
}

const parts = (code: string): number[] => code.split('.').map(Number);

function compareCodes(a: string, b: string): number {
  const [left, right] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? -1) - (right[index] ?? -1);
    if (difference !== 0) return difference;
  }
  return a.localeCompare(b);
}

interface Draft {
  readonly row: Row;
  readonly code: string;
  readonly children: Draft[];
}

function rollUp(
  draft: Draft,
  depth: number,
  columns: { title: string; progress: string | null; weight: string | null },
): WbsNode & { weight: number } {
  const children = draft.children.map((child) => rollUp(child, depth + 1, columns));
  const own = columns.progress ? draft.row.values[columns.progress] : undefined;
  const measured = children.filter((child) => child.progress !== null);
  const total = measured.reduce((sum, child) => sum + child.weight, 0);
  const weight = columns.weight ? Number(draft.row.values[columns.weight] ?? 1) : 1;
  return {
    id: draft.row.rowId,
    code: draft.code,
    title: String(draft.row.values[columns.title] ?? ''),
    progress:
      children.length > 0
        ? total > 0
          ? measured.reduce((sum, child) => sum + (child.progress ?? 0) * child.weight, 0) / total
          : null
        : typeof own === 'number'
          ? own
          : null,
    depth,
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    children,
  };
}

/** The roots of the tree, ordered by their codes. */
export function wbsTree(rows: readonly Row[], options: Record<string, unknown>): WbsNode[] {
  const code = String(options['code']);
  const drafts = rows
    .map((row) => ({ row, code: String(row.values[code] ?? '').trim(), children: [] as Draft[] }))
    .filter((draft) => draft.code.length > 0)
    .sort((a, b) => compareCodes(a.code, b.code));
  const known = new Map(drafts.map((draft) => [draft.code, draft]));
  const roots: Draft[] = [];
  for (const draft of drafts) {
    const levels = draft.code.split('.');
    let parent: Draft | undefined;
    for (let length = levels.length - 1; length > 0 && !parent; length -= 1) {
      parent = known.get(levels.slice(0, length).join('.'));
    }
    (parent?.children ?? roots).push(draft);
  }
  const columns = {
    title: String(options['title']),
    progress: typeof options['progress'] === 'string' ? options['progress'] : null,
    weight: typeof options['weight'] === 'string' ? options['weight'] : null,
  };
  return roots.map((root) => rollUp(root, 0, columns));
}

/** The tree, in the order it is read. */
export function wbsLines(roots: readonly WbsNode[]): WbsNode[] {
  return roots.flatMap((root) => [root, ...wbsLines(root.children)]);
}
