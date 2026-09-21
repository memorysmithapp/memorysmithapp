/**
 * A notebook leaves as ONE DOCUMENT (RN-PRT-009).
 *
 * It used to leave as a tree of `.md` files, and that was a one-way door:
 * everything a folder of files cannot hold was dropped at it — the identity of
 * a note, its fractional position, the description of a folder, the Guidance,
 * the Template, when each thing was written. What is asserted here is the
 * opposite property: the document holds exactly what the notebook holds, and
 * **nothing the notebook does not** (RN-PRT-010).
 */

import { describe, expect, it } from 'vitest';
import {
  archiveNameOf,
  buildNotebookDocument,
  carried,
  carriesEntry,
  NOTEBOOK_DOCUMENT_VERSION,
  subjectsOf,
  type ExportInput,
} from '../src/domain/NotebookDocumentBuilder.js';
import { createZip } from '../src/adapters/zip.js';

const notebook: ExportInput = {
  notebookName: 'Normas e Legislacao',
  notebookDescription: 'Texto normativo por artigo.',
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
      position: 'a0',
      createdAt: '2026-01-12T10:00:00.000Z',
      updatedAt: '2026-02-19T08:30:00.000Z',
      content: '---\nname: Lei 14.133\n---\n\n# A geral\n\nArt. 75.',
    },
    {
      noteId: 'n2',
      folderId: 'f1',
      position: 'a1',
      createdAt: '2026-01-13T10:00:00.000Z',
      updatedAt: '2026-01-13T10:00:00.000Z',
      content: 'Fundamento em [[Lei 14.133]].',
    },
  ],
};

const NOW = '2026-09-09T12:00:00.000Z';
const document = buildNotebookDocument(notebook, NOW);

describe('the document carries the notebook whole', () => {
  it('says what shape it is, and carries no version of the notation', () => {
    // The one field an importer reads before anything else. The notation the
    // bodies are written in has no version apart from the product that wrote
    // them, so the document states none (RN-PRT-011).
    expect(document.documentVersion).toBe(NOTEBOOK_DOCUMENT_VERSION);
    expect(document).not.toHaveProperty('specVersion');
    expect(document.exportedAt).toBe(NOW);
  });

  it('carries the notebook, its guidance and every folder with its parent and position', () => {
    expect(document.notebook).toEqual({
      name: 'Normas e Legislacao',
      description: 'Texto normativo por artigo.',
      guidance: '# Proposito\n\nUma norma por nota.',
    });
    expect(document.folders.map((folder) => [folder.folderId, folder.parentFolderId])).toEqual([
      ['f1', null],
      ['f2', null],
      ['f3', 'f2'],
    ]);
    // The order is a FIELD, not a numeric prefix in a file name: the fractional
    // key comes out exactly as it went in (RN-PRT-002, removed).
    expect(document.folders.map((folder) => folder.position)).toEqual(['a0', 'a1', 'a0']);
    expect(document.folders[0]?.template).toBe('# {{titulo}}\n\n## Vigencia');
    expect(document.folders[1]?.template).toBeNull();
  });

  it('carries every body byte for byte, frontmatter included', () => {
    expect(document.notes.map((note) => note.body)).toEqual(
      notebook.notes.map((note) => note.content),
    );
  });

  it('never rewrites a link, because the body is copied and not processed', () => {
    // Rewriting destinations was correct while a link addressed a file, and it
    // is corruption now that it addresses a name (RN-PRT-004).
    expect(document.notes[1]?.body).toContain('[[Lei 14.133]]');
  });

  it('stores nothing derived: no name, no slug, no file name', () => {
    // RN-PRT-010. The name of `n1` is stated in its frontmatter and differs
    // from its heading, which is exactly the case a stored name would get
    // wrong the moment somebody edited one of the two.
    const serialised = JSON.stringify(document);
    for (const note of document.notes) {
      expect(Object.keys(note).sort()).toEqual([
        'body',
        'createdAt',
        'folderId',
        'noteId',
        'position',
        'updatedAt',
      ]);
    }
    // The notebook and its folders carry the names they were given; what a
    // note is called stays inside its body, which the keys above already prove.
    expect(serialised).not.toContain('"slug"');
    expect(serialised).not.toContain('.md');
  });

  it('keeps the dates each note states about itself', () => {
    expect(document.notes[0]?.createdAt).toBe('2026-01-12T10:00:00.000Z');
    expect(document.notes[0]?.updatedAt).toBe('2026-02-19T08:30:00.000Z');
  });
});

