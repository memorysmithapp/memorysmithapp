import { describe, expect, it } from 'vitest';
import { ordinalAt, taskBoxes, taskCheckedAt, toggleTaskAt } from './tasklist';

const list = [
  '# Roteiro',
  '',
  '- [ ] Ler a norma',
  '- [x] Resumir',
  '- [ ] Ligar aos conceitos',
].join('\n');

describe('finding the boxes', () => {
  it('finds one per task item, and none in a plain list', () => {
    expect(taskBoxes(list)).toHaveLength(3);
    expect(taskBoxes('- just an item\n- another')).toHaveLength(0);
  });

  it('accepts the three bullet markers and ordered items', () => {
    expect(taskBoxes('- [ ] a\n* [ ] b\n+ [ ] c\n1. [ ] d\n2) [ ] e')).toHaveLength(5);
  });

  it('ignores a task item inside a fenced block', () => {
    // The failure this prevents is the worst one available: the index shifts
    // and the click lands on another item, silently.
    const withFence = ['```markdown', '- [ ] an example', '```', '', '- [ ] the real one'].join(
      '\n',
    );

    expect(taskBoxes(withFence)).toHaveLength(1);
    expect(toggleTaskAt(withFence, 0)).toContain('- [x] the real one');
    expect(toggleTaskAt(withFence, 0)).toContain('- [ ] an example');
  });
});

describe('toggling one box', () => {
  it('changes exactly one character, and nothing else', () => {
    const after = toggleTaskAt(list, 0) ?? '';

    expect(after).toBe(list.replace('- [ ] Ler a norma', '- [x] Ler a norma'));
    expect(after.length).toBe(list.length);
  });

  it('unchecks with a space, and checks with a lowercase x', () => {
    expect(toggleTaskAt(list, 1)).toContain('- [ ] Resumir');
    expect(toggleTaskAt('- [X] Feito', 0)).toBe('- [ ] Feito');
    expect(toggleTaskAt('- [ ] Feito', 0)).toBe('- [x] Feito');
  });

  it('leaves the frontmatter and the spacing untouched', () => {
    const document = ['---', 'maturity: seed', 'tags: [a, b]', '---', '', '- [ ] Um item', ''].join(
      '\n',
    );
    const after = toggleTaskAt(document, 0) ?? '';

    expect(after.startsWith('---\nmaturity: seed\ntags: [a, b]\n---\n\n')).toBe(true);
    expect(after.endsWith('\n')).toBe(true);
  });

  it('answers null when the item is not there, instead of writing the wrong one', () => {
    expect(toggleTaskAt(list, 9)).toBeNull();
  });
});

describe('mapping a rendered box back to its item', () => {
  it('counts the items that start before it', () => {
    const boxes = taskBoxes(list);

    expect(ordinalAt(list, boxes[0] ?? 0)).toBe(0);
    expect(ordinalAt(list, boxes[2] ?? 0)).toBe(2);
  });

  it('reads the current state of an item', () => {
    expect(taskCheckedAt(list, 0)).toBe(false);
    expect(taskCheckedAt(list, 1)).toBe(true);
  });
});
