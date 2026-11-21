/**
 * How many links reach each note and how many it makes (#517), counted from
 * the edges between notes: a link to a file or to a table is a reference and
 * never an edge (RN-DSC-044, RN-KNW-085), so it counts in neither.
 */
export function countDegrees(
  edges: Iterable<{ readonly fromNoteId: string; readonly toNoteId: string }>,
): Map<string, { backlinks: number; links: number }> {
  const degrees = new Map<string, { backlinks: number; links: number }>();
  const of = (noteId: string) => {
    let found = degrees.get(noteId);
    if (!found) {
      found = { backlinks: 0, links: 0 };
      degrees.set(noteId, found);
    }
    return found;
  };
  for (const edge of edges) {
    of(edge.fromNoteId).links += 1;
    of(edge.toNoteId).backlinks += 1;
  }
  return degrees;
}
