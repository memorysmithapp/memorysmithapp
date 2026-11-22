import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTEBOOK_STYLE,
  contentsOf,
  notebookStyleOf,
  notebookStyleSchema,
  propertiesOf,
  sameNotebookStyle,
} from '../src/notebook-style.js';
import { notebookStyledPayload } from '../src/events.js';

/**
 * How a notebook's notes draw their properties (#530, RN-KNW-096) and their
 * contents (#521, RN-KNW-097), in the renderer's own structure, and how their
 * headings are numbered (#535, RN-KNW-098).
 */
describe("a notebook's properties setting", () => {
  it('draws every key at the top by default, numbers nothing, and draws no contents', () => {
    expect(DEFAULT_NOTEBOOK_STYLE.properties).toEqual({});
    expect(DEFAULT_NOTEBOOK_STYLE.contents).toBeNull();
    expect(DEFAULT_NOTEBOOK_STYLE.numbering).toBe('none');
  });

  it('reads cover, end and none of before #530 as what each became', () => {
    expect(propertiesOf('cover')).toEqual({});
    expect(propertiesOf('end')).toEqual({ print: { place: 'end' } });
    expect(propertiesOf('none')).toEqual({ print: 'none' });
    // A 1.7 document's style, and a NotebookStyled event recorded before, read whole.
    const older = { ...DEFAULT_NOTEBOOK_STYLE, properties: 'end' };
    delete (older as Record<string, unknown>)['contents'];
    delete (older as Record<string, unknown>)['numbering'];
    expect(notebookStyleOf(older).properties).toEqual({ print: { place: 'end' } });
    expect(
      notebookStyledPayload.parse({
        notebookId: '01JBQ2X00000000000000000V1',
        style: { ...DEFAULT_NOTEBOOK_STYLE, properties: 'end' },
      }).style.properties,
    ).toEqual({ print: { place: 'end' } });
  });

  it('takes the structure of a properties block, a null left out', () => {
    const settings = {
      keys: ['status', 'data'],
      title: 'Registro',
      fold: 'closed',
      screen: 'none',
      print: { place: 'end', title: null },
    };
    expect(propertiesOf(settings)).toEqual({
      keys: ['status', 'data'],
      title: 'Registro',
      fold: 'closed',
      screen: 'none',
      print: { place: 'end' },
    });
    for (const wrong of [
      { place: 'middle' },
      { keys: [] },
      { colour: 'blue' },
      { print: 'never' },
    ]) {
      expect(notebookStyleSchema.shape.properties.safeParse(wrong).success).toBe(false);
    }
  });

  it('reads what it cannot take as the default, as a stored item written before it', () => {
    expect(notebookStyleOf({ properties: 'middle' }).properties).toEqual({});
    expect(notebookStyleOf({ numbering: 'roman' }).numbering).toBe('none');
    expect(notebookStyleOf({ contents: { depth: 9 } }).contents).toBeNull();
  });

  it('tells two settings apart by what they say, not by their object', () => {
    const end = { ...DEFAULT_NOTEBOOK_STYLE, properties: propertiesOf('end') };
    expect(sameNotebookStyle(end, { ...end, properties: propertiesOf('end') })).toBe(true);
    expect(sameNotebookStyle(end, DEFAULT_NOTEBOOK_STYLE)).toBe(false);
  });
});

describe("a notebook's contents setting (#521)", () => {
  it('takes the structure of a contents block, and only headings take a depth', () => {
    expect(
      contentsOf({ headings: { depth: 2 }, tables: {}, print: { place: 'start' }, screen: 'none' }),
    ).toEqual({ headings: { depth: 2 }, tables: {}, print: { place: 'start' }, screen: 'none' });
    expect(contentsOf({ tables: { depth: 2 } })).toBeNull();
    expect(contentsOf({ headings: { depth: 7 } })).toBeNull();
    expect(contentsOf(null)).toBeNull();
  });
});
