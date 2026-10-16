import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteSaves, newSessionId, type SavePorts } from './note-saves';

const WORDS = {
  conflictTitle: 'Somebody else wrote',
  conflictMessage: 'Their version is newer.',
  reload: 'Discard my edit and reload',
  saveAnyway: 'Save anyway',
  failedTitle: 'Not saved',
  retry: 'Try again',
  renamedTitle: 'Renamed',
  renamed: (from: string | null, to: string | null, cost: { losing: number; gaining: number }) =>
    `${from}→${to} -${cost.losing} +${cost.gaining}`,
  keepBroken: 'Keep the links broken',
  keepAlias: (name: string) => `Keep ${name} as an alias`,
  understood: 'OK',
};

const named = (name: string, body = '') => `---\nname: ${name}\n---\n${body}`;
const nameOf = (raw: string) => /^name: (.+)$/m.exec(raw)?.[1] ?? null;

function ports(overrides: Partial<SavePorts> = {}) {
  let revision = 1;
  const writes: Array<{ content: string; baseRevision: string; session: string }> = [];
  const replaced: string[] = [];
  const port: SavePorts = {
    write: vi.fn(async (input) => {
      writes.push(input);
      revision += 1;
      return { revision: `v${revision}` };
    }),
    refusalOf: (error) => error as never,
    reload: async () => ({ raw: named('Theirs'), revision: 'v9' }),
    replace: (raw) => replaced.push(raw),
    nameOf,
    withAlias: (raw, alias) => raw.replace('---\n', `---\naliases: [${alias}]\n`),
    renameCost: async () => ({ losing: 2, gaining: 1 }),
    written: () => undefined,
    words: WORDS,
    ...overrides,
  };
  return { port, writes, replaced };
}

describe('the saves of an edit session (RN-KNW-052, RN-AUD-013)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes once per pause, never once per keystroke, on the revision each write produced', async () => {
    const { port, writes } = ports();
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);

    const first = saves.change(named('A', 'o'));
    saves.change(named('A', 'ol'));
    const third = saves.change(named('A', 'olá'));
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, third]);
    saves.change(named('A', 'olá!'));
    await vi.advanceTimersByTimeAsync(1000);

    expect(writes.map((write) => [write.content, write.baseRevision, write.session])).toEqual([
      [named('A', 'olá'), 'v1', 'S1'],
      [named('A', 'olá!'), 'v2', 'S1'],
    ]);
  });

  it('holds the editor in Saving until the pause ends, and writes at once when flushed', async () => {
    const { port, writes } = ports();
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    let settled = false;
    void saves.change(named('A', 'x')).then(() => (settled = true));
    expect(saves.pending).toBe(true);
    await saves.flush({ keepalive: true });
    expect(settled).toBe(true);
    expect(writes).toHaveLength(1);
    expect(saves.pending).toBe(false);
  });

  it('refuses a divergence with their version or a write on it, which keeps theirs in the history', async () => {
    let refuse = true;
    const { port, writes, replaced } = ports({
      write: vi.fn(async (input) => {
        if (refuse) {
          refuse = false;
          throw { code: 'CONFLICT', currentRevision: 'v7', message: 'changed' };
        }
        writes.push(input);
        return { revision: 'v8' };
      }),
    });
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    const saving = saves.change(named('A', 'mine'));
    const caught = saving.catch((refusal: unknown) => refusal);
    await vi.advanceTimersByTimeAsync(1000);
    const refusal = (await caught) as {
      title: string;
      actions: Array<{ label: string; run: () => unknown }>;
    };

    expect(refusal.title).toBe(WORDS.conflictTitle);
    expect(refusal.actions.map((action) => action.label)).toEqual([WORDS.reload, WORDS.saveAnyway]);

    await refusal.actions[1]!.run();
    expect(writes.at(-1)).toMatchObject({ content: named('A', 'mine'), baseRevision: 'v7' });
    expect(replaced).toEqual([]);
  });

  it('gives back their version when the person discards the edit', async () => {
    const { port, writes, replaced } = ports({
      write: vi.fn(async () => {
        throw { code: 'CONFLICT', currentRevision: 'v7', message: 'changed' };
      }),
    });
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    const caught = saves.change(named('A', 'mine')).catch((refusal: unknown) => refusal);
    await vi.advanceTimersByTimeAsync(1000);
    const refusal = (await caught) as { actions: Array<{ run: () => Promise<unknown> }> };
    await refusal.actions[0]!.run();
    expect(replaced).toEqual([named('Theirs')]);
    expect(writes).toEqual([]);
  });

  it('says any other refusal in its own words, with the offer to try again', async () => {
    const { port } = ports({
      write: vi.fn(async () => {
        throw { code: 'CONFLICT', currentRevision: null, message: 'The folder holds “B” already' };
      }),
    });
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    const caught = saves.change(named('B')).catch((refusal: unknown) => refusal);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await caught).toMatchObject({
      title: WORDS.failedTitle,
      message: 'The folder holds “B” already',
      actions: [{ label: WORDS.retry }],
    });
  });

  it('tells a rename once, after it landed, and keeps the old name as an alias when asked', async () => {
    const { port, writes, replaced } = ports();
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);

    const renaming = saves.change(named('B'));
    await vi.advanceTimersByTimeAsync(1000);
    const outcome = (await renaming) as unknown as {
      message: string;
      actions: Array<{ label: string; run: () => Promise<unknown> }>;
    };
    expect(outcome.message).toBe('A→B -2 +1');
    expect(outcome.actions.map((action) => action.label)).toEqual([
      WORDS.keepBroken,
      'Keep A as an alias',
    ]);

    // Typing on under the same name is not news.
    const typing = saves.change(named('B', 'more'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await typing).toBeUndefined();

    await outcome.actions[1]!.run();
    expect(replaced.at(-1)).toBe('---\naliases: [A]\nname: B\n---\nmore');
    expect(writes.at(-1)?.content).toBe('---\naliases: [A]\nname: B\n---\nmore');
  });

  it('says nothing when the name goes back to the one edit mode opened with', async () => {
    const { port } = ports();
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    const away = saves.change(named('B'));
    await vi.advanceTimersByTimeAsync(1000);
    await away;
    const back = saves.change(named('A'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await back).toBeUndefined();
  });

  it('writes nothing for bytes the server already has (RN-KNW-028)', async () => {
    const { port, writes } = ports();
    const saves = new NoteSaves(port, { raw: named('A'), revision: 'v1' }, 'S1', 1000);
    const same = saves.change(named('A'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await same).toBeUndefined();
    expect(writes).toEqual([]);
  });
});

describe('newSessionId', () => {
  it('is a ULID', () => {
    expect(newSessionId()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});
