/**
 * A `.notebook` read in the browser before it is uploaded (#143), by slices
 * (#481): the tail, the central directory, ZIP64 included, and the document,
 * and never a byte of a file entry, since a `1.6` archive holds each kept file
 * as an entry of its own and may be gigabytes (RN-PRT-092).
 */

import { describe, expect, it } from 'vitest';
import { ArchiveError, readNotebookArchive } from './notebook-archive';

/**
 * An archive as the export of `1.6` writes it: `notebook.json`, deflated, and
 * `files/1/foto.png`, twelve bytes stored as a ZIP64 entry with its CRC in a
 * descriptor, then the ZIP64 end record, its locator and the classic end.
 */
const ARCHIVE_1_6 =
  'UEsDBBQAAAgIAABIcV1tjum5/QAAAHIBAAANAAAAbm90ZWJvb2suanNvbmXPTW6DMBAF4KtUb+2AfyCAd9n0BGkXrbJw7IFYBRuBUzWNcveKEFWVunvSzHxPc4WL9jxQSK80zT4GaIhsCwb6GuOUyO0SNCSX240QG1HthdSca84zzvkbGEJMdIzxA/qKYAaCxs7S9BnB4Gi2kx/T6j7HFOcMDN3ZOxMsQYdz398Y2tg7mmbo98MKPmLr+3v8lduYYjaG7p/9Mpin+xAMgx9ofxmXfT+YjvL1IJnuwY4mnaCRL1+GNF0WeGnKRf6nYPbfBC0kw3wystxCo1ClMsJRRdxZW1BdqZKTlK60DVHTKqo41ZYaq0SpFNmmEUeiuq64LWpR4Ha4/QBQSwMELQAICAAAAEhxXQAAAAD//////////xAAFABmaWxlcy8xL2ZvdG8ucG5nAQAQAAwAAAAAAAAADAAAAAAAAACJUE5HDQoaCgECAwRQSwcI9UB1hAwAAAAAAAAADAAAAAAAAABQSwECFAAUAAAICAAASHFdbY7puf0AAAByAQAADQAAAAAAAAAAAAAAAAAAAAAAbm90ZWJvb2suanNvblBLAQItAC0ACAgAAABIcV31QHWE//////////8QABwAAAAAAAAAAAAAAP////9maWxlcy8xL2ZvdG8ucG5nAQAYAAwAAAAAAAAADAAAAAAAAAAoAQAAAAAAAFBLBgYsAAAAAAAAAC0ALQAAAAAAAAAAAAIAAAAAAAAAAgAAAAAAAACVAAAAAAAAAI4BAAAAAAAAUEsGBwAAAAAjAgAAAAAAAAEAAABQSwUGAAAAAAIAAgCVAAAAjgEAAAAA';

const bytesOf = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

/** A file that says which ranges of it were read. */
class Recorded extends Blob {
  constructor(
    parts: BlobPart[],
    readonly ranges: Array<[number, number]> = [],
  ) {
    super(parts);
  }
  override slice(start?: number, end?: number, contentType?: string): Blob {
    this.ranges.push([start ?? 0, end ?? this.size]);
    return super.slice(start, end, contentType);
  }
}

describe('reading a .notebook in the browser', () => {
  it('reads a 1.6 archive, ZIP64 and all, and its document names each file by its entry', async () => {
    const document = await readNotebookArchive(new Blob([bytesOf(ARCHIVE_1_6) as BlobPart]));

    expect(document.documentVersion).toBe('1.6');
    expect(document.files).toEqual([
      expect.objectContaining({
        name: 'foto.png',
        entry: 'files/1/foto.png',
        size: 12,
      }),
    ]);
  });

  it('reads the directory, the header and the document by their own ranges, past the file entry', async () => {
    const archive = bytesOf(ARCHIVE_1_6);
    const file = new Recorded([archive as BlobPart]);

    await readNotebookArchive(file);

    // The twelve bytes of the picture sit right after its local header.
    const picture = [...archive.keys()].find(
      (at) => archive[at] === 0x89 && archive[at + 1] === 0x50 && archive[at + 2] === 0x4e,
    );
    expect(picture).toBeDefined();
    const start = picture ?? 0;
    // The tail is read from the start of a file this small, and holds it all;
    // every other read stops short of the picture or starts after it.
    const others = file.ranges.filter(([from, to]) => !(from === 0 && to === archive.length));
    expect(others.length).toBeGreaterThan(0);
    for (const [from, to] of others) expect(to <= start || from >= start + 12).toBe(true);
  });

  it('refuses what is not a zip', async () => {
    await expect(
      readNotebookArchive(new Blob(['not a zip at all, nothing like one'])),
    ).rejects.toEqual(new ArchiveError('NOT_AN_ARCHIVE'));
  });
});
