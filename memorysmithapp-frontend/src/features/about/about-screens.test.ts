/**
 * The screens the About page names (#401): every one of them said in both
 * languages, and none of the ones the interface serves left out.
 */

import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en_US.json';
import pt from '../../i18n/locales/pt_BR.json';
import { INTERFACE } from './about-screens';

describe('what the About page says you will find', () => {
  it('names the screens the interface serves today', () => {
    expect(INTERFACE).toEqual(
      expect.arrayContaining(['files', 'tables', 'dashboards', 'model', 'sharing', 'community']),
    );
  });

  it('says each one in both languages', () => {
    for (const locale of [en, pt]) {
      const said = locale.about.interface as Record<string, { term?: string; definition?: string }>;
      for (const key of INTERFACE) {
        expect(said[key]?.term, key).toBeTruthy();
        expect(said[key]?.definition, key).toBeTruthy();
      }
    }
  });

  it('says that an archive carries the tables, the dashboards and the model', () => {
    expect(en.about.interface.transfers.definition).toContain('dashboards');
    expect(pt.about.interface.transfers.definition).toContain('Modelo de caderno');
  });
});
