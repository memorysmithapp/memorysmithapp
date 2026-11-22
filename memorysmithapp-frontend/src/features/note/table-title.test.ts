/**
 * What the paginator keeps with a table on its page (#537): the title right
 * above it, a heading or a line of bold words, never a paragraph of text.
 */

import { describe, expect, it } from 'vitest';
import { isTableTitle } from './paginate';

const element = (tagName: string, textContent: string, children: Array<[string, string]> = []) => ({
  tagName,
  textContent,
  children: children.map(([tag, text]) => ({ tagName: tag, textContent: text })),
});

describe('the title of a table (#537)', () => {
  it('is a heading of any level', () => {
    expect(isTableTitle(element('H2', 'Orçamento 2027'))).toBe(true);
    expect(isTableTitle(element('H6', 'Detalhe'))).toBe(true);
  });

  it('is a line of bold or italic words alone', () => {
    expect(isTableTitle(element('P', 'Orçamento 2027', [['STRONG', 'Orçamento 2027']]))).toBe(true);
    expect(isTableTitle(element('P', ' Custos ', [['EM', 'Custos']]))).toBe(true);
  });

  it('is never a paragraph of text, even one with a bold word in it', () => {
    expect(isTableTitle(element('P', 'Os custos do ano seguem.'))).toBe(false);
    expect(isTableTitle(element('P', 'Os custos de 2027 seguem.', [['STRONG', '2027']]))).toBe(
      false,
    );
    expect(isTableTitle(element('UL', 'Item', [['LI', 'Item']]))).toBe(false);
  });
});
