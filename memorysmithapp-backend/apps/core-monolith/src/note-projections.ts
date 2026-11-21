/**
 * What the system table of a notebook reads of Discovery (#517, ADR-031): the
 * portrait of each note and how many links reach it and leave it. It lives
 * HERE, in the composition root, as the note catalogue does in the other
 * direction: Knowledge owns the notes and Discovery the projections of them,
 * and neither context imports the other.
 *
 * Discovery calls a value written as plain text an `enum`, because it counts
 * values as categories; the system table calls it text, and types it as a
 * number only when every note wrote a number.
 */

import type { NotebookId } from '@memorysmithapp/kernel';
import type { FacetIndex, LinkGraph } from '@memorysmithapp/svc-discovery/domain';
import type { NoteFacet, NoteProjections } from '@memorysmithapp/svc-knowledge/domain';

export class DiscoveryNoteProjections implements NoteProjections {
  constructor(
    private readonly discovery: {
      readonly graph: Pick<LinkGraph, 'degrees'>;
      readonly facets: Pick<FacetIndex, 'notebookPortraits'>;
    },
  ) {}

  async read(notebook: NotebookId) {
    const [portraits, degrees] = await Promise.all([
      this.discovery.facets.notebookPortraits(notebook.value),
      this.discovery.graph.degrees(notebook.value),
    ]);
    const facets = new Map<string, Record<string, NoteFacet>>();
    for (const [noteId, snapshot] of portraits) {
      const portrait: Record<string, NoteFacet> = {};
      for (const [attribute, facet] of Object.entries(snapshot)) {
        portrait[attribute] = {
          kind: facet.kind === 'enum' ? 'text' : facet.kind,
          values: facet.values,
        };
      }
      facets.set(noteId, portrait);
    }
    return { facets, degrees };
  }
}
