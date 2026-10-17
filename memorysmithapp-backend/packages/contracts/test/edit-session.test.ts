import { describe, expect, it } from 'vitest';
import { groupHistory } from '../src/edit-session.js';

const save = (id: string, session: string | null) => ({ id, session });

describe('groupHistory (RN-AUD-013)', () => {
  it('shows a run of saves of one session as one entry', () => {
    const groups = groupHistory([save('a', 'S1'), save('b', 'S1'), save('c', 'S1')]);
    expect(groups).toEqual([
      {
        kind: 'session',
        session: 'S1',
        entries: [save('a', 'S1'), save('b', 'S1'), save('c', 'S1')],
      },
    ]);
  });

  it('keeps every write outside a session as an entry of its own', () => {
    const groups = groupHistory([save('a', null), save('b', null)]);
    expect(groups.map((group) => group.kind)).toEqual(['entry', 'entry']);
  });

  it('splits a session where somebody else wrote between two of its saves', () => {
    const groups = groupHistory([save('a', 'S1'), save('agent', null), save('b', 'S1')]);
    expect(groups.map((group) => group.kind)).toEqual(['session', 'entry', 'session']);
  });

  it('never joins two sessions that follow each other', () => {
    const groups = groupHistory([save('a', 'S1'), save('b', 'S2')]);
    expect(groups).toHaveLength(2);
  });

  it('answers nothing for an empty history', () => {
    expect(groupHistory([])).toEqual([]);
  });
});
