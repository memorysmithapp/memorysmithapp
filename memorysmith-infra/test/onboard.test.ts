/**
 * What the onboarding command reads and how it calls the product
 * (architecture-guide.md, section 20). The calls to Cognito and to a live API
 * are the environment's; what decides what gets written is here.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boundedDescription, countTree, readNotebookTree } from '../commands/lib/notebook-tree.js';
import { workingPassword } from '../commands/lib/passwords.js';
import { ProductApi } from '../commands/lib/product-api.js';
import { REPOSITORY_ROOT } from '../commands/lib/repository.js';

const NOTEBOOKS = join(REPOSITORY_ROOT, 'notebooks', 'trees');

describe('a notebook tree', () => {
  it('reads the folders, their Templates and their notes, in the order the structure gives', () => {
    const tree = readNotebookTree(join(NOTEBOOKS, 'enologia'), 'enologia');

    expect(tree.name).toBe('Enologia');
    expect(tree.guidance).toContain('## Regras de escrita');
    expect(tree.folders.map((folder) => folder.title)).toEqual(['Castas', 'Protocolos', 'Safras']);
    expect(tree.folders.every((folder) => folder.template !== null)).toBe(true);
    expect(tree.folders[0]?.notes.map((note) => note.file)).toContain('Cabernet Sauvignon.md');
    expect(tree.orphanNotes).toBe(0);
  });

  it('nests folders by the numbering of the structure, three levels deep', () => {
    const tree = readNotebookTree(
      join(NOTEBOOKS, 'engineering-knowledge'),
      'engineering-knowledge',
    );

    const literature = tree.folders[0];
    expect(literature?.title).toBe('Literature');
    expect(literature?.children.map((child) => child.title)).toEqual([
      'Books',
      'Courses',
      'Use Cases',
    ]);
    expect(literature?.children[0]?.children.map((child) => child.title)).toContain(
      'Lean Inception',
    );
    expect(countTree(tree.folders).notes).toBeGreaterThan(500);
  });

  it('keeps a folder the structure declares even when it left no directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'notebook-'));
    writeFileSync(join(root, 'GUIDANCE.md'), '# Fixture\n');
    writeFileSync(
      join(root, 'STRUCTURE.md'),
      [
        '# Structure: Fixture',
        '',
        '1. **Written**: Holds a note. (1 note)',
        '2. **Empty**: Holds nothing yet, and no directory remembers it. (0 notes)',
      ].join('\n'),
    );
    mkdirSync(join(root, '01 Written'));
    writeFileSync(join(root, '01 Written', 'A note.md'), '---\nname: A note\n---\n');
    writeFileSync(join(root, 'Stray.md'), 'no folder holds this');

    const tree = readNotebookTree(root, 'fixture');

    expect(tree.folders.map((folder) => [folder.title, folder.notes.length])).toEqual([
      ['Written', 1],
      ['Empty', 0],
    ]);
    expect(tree.orphanNotes).toBe(1);
  });

  it('cuts a description past 500 characters, and gives a missing one a sentence', () => {
    expect(boundedDescription('x'.repeat(600), 'Long')).toHaveLength(500);
    expect(boundedDescription('', 'Castas')).toBe('Notas de Castas.');
  });
});

describe('the working password', () => {
  it('meets the policy of the pool by construction', () => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const password = workingPassword();
      expect(password).toHaveLength(24);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/^[A-Za-z0-9]+$/);
    }
  });
});

describe('a call to the product API', () => {
  it('asks again after a throttle or a bad gateway, and never after an answer', async () => {
    const statuses = [429, 502, 201];
    const slept: number[] = [];
    const api = new ProductApi(
      'https://api.example.test',
      (async () => {
        const status = statuses.shift() ?? 500;
        return new Response(status === 201 ? '{"folderId":"f1"}' : 'busy', { status });
      }) as typeof fetch,
      async (milliseconds) => void slept.push(milliseconds),
    );

    expect(await api.call('POST', '/knowledge/notebooks/n/folders', 'token', {})).toEqual({
      folderId: 'f1',
    });
    expect(slept).toEqual([2000, 4000]);
  });

  it('throws the answer of a 4xx at once', async () => {
    const api = new ProductApi(
      'https://api.example.test',
      (async () => new Response('{"code":"VALIDATION"}', { status: 400 })) as typeof fetch,
      async () => undefined,
    );
    await expect(api.call('POST', '/knowledge/notebooks', 'token', {})).rejects.toThrow('400');
  });
});
