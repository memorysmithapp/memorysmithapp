/**
 * Renaming a folder and changing its description (#278, RN-KNW-058): what is
 * written, the tree the moment the write is done, what a refusal says, and the
 * dialog itself in both locales.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TFunction } from 'i18next';
import { ApiError } from '../../shared/api/error-mapper';
import type { FolderNode, NotebookStructure } from '../../shared/types/api';
import { folderChange, folderChanged, folderRefusal } from './edit-folder';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

vi.stubGlobal('localStorage', memoryStorage());

function folder(id: string, name: string, children: FolderNode[] = []): FolderNode {
  return {
    id,
    parentId: null,
    name,
    slug: name.toLowerCase(),
    description: `What ${name} holds.`,
    position: 0,
    noteOrder: 'manual',
    hasTemplate: false,
    noteCount: 0,
    notes: [],
    children,
  };
}

const current = { name: 'Findings', description: 'What Findings holds.' };

describe('what an edit of a folder writes', () => {
  it('writes only what changed, trimmed, and nothing when nothing did', () => {
    expect(folderChange(current, ' Published ', current.description)).toEqual({
      name: 'Published',
    });
    expect(folderChange(current, current.name, 'Another.')).toEqual({ description: 'Another.' });
    expect(folderChange(current, `${current.name} `, current.description)).toEqual({});
  });

  it('shows the new name in the tree at once, at any depth', () => {
    const structure = {
      folders: [folder('F1', 'Norms', [folder('F2', 'Findings')])],
    } as unknown as NotebookStructure;
    const changed = folderChanged(structure, 'F2', { name: 'Published' });
    expect(changed.folders[0]?.children[0]?.name).toBe('Published');
    expect(changed.folders[0]?.name).toBe('Norms');
  });

  it('says a name a sibling holds in place, and anything else as the API said it', () => {
    const t = ((key: string, values?: Record<string, string>) =>
      `${key}${values ? JSON.stringify(values) : ''}`) as unknown as TFunction;
    expect(folderRefusal(new ApiError('CONFLICT', 'slug', 409), t, 'Norms')).toBe(
      'folderEdit.nameTaken{"name":"Norms"}',
    );
    expect(
      folderRefusal(new ApiError('FORBIDDEN', 'Shared by owner@example.com', 403), t, 'Norms'),
    ).toBe('Shared by owner@example.com');
  });
});

const LOADING_THE_BUNDLE_MS = 30_000;

let draw: (locale: 'en_US' | 'pt_BR', description?: string) => Promise<string>;

beforeAll(async () => {
  const i18n = (await import('../../i18n')).default;
  const { EditFolderForm } = await import('./EditFolder');
  draw = async (locale, description = current.description) => {
    await i18n.changeLanguage(locale);
    return renderToStaticMarkup(
      <EditFolderForm
        folder={{ ...current, description }}
        busy={false}
        refusal={null}
        onSubmit={() => undefined}
        onCancel={() => undefined}
      />,
    );
  };
}, LOADING_THE_BUNDLE_MS);

describe('the dialog that edits a folder', () => {
  it('says the description directs the next agent, and counts it against its limit, in pt_BR', async () => {
    const html = await draw('pt_BR');
    expect(html).toContain('É o que orienta o próximo agente que escrever aqui.');
    expect(html).toContain('20/500');
    expect(html).toContain('Salvar');
  });

  it('marks a description over the limit before it is sent, in en_US', async () => {
    const html = await draw('en_US', 'x'.repeat(501));
    expect(html).toContain('501/500');
    expect(html).toContain('folder-edit-count is-over');
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
  });
});
