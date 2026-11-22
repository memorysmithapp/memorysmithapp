import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTEBOOK_STYLE,
  notebookStyleOf,
  notebookStyleSchema,
  propertiesOf,
  sameNotebookStyle,
} from '../src/notebook-style.js';
import { notebookStyledPayload } from '../src/events.js';

/**
 * How a notebook's notes draw their properties (#530, RN-KNW-096): an object
 * since then, and the word a document, an event or a client of before wrote
 * read as the place it became.
 */
describe("a notebook's properties setting", () => {
  it('prints the properties below the title by default, every key and no heading', () => {
    expect(DEFAULT_NOTEBOOK_STYLE.properties).toEqual({
      print: { place: 'start', keys: null, title: null },
    });
  });

  it('reads cover, end and none of before #530 as the place each became', () => {
    expect(propertiesOf('cover')).toEqual({ print: { place: 'start', keys: null, title: null } });
    expect(propertiesOf('end')).toEqual({ print: { place: 'end', keys: null, title: null } });
    expect(propertiesOf('none')).toEqual({ print: 'none' });
    // A 1.7 document's style, and a NotebookStyled event recorded before, read whole.
    const older = { ...DEFAULT_NOTEBOOK_STYLE, properties: 'end' };
    expect(notebookStyleSchema.parse(older).properties).toEqual({
      print: { place: 'end', keys: null, title: null },
    });
    expect(
      notebookStyledPayload.parse({ notebookId: '01JBQ2X00000000000000000V1', style: older }).style
        .properties,
    ).toEqual({ print: { place: 'end', keys: null, title: null } });
  });

  it('reads what it cannot take as the default, as a stored item written before it', () => {
    expect(notebookStyleOf({ properties: 'middle' }).properties).toEqual(
      DEFAULT_NOTEBOOK_STYLE.properties,
    );
    expect(
      notebookStyleOf({ properties: { print: { place: 'end', keys: [] } } }).properties,
    ).toEqual(DEFAULT_NOTEBOOK_STYLE.properties);
  });

  it('tells two settings apart by what they say, not by their object', () => {
    const end = { ...DEFAULT_NOTEBOOK_STYLE, properties: propertiesOf('end') };
    expect(sameNotebookStyle(end, { ...end, properties: propertiesOf('end') })).toBe(true);
    expect(sameNotebookStyle(end, DEFAULT_NOTEBOOK_STYLE)).toBe(false);
  });
});
