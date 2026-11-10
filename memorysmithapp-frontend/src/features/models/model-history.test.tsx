/**
 * The history of a notebook model (#431), which replaced its frozen versions:
 * each change with its date, who made it — the connector, or the person in
 * the interface — what changed, the line its author left, and an edit session
 * as one change with how many saves it held. The community reads it without
 * who. Rendered to static markup in both locales.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { i18n as I18n } from 'i18next';
import type { ModelHistoryChange } from './ModelHistory';

const stored = new Map<string, string>();
vi.stubGlobal('localStorage', {
  get length() {
    return stored.size;
  },
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  removeItem: (key: string) => void stored.delete(key),
  setItem: (key: string, value: string) => void stored.set(key, value),
} as Storage);

const CHANGES: ModelHistoryChange[] = [
  {
    occurredAt: '2026-11-09T15:20:00.000Z',
    since: '2026-11-09T15:02:00.000Z',
    saves: 3,
    type: 'NoteUpdated',
    subject: 'Note',
    subjectId: '01J8X2K9QZ3M4N5P6R7S8T9VN1',
    name: 'Minutes of the assembly',
    agent: null,
    message: null,
  },
  {
    occurredAt: '2026-11-08T10:00:00.000Z',
    since: '2026-11-08T10:00:00.000Z',
    saves: 1,
    type: 'TemplateUpdated',
    subject: 'Folder',
    subjectId: '01J8X2K9QZ3M4N5P6R7S8T9VF1',
    name: 'Assemblies',
    agent: 'Claude',
    message: 'Ask for the quorum in every minute',
  },
  {
    occurredAt: '2026-11-07T09:00:00.000Z',
    since: '2026-11-07T09:00:00.000Z',
    saves: 1,
    type: 'SomethingNew',
    subject: 'Notebook',
    subjectId: '01J8X2K9QZ3M4N5P6R7S8T9V0A',
    name: null,
    agent: null,
    message: null,
  },
];

let i18n: I18n;
let draw: (
  changes: readonly ModelHistoryChange[],
  options?: { truncated?: boolean; withAuthor?: boolean },
) => string;

beforeAll(async () => {
  i18n = (await import('../../i18n')).default;
  const { ModelHistoryList } = await import('./ModelHistory');
  draw = (changes, { truncated = false, withAuthor = true } = {}) =>
    renderToStaticMarkup(
      <ModelHistoryList changes={changes} truncated={truncated} withAuthor={withAuthor} />,
    );
}, 30_000);

describe('the history of a model (#431)', () => {
  it('says who made each change: the connector, or the person in the interface', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CHANGES);
    expect(html).toContain('<span class="history-author">Claude</span>');
    expect(html).toContain('<span class="history-author">From the interface</span>');
  });

  it('says what changed, by its kind and its name, and the line its author left', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CHANGES);
    expect(html).toContain('Template written');
    expect(html).toContain('<p class="history-subject">Assemblies</p>');
    expect(html).toContain('Ask for the quorum in every minute');
    expect(html).toContain('No line was left about this change.');
    // A kind the interface does not know yet reads as the type it is.
    expect(html).toContain('SomethingNew');
  });

  it('shows an edit session as one change, with its saves and since when', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(CHANGES);
    expect(html).toContain('class="history-session"');
    expect(html).toMatch(/<p class="history-span">3 saves, since Nov \d+, 2026/);
    expect(html.match(/history-span/g)).toHaveLength(1);
  });

  it('says when older changes were left out, and only then', async () => {
    await i18n.changeLanguage('en_US');
    expect(draw(CHANGES, { truncated: true })).toContain('Older changes are left out.');
    expect(draw(CHANGES)).not.toContain('Older changes are left out.');
  });

  it('never says who in the community', async () => {
    await i18n.changeLanguage('en_US');
    const html = draw(
      CHANGES.map(({ agent: _agent, ...change }) => change),
      { withAuthor: false },
    );
    expect(html).not.toContain('history-author');
    expect(html).toContain('Note written');
  });

  it('renders in pt_BR, whose locale tag is not the one Intl takes', async () => {
    await i18n.changeLanguage('pt_BR');
    const html = draw(CHANGES);
    expect(html).toContain('Pela interface');
    expect(html).toContain('Modelo de pasta escrito');
    expect(html).toContain('3 salvamentos, desde');
    expect(html).toContain('nov.');
    await i18n.changeLanguage('en_US');
  });

  it('says so when nothing was recorded yet', async () => {
    await i18n.changeLanguage('en_US');
    expect(draw([])).toContain('No change was recorded yet.');
  });
});
