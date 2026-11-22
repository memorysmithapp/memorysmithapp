/**
 * The Style page's choices and the renderer's structure they are kept in
 * (#530, #521): what the page shows of a setting, and what it writes back,
 * keeping what an agent wrote that the page does not show.
 */

import { describe, expect, it } from 'vitest';
import {
  contentsForm,
  contentsOfForm,
  keysOf,
  propertiesForm,
  propertiesOfForm,
} from './style-settings';

describe('the properties on the Style page (#530)', () => {
  it('read where each medium draws them, the root and the default included', () => {
    expect(propertiesForm({})).toEqual({
      screen: 'start',
      print: 'start',
      keys: null,
      title: null,
      fold: 'open',
    });
    expect(
      propertiesForm({
        place: 'end',
        keys: ['status'],
        title: 'Registro',
        screen: { place: 'start' },
        print: 'none',
      }),
    ).toEqual({
      screen: 'start',
      print: 'none',
      keys: ['status'],
      title: 'Registro',
      fold: 'open',
    });
  });

  it('write only what differs from the default, and keep what the page does not show', () => {
    const form = propertiesForm({});
    expect(propertiesOfForm(form, {})).toEqual({});
    expect(
      propertiesOfForm({ ...form, print: 'end', keys: ['status'], fold: 'closed' }, {}),
    ).toEqual({
      keys: ['status'],
      fold: 'closed',
      print: { place: 'end' },
    });
    // An agent gave print keys of its own: moving print to the end keeps them.
    expect(propertiesOfForm({ ...form, print: 'end' }, { print: { keys: ['data'] } })).toEqual({
      print: { keys: ['data'], place: 'end' },
    });
    expect(propertiesOfForm({ ...form, screen: 'none' }, {})).toEqual({ screen: 'none' });
  });
});

describe('the contents on the Style page (#521)', () => {
  it('read none as no contents, and a contents with no list as its headings', () => {
    expect(contentsForm(null)).toMatchObject({ screen: 'none', print: 'none' });
    expect(contentsForm({ print: { place: 'start' }, screen: 'none' })).toEqual({
      screen: 'none',
      print: 'start',
      lists: { headings: true, figures: false, tables: false, attachments: false },
      depth: 3,
    });
  });

  it('write null when no medium draws one, and the lists ticked otherwise', () => {
    const none = contentsForm(null);
    expect(contentsOfForm(none, null)).toBeNull();
    expect(
      contentsOfForm(
        {
          ...none,
          print: 'start',
          lists: { headings: true, figures: false, tables: true, attachments: false },
          depth: 2,
        },
        null,
      ),
    ).toEqual({ headings: { depth: 2 }, tables: {}, screen: 'none' });
  });
});

describe('the keys typed on the Style page (#530)', () => {
  it('are the words between commas, and none typed draws them all', () => {
    expect(keysOf(' status, data ,,responsavel ')).toEqual(['status', 'data', 'responsavel']);
    expect(keysOf('  ,  ')).toBeNull();
  });
});
