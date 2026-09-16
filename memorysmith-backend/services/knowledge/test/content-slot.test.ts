/**
 * The Guidance of a notebook and the Template of a folder, each an Aggregate
 * Root of its own (RN-KNW-044, RN-KNW-045).
 *
 * What these cases hold is the three things the old shape could not do: each
 * one is deleted on its own, each one declares the bytes it frees, and neither
 * is a mutation of the tree, so the notebook aggregate records nothing when
 * one of them is written.
 */

import { describe, expect, it } from 'vitest';
import {
  authorship,
  contentRef,
  expectErr,
  newGuidance,
  newNotebook,
  newTemplate,
  unwrap,
} from './fixtures.js';
import { FolderId } from '@memorysmith/kernel';

describe('Guidance: a pointer, never Markdown', () => {
  it('records the event carrying the complete reference', () => {
    const notebook = newNotebook();
    const ref = contentRef();
    const guidance = newGuidance(notebook, ref);

    const [event] = guidance.pullEvents();
    expect(event?.type).toBe('GuidanceUpdated');
    expect(event?.subject).toBe('NOTEBOOK');
    expect(event?.subjectId).toBe(notebook.id.value);
    // The complete ref travels inside the event (architecture-guide.md 6.6).
    expect(event?.contentRef?.sha256).toBe(ref.sha256);
    expect(event?.contentRef?.versionId).toBe(ref.versionId);
    expect(event?.contentRef?.bytes).toBe(ref.bytes);
  });

  it('does not record a revision when the content is byte-for-byte identical', () => {
    // RN-KNW-028: same bytes means no revision, no event, no re-indexing.
    const notebook = newNotebook();
    const guidance = newGuidance(notebook, contentRef('b'.repeat(64)));
    guidance.pullEvents();

    expect(unwrap(guidance.replace(contentRef('b'.repeat(64)), authorship()))).toBe(false);
    expect(guidance.pullEvents()).toHaveLength(0);
  });

  it('is deleted on its own, and the notebook is not touched', () => {
    const notebook = newNotebook();
    notebook.pullEvents();
    const guidance = newGuidance(notebook);
    guidance.pullEvents();

    unwrap(guidance.delete(authorship()));

    expect(guidance.isDeleted).toBe(true);
    const [event] = guidance.pullEvents();
    expect(event?.type).toBe('GuidanceDeleted');
    // The reference that was live travels with it: the trail is the recovery
    // index, and nothing else names the content afterwards.
    expect(event?.contentRef?.versionId).toBe(guidance.revision);
    // Nothing happened to the tree, which is the whole point of RN-KNW-044.
    expect(notebook.hasChanges).toBe(false);
  });

  it('refuses a second deletion, and any write after one', () => {
    const notebook = newNotebook();
    const guidance = newGuidance(notebook);
    unwrap(guidance.delete(authorship()));

    expect(expectErr(guidance.delete(authorship())).code).toBe('NOT_FOUND');
    expect(expectErr(guidance.replace(contentRef('e'.repeat(64)), authorship())).code).toBe(
      'NOT_FOUND',
    );
  });
});

describe('Template: the same slot, filed under its folder', () => {
  it('records the event under the folder it belongs to', () => {
    const notebook = newNotebook();
    const folderId = FolderId.generate();
    const template = newTemplate(notebook, folderId);

    const [event] = template.pullEvents();
    expect(event?.type).toBe('TemplateUpdated');
    expect(event?.subject).toBe('FOLDER');
    expect(event?.subjectId).toBe(folderId.value);
    expect(event?.payload['folderId']).toBe(folderId.value);
  });

  it('is deleted on its own, freeing what it held', () => {
    const notebook = newNotebook();
    const template = newTemplate(notebook, FolderId.generate(), contentRef('a'.repeat(64), 640));
    template.pullEvents();

    unwrap(template.delete(authorship()));

    const [event] = template.pullEvents();
    expect(event?.type).toBe('TemplateDeleted');
    expect(event?.storageDelta).toBe(-640);
  });
});
