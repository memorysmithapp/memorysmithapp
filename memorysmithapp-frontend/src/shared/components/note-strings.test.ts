/**
 * The words the reading surface prints with a `table` block and its appendices
 * (#491, #494), in the reader's language.
 */

import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import pt from '../../i18n/locales/pt_BR.json' with { type: 'json' };

describe('the words of a printed table', () => {
  it('say when its rows were read, whether the renderer formatted the moment or not', async () => {
    const { noteStrings } = await import('./NoteContent');
    const t = (await i18next.createInstance().init({
      lng: 'pt_BR',
      resources: { pt_BR: { translation: pt } },
      interpolation: { escapeValue: false },
    })) as unknown as Parameters<typeof noteStrings>[0];
    const strings = noteStrings(t, 'pt-BR');

    // 0.12.0 hands the moment already in the reader's words (#491).
    const formatted = strings.tablePrinted({
      table: 'gastos',
      filter: null,
      count: 30,
      readAt: '18/11/2026, 10:00',
    });
    expect(formatted).toContain('18/11/2026, 10:00');
    // And an instant, as it did before, is still said short.
    expect(
      strings.tablePrinted({
        table: 'gastos',
        filter: null,
        count: 1,
        readAt: '2026-11-18T13:00:00.000Z',
      }),
    ).toMatch(/18\/11\/2026/);
  });

  it('name an appendix by its table, and a Markdown table by its place among the note’s (#494)', async () => {
    const { noteStrings } = await import('./NoteContent');
    const t = (await i18next.createInstance().init({
      lng: 'pt_BR',
      resources: { pt_BR: { translation: pt } },
      interpolation: { escapeValue: false },
    })) as unknown as Parameters<typeof noteStrings>[0];
    const strings = noteStrings(t, 'pt-BR');
    expect(strings.tableAppendix({ number: 1, table: 'gastos', markdownTable: null })).toBe(
      'Anexo 1 — gastos',
    );
    expect(strings.tableAppendix({ number: 2, table: null, markdownTable: 1 })).toBe(
      'Anexo 2 — Tabela 1',
    );
    expect(
      strings.tableAppendixReference({ number: 1, table: 'gastos', markdownTable: null }),
    ).toBe('Ver Anexo 1 — Tabela “gastos”');
  });
});
