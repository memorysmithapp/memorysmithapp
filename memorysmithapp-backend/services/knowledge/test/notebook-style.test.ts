import { describe, expect, it } from 'vitest';
import { SubscriptionId } from '@memorysmithapp/kernel';
import { DEFAULT_NOTEBOOK_STYLE } from '@memorysmithapp/contracts';
import { notebookMetaItem, parseNotebook } from '../src/adapters/outbound/dynamodb/items.js';
import { NotebookStyle } from '../src/domain/values.js';
import { authorship, newNotebook, unwrap } from './fixtures.js';

/**
 * A notebook's style (#493, RN-KNW-092): data of the notebook, kept on its
 * META item, the default for every notebook written before it.
 */
describe("a notebook's style", () => {
  it('is the published default, which is how notes were drawn before', () => {
    expect(NotebookStyle.DEFAULT).toEqual(DEFAULT_NOTEBOOK_STYLE);
    expect(newNotebook().style).toEqual(DEFAULT_NOTEBOOK_STYLE);
  });

  it('records a change once, and nothing for a style it already has', () => {
    const notebook = newNotebook();
    notebook.pullEvents();
    const serif = { ...NotebookStyle.DEFAULT, font: 'serif' as const };
    unwrap(notebook.restyle(serif, authorship()));
    unwrap(notebook.restyle({ ...serif }, authorship()));
    const styled = notebook.pullEvents().filter((event) => event.type === 'NotebookStyled');
    expect(styled).toHaveLength(1);
    expect(styled[0]?.payload).toMatchObject({ style: serif });
    expect(notebook.style.font).toBe('serif');
  });

  it('is written on the META item and read back, and an item without one reads the default', () => {
    const notebook = newNotebook();
    unwrap(
      notebook.restyle(
        { ...NotebookStyle.DEFAULT, text: 'justify', printTables: 'appendices' },
        authorship(),
      ),
    );
    const subscription = SubscriptionId.generate();
    const item = notebookMetaItem(notebook, 'PK');
    const read = parseNotebook([item], subscription);
    expect(read?.style).toEqual(notebook.style);

    const { style: _dropped, ...older } = item;
    expect(parseNotebook([older], subscription)?.style).toEqual(DEFAULT_NOTEBOOK_STYLE);
  });
});
