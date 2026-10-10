/**
 * The sidebar of a notebook grows with the window on a computer (#274), and
 * never at the cost of the reading column: at every desktop width the content
 * beside it still holds the 48.75rem of `.content-pane`.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../styles.css', import.meta.url), 'utf8');

function ruleOf(selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf('}', at));
}

const clamp = /width:\s*clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\)/.exec(
  ruleOf('.notebook-sidebar'),
);
const reading = Number(/max-width:\s*([\d.]+)rem/.exec(ruleOf('.content-pane'))?.[1]) * 16;

function sidebarAt(viewport: number): number {
  const [, min, vw, max] = clamp!.map(Number);
  return Math.min(max!, Math.max(min!, (vw! / 100) * viewport));
}

describe('the sidebar of a notebook', () => {
  it('grows with the window between a floor and a ceiling', () => {
    expect(clamp).not.toBeNull();
    expect(sidebarAt(1024)).toBe(272);
    expect(sidebarAt(1440)).toBeGreaterThan(272);
    expect(sidebarAt(2560)).toBe(Number(clamp![3]));
  });

  it('leaves the reading column its whole width at 1280, 1440 and 1920 px', () => {
    expect(reading).toBe(780);
    for (const viewport of [1280, 1440, 1920]) {
      // One pixel for its border on the right.
      expect(viewport - sidebarAt(viewport) - 1).toBeGreaterThanOrEqual(reading);
    }
  });

  it('takes from the reading column no more than it took before it grew', () => {
    for (let viewport = 1100; viewport <= 2560; viewport += 20) {
      const content = viewport - sidebarAt(viewport) - 1;
      expect(content >= reading || sidebarAt(viewport) === 272).toBe(true);
    }
  });
});