describe('the archive is one document with the extension of the format', () => {
  it('is named after the notebook and ends in .notebook', () => {
    expect(archiveNameOf('Normas e Legislacao')).toBe('Normas e Legislacao.notebook');
    expect(archiveNameOf('a/b:c')).toBe('a-b-c.notebook');
    expect(archiveNameOf('   ')).toBe('notebook.notebook');
  });

  it('zips into a container that is a real zip', () => {
    const archive = createZip(
      [{ path: 'notebook.json', content: JSON.stringify(document) }],
      new Date(NOW),
    );
    expect(archive.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(archive.includes(Buffer.from('notebook.json'))).toBe(true);
  });
});

/**
 * The history an archive carries is the history OF WHAT IT CARRIES
 * (RN-PRT-022, #161).
 *
 * The way in has always followed this rule — an entry about something the
 * selection left out is left out with it (RN-PRT-023) — and the way out did
 * not: an archive of one folder arrived with the trail of the whole notebook,
 * naming folders and notes that were not in it, and carrying the BODY of every
 * revision those entries named. That last part is the sharp one: a Guidance
 * deliberately left out of an archive travelled inside its history.
 *
 * The whole notebook is still the trail whole, deleted notes included, because
 * that is the only place such an entry survives (RN-PRT-006, RN-AUD-011).
 */
describe('the history of a selection', () => {
  /** Two folders and nothing of `f1`, which holds the one Template. */
  const subjects = subjectsOf(
    carried(notebook, { guidance: false, folders: ['f2', 'f3'], templates: [], notes: [] }),
  );

  const entry = (type: string, subject: string, subjectId: string) => ({
    type,
    subject,
    subjectId,
  });

  it('carries the trail whole when nothing was selected', () => {
    // Including the entries about notes that were deleted, which travel
    // nowhere else: deleting the notebook takes its trail with it.
    expect(carriesEntry(entry('NoteDeleted', 'NOTE', 'gone'), null)).toBe(true);
    expect(carriesEntry(entry('GuidanceUpdated', 'NOTEBOOK', 'nb'), null)).toBe(true);
  });

  it('leaves out an entry about a note the archive does not carry', () => {
    const oneNote = subjectsOf(
      carried(notebook, { guidance: false, folders: [], templates: [], notes: ['n2'] }),
    );
    expect(carriesEntry(entry('NoteUpdated', 'NOTE', 'n2'), oneNote)).toBe(true);
    expect(carriesEntry(entry('NoteUpdated', 'NOTE', 'n1'), oneNote)).toBe(false);
    // A note deleted before the export is in no document, so no selection has
    // it: what kept it was the whole notebook, and this is not one.
    expect(carriesEntry(entry('NoteDeleted', 'NOTE', 'gone'), oneNote)).toBe(false);
  });

  it('leaves out an entry about a folder the archive does not carry', () => {
    expect(carriesEntry(entry('FolderRenamed', 'FOLDER', 'f3'), subjects)).toBe(true);
    expect(carriesEntry(entry('FolderRenamed', 'FOLDER', 'f1'), subjects)).toBe(false);
  });

  it('keeps the entries of a folder carried as a path, and not those of its Template', () => {
    /**
     * A path carries its name and its description and nothing else of its own
     * (RN-PRT-017), so what the archive holds of it is exactly what a rename
     * and a description are about — and its Template is not in the archive, so
     * the entries that carry the BODY of that Template are not either.
     */
    const viaNote = subjectsOf(
      carried(notebook, { guidance: false, folders: [], templates: [], notes: ['n2'] }),
    );
    expect(viaNote.folders.has('f1')).toBe(true);
    expect(viaNote.templates.has('f1')).toBe(false);
    expect(carriesEntry(entry('FolderRenamed', 'FOLDER', 'f1'), viaNote)).toBe(true);
    expect(carriesEntry(entry('TemplateUpdated', 'FOLDER', 'f1'), viaNote)).toBe(false);
  });

  it('asks a Template against the Template and not against its folder', () => {
    // `f1` holds the one Template of this notebook and is not carried here.
    const withTemplate = subjectsOf(
      carried(notebook, { guidance: false, folders: ['f1'], templates: ['f1'], notes: [] }),
    );
    const without = subjectsOf(
      carried(notebook, { guidance: false, folders: ['f1'], templates: [], notes: [] }),
    );
    expect(carriesEntry(entry('TemplateUpdated', 'FOLDER', 'f1'), withTemplate)).toBe(true);
    expect(carriesEntry(entry('TemplateUpdated', 'FOLDER', 'f1'), without)).toBe(false);
    // The folder itself still has its own entries in both.
    expect(carriesEntry(entry('FolderRenamed', 'FOLDER', 'f1'), without)).toBe(true);
  });

  it('asks the Guidance against the Guidance and not against the notebook', () => {
    const whole = subjectsOf(notebook);
    expect(carriesEntry(entry('GuidanceUpdated', 'NOTEBOOK', 'nb'), subjects)).toBe(false);
    expect(carriesEntry(entry('GuidanceUpdated', 'NOTEBOOK', 'nb'), whole)).toBe(true);
  });

  it('always carries the life of the notebook, whatever was selected', () => {
    // An import reads the old identifier of the notebook off these, and
    // re-keys everything else onto what it minted (RN-PRT-013, RN-PRT-023).
    expect(carriesEntry(entry('NotebookCreated', 'NOTEBOOK', 'nb'), subjects)).toBe(true);
    expect(carriesEntry(entry('NotebookRenamed', 'NOTEBOOK', 'nb'), subjects)).toBe(true);
  });

  it('carries nothing about a subject that is not of this notebook', () => {
    expect(carriesEntry(entry('MemberInvited', 'SUBSCRIPTION', 's1'), subjects)).toBe(false);
  });
});
