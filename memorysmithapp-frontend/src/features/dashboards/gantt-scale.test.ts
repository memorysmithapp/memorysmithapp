import { describe, expect, it } from 'vitest';
import { ganttScale } from './gantt-scale';

const at = (date: string) => Date.parse(`${date}T00:00:00Z`);
// November 2026 to April 2027: six months, the span of #383.
const SPAN = { from: at('2026-11-01'), to: at('2027-04-30') };

describe('the scale of a Gantt (#383)', () => {
  it('labels every month where the width holds them, with the year where it changes', () => {
    const scale = ganttScale({ ...SPAN, locale: 'pt-BR', widthPx: 900 });
    expect(scale.map((month) => month.label)).toEqual([
      'nov. 26',
      'dez.',
      'jan. 27',
      'fev.',
      'mar.',
      'abr.',
    ]);
    expect(scale[0]?.left).toBe(0);
  });

  it('keeps a tick for every month and a label on as many as a narrow column holds', () => {
    const scale = ganttScale({ ...SPAN, locale: 'pt-BR', widthPx: 160 });
    expect(scale).toHaveLength(6);
    const labelled = scale.filter((month) => month.label !== null);
    expect(labelled.length).toBeLessThan(6);
    expect(labelled.length).toBeGreaterThan(0);
    // A year that changes on a month left unlabelled is said on the next one shown.
    expect(labelled.map((month) => month.label)).toContain('nov. 26');
    expect(labelled.some((month) => month.label?.endsWith('27'))).toBe(true);
  });

  it('labels every month while the width is not measured yet', () => {
    const scale = ganttScale({ ...SPAN, locale: 'en-US', widthPx: 0 });
    expect(scale.map((month) => month.label)).toEqual([
      'Nov 26',
      'Dec',
      'Jan 27',
      'Feb',
      'Mar',
      'Apr',
    ]);
  });

  it('draws nothing for a span of no length', () => {
    expect(ganttScale({ from: 5, to: 5, locale: 'pt-BR', widthPx: 300 })).toEqual([]);
  });
});
