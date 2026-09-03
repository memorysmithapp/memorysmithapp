/**
 * The declared notation, checked against the extractors that implement it
 * (RN-AGT-017).
 *
 * `RECOGNISED_NOTATION` lives in the contracts package because two contexts
 * need it and may not import each other: this one READS the notation, and
 * Agent Access TEACHES it in a skill. This test is the half that keeps the
 * declaration honest. The other half, in the agent, keeps the skill built from
 * the declaration.
 *
 * Without it, a change to a regex here would silently turn the skill into a
 * lie, and the failure would surface as notes that quietly do nothing.
 */

import { describe, expect, it } from 'vitest';
import { RECOGNISED_NOTATION } from '@memorysmith/contracts';
import { extractLinks } from '../src/domain/LinkExtractor.js';
import { extractFacets } from '../src/domain/FacetExtractor.js';

const links = RECOGNISED_NOTATION.filter((entry) => entry.reader === 'links');
const frontmatter = RECOGNISED_NOTATION.filter((entry) => entry.reader === 'frontmatter');

describe('the notation the product declares is the notation it reads', () => {
  it.each(links.filter((entry) => entry.recognised))('reads $id as a link', ({ example }) => {
    expect(extractLinks(example).length).toBeGreaterThan(0);
  });

  it.each(links.filter((entry) => !entry.recognised))('deliberately ignores $id', ({ example }) => {
    expect(extractLinks(example)).toHaveLength(0);
  });

  it.each(frontmatter.filter((entry) => entry.recognised))(
    'reads $id as a facet',
    ({ example }) => {
      expect(Object.keys(extractFacets(example)).length).toBeGreaterThan(0);
    },
  );

  it.each(frontmatter.filter((entry) => !entry.recognised))(
    'deliberately discards $id',
    ({ example }) => {
      expect(extractFacets(example)).toEqual({});
    },
  );

  it('resolves the anchor form to the same target as the plain form', () => {
    const plain = extractLinks('See [[Lei 14.133]].');
    const anchored = extractLinks('See [[Lei 14.133#Article 75]].');

    expect(anchored[0]?.slug).toBe(plain[0]?.slug);
    expect(anchored[0]?.anchor).not.toBeNull();
  });

  it('covers both extractors, so neither can be declared and forgotten', () => {
    expect(links.length).toBeGreaterThan(0);
    expect(frontmatter.length).toBeGreaterThan(0);
  });
});

describe('an embed is a link, and the graph does not tell them apart (RN-DSC-029)', () => {
  it('produces the same edge as the plain form', () => {
    const embedded = extractLinks('![[Lei 14.133]]');
    const linked = extractLinks('[[Lei 14.133]]');

    expect(embedded).toHaveLength(1);
    expect(embedded[0]?.slug).toBe(linked[0]?.slug);
  });

  it('produces the same edge when the embed carries a section', () => {
    const embedded = extractLinks('![[Lei 14.133#Article 75]]');
    const linked = extractLinks('[[Lei 14.133]]');

    expect(embedded[0]?.slug).toBe(linked[0]?.slug);
    // The anchor is normalised like any target and kept for display; it never
    // takes part in resolution (RN-DSC-002).
    expect(embedded[0]?.anchor).toBe('article-75');
  });

  it('collapses an embed and a link to the same note into one edge', () => {
    // The extractor keys by target, so embedding a note and also linking to it
    // is one edge. That is what makes RN-DSC-029 true in the strong sense: the
    // graph cannot tell the two forms apart, not even by counting.
    expect(extractLinks('![[Lei 14.133]] and again [[Lei 14.133]]')).toHaveLength(1);
  });
});
