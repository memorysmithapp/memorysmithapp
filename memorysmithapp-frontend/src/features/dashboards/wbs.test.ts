import { describe, expect, it } from 'vitest';
import { wbsLines, wbsTree } from './wbs';

const row = (code: string, title: string, progress?: number, weight?: number) => ({
  rowId: code,
  values: { code, title, ...(progress === undefined ? {} : { progress }), weight },
});
const OPTIONS = { code: 'code', title: 'title', progress: 'progress' };

describe('a WBS tree', () => {
  it('orders codes as numbers, not as text', () => {
    const lines = wbsLines(wbsTree([row('1.10', 'b'), row('1', 'a'), row('1.2', 'c')], OPTIONS));
    expect(lines.map((line) => line.code)).toEqual(['1', '1.2', '1.10']);
    expect(lines.map((line) => line.depth)).toEqual([0, 1, 1]);
  });

  it('rolls progress up from child to parent, through every level', () => {
    const [root] = wbsTree(
      [
        row('1', 'p', 5),
        row('1.1', 'a'),
        row('1.1.1', 'x', 100),
        row('1.1.2', 'y', 0),
        row('1.2', 'b', 50),
      ],
      OPTIONS,
    );
    expect(root?.children[0]?.progress).toBe(50);
    expect(root?.progress).toBe(50);
  });

  it('weighs children when the table says how much', () => {
    const [root] = wbsTree([row('1', 'p'), row('1.1', 'a', 100, 3), row('1.2', 'b', 0, 1)], {
      ...OPTIONS,
      weight: 'weight',
    });
    expect(root?.progress).toBe(75);
  });

  it('keeps a row whose parent is not among the rows', () => {
    const roots = wbsTree([row('1.2.3', 'orphan', 10), row('2', 'other')], OPTIONS);
    expect(roots.map((root) => root.code)).toEqual(['1.2.3', '2']);
  });

  it('says no progress for a table that has none', () => {
    const [root] = wbsTree([row('1', 'a'), row('1.1', 'b')], { code: 'code', title: 'title' });
    expect(root?.progress).toBeNull();
  });
});
