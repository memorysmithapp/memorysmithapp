import { describe, expect, it } from 'vitest';
import { buildExportTree, type ExportInput } from '../src/domain/ExportTree.js';
import { createZip } from '../src/adapters/zip.js';

const vault: ExportInput = {
  vaultName: 'Normas e Legislacao',
  guidance: '# Proposito\n\nUma norma por nota.',
  folders: [
    {
      folderId: 'f1',
      parentFolderId: null,
      name: 'Normas',
      description: 'Texto normativo por artigo.',
      position: 'a0',
      templateContent: '# {{titulo}}\n\n## Vigencia',
    },
    {
      folderId: 'f2',
      parentFolderId: null,
      name: 'Achados',
      description: 'Achados de auditoria.',
      position: 'a1',
      templateContent: null,
    },
    {
      folderId: 'f3',
      parentFolderId: 'f2',
      name: '2026',
      description: 'Emitidos neste exercicio.',
      position: 'a0',
      templateContent: null,
    },
  ],
  notes: [
    {
      noteId: 'n1',
      folderId: 'f1',
      title: 'Lei 14.133',
      slug: 'lei-14133',
      position: 'a0',
      content: '# Lei 14.133\n\nArt. 75.',
    },
    {
      noteId: 'n2',
      folderId: 'f1',
      title: 'Portaria 9',
      slug: 'portaria-9',
      position: 'a1',
      content: 'Fundamento em [[lei-14133]].',
    },
  ],
};

describe('The export tree is where file names come back into existence', () => {
  it('materializes the guidance, the structure and the templates as Markdown files', () => {
    const files = buildExportTree(vault);
    const paths = files.map((file) => file.path);

    expect(paths).toContain('Normas e Legislacao/GUIDANCE.md');
    expect(paths).toContain('Normas e Legislacao/STRUCTURE.md');
    expect(paths).toContain('Normas e Legislacao/01 Normas/TEMPLATE.md');
    // Every file is Markdown; there is no index and no proprietary component.
    expect(files.every((file) => file.path.endsWith('.md'))).toBe(true);
  });

  it('writes no file inside a folder just to carry its description', () => {
    // The description is an attribute of the folder, never a document. It
    // survives in STRUCTURE.md and nowhere else (RN-PRT-003).
    const paths = buildExportTree(vault).map((file) => file.path);
    expect(paths.filter((path) => path.endsWith('/GUIDANCE.md'))).toEqual([
      'Normas e Legislacao/GUIDANCE.md',
    ]);
    expect(paths.some((path) => path.endsWith('/README.md'))).toBe(false);
  });

  it('encodes the order as a numeric prefix, which the file system lacks', () => {
    const paths = buildExportTree(vault).map((file) => file.path);
    expect(paths).toContain('Normas e Legislacao/01 Normas/01 lei-14133.md');
    expect(paths).toContain('Normas e Legislacao/01 Normas/02 portaria-9.md');
  });

  it('carries the whole annotated tree in STRUCTURE.md, in the Vault Context format', () => {
    const files = buildExportTree(vault);
    const structure = files.find((file) => file.path === 'Normas e Legislacao/STRUCTURE.md');
    expect(structure?.content).toBe(
      [
        '# Structure: Normas e Legislacao',
        '',
        '1. **Normas**: Texto normativo por artigo. (2 notes, has TEMPLATE.md)',
        '2. **Achados/**: Achados de auditoria. (0 notes)',
        '   2.1. **2026**: Emitidos neste exercicio. (0 notes)',
        '',
      ].join('\n'),
    );
  });

  it('leaves a folder with no template and no note out of the tree, not out of the record', () => {
    // A zip carries no empty directory anyway; STRUCTURE.md is what keeps the
    // folder, its place in the order and its description.
    const files = buildExportTree(vault);
    expect(files.some((file) => file.path.includes('/01 2026/'))).toBe(false);
    const structure = files.find((file) => file.path.endsWith('STRUCTURE.md'));
    expect(structure?.content).toContain('2.1. **2026**: Emitidos neste exercicio.');
  });

  it('leaves the links of the notes intact', () => {
    const files = buildExportTree(vault);
    const note = files.find((file) => file.path.endsWith('02 portaria-9.md'));
    expect(note?.content).toContain('[[lei-14133]]');
  });

  it('suffixes a note whose slug collides with a reserved name, links included', () => {
    // RN-PRT-005: the only concession of the export, and it belongs to the
    // edge rather than to the model.
    const withCollision: ExportInput = {
      ...vault,
      notes: [
        {
          noteId: 'n3',
          folderId: 'f1',
          title: 'Structure',
          slug: 'structure',
          position: 'a0',
          content: '# Structure',
        },
        {
          noteId: 'n4',
          folderId: 'f1',
          title: 'Aponta',
          slug: 'aponta',
          position: 'a1',
          content: 'Ver [[structure]] e [outro](structure.md).',
        },
      ],
    };
    const files = buildExportTree(withCollision);
    expect(files.map((file) => file.path)).toContain(
      'Normas e Legislacao/01 Normas/01 structure-note.md',
    );
    const pointing = files.find((file) => file.path.endsWith('02 aponta.md'));
    expect(pointing?.content).toContain('[[structure-note]]');
    expect(pointing?.content).toContain('(structure-note.md)');
  });

  it('writes a vault with no guidance without pretending it has one', () => {
    const files = buildExportTree({ ...vault, guidance: null });
    const guidance = files.find((file) => file.path === 'Normas e Legislacao/GUIDANCE.md');
    expect(guidance?.content).toBe('# Normas e Legislacao\n');
  });
});

describe('The archive', () => {
  it('is a readable zip with one entry per file', () => {
    const files = buildExportTree(vault);
    const archive = createZip(files, new Date('2026-03-12T10:15:00.000Z'));

    // Local file header, central directory and end-of-central-directory.
    expect(archive.readUInt32LE(0)).toBe(0x04034b50);
    const endOffset = archive.length - 22;
    expect(archive.readUInt32LE(endOffset)).toBe(0x06054b50);
    expect(archive.readUInt16LE(endOffset + 8)).toBe(files.length);
  });

  it('keeps the UTF-8 flag, so accented folder names survive', () => {
    const archive = createZip([{ path: 'Coordenacao/GUIDANCE.md', content: '# Ola' }], new Date());
    expect(archive.readUInt16LE(6) & 0x0800).toBe(0x0800);
  });
});
