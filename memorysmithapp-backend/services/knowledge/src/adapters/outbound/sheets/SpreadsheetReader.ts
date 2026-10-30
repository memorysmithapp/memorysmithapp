/**
 * Reads the rows of a CSV or an Excel workbook (#366): the first row is the
 * header, every row after it a row of the table.
 *
 * A CSV is read here, by RFC 4180: fields separated by a comma or, as a file
 * written in pt-BR does, a semicolon, the separator being the one the header
 * line uses more; a field may be quoted, a quote inside one doubled. A byte
 * order mark is not text and is dropped. An Excel workbook is read by
 * `read-excel-file`, one sheet per table, a formula by the value it last
 * computed and a date as the date it shows.
 */

import { DomainError, err, ok, type Result } from '@memorysmithapp/kernel';
import readXlsxFile, { readSheetNames } from 'read-excel-file/node';
import type { Sheet, SheetCell, SheetReader } from '../../../domain/ports/index.js';

const CSV = 'text/csv';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export class SpreadsheetReader implements SheetReader {
  readonly accepted = [CSV, XLSX] as const;

  async read(bytes: Uint8Array, mimeType: string): Promise<Result<Sheet[], DomainError>> {
    const type = mimeType.trim().toLowerCase();
    if (type === CSV) return readCsv(bytes);
    if (type === XLSX) return readWorkbook(bytes);
    return err(
      DomainError.validation(
        `Rows are read from a CSV or an Excel file (.xlsx), and this one is ${type}`,
      ),
    );
  }
}

function headerAndRows(name: string, rows: SheetCell[][]): Result<Sheet, DomainError> {
  const nonEmpty = rows.filter((row) => row.some((cell) => cell !== null && cell !== ''));
  const [header, ...body] = nonEmpty;
  if (!header) return err(DomainError.validation(`The sheet "${name}" holds no rows`));
  return ok({
    name,
    header: header.map((cell) => String(cell ?? '').trim()),
    rows: body,
  });
}

export function readCsv(bytes: Uint8Array): Result<Sheet[], DomainError> {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return err(DomainError.validation('A CSV is read as UTF-8, and these bytes are not'));
  }
  if (text.codePointAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: SheetCell[][] = [];
  let row: SheetCell[] = [];
  let field = '';
  let quoted = false;
  let wasQuoted = false;
  const endField = () => {
    row.push(field.length === 0 && !wasQuoted ? null : field);
    field = '';
    wasQuoted = false;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index] as string;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) {
      quoted = true;
      wasQuoted = true;
    } else if (char === separator) endField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      endField();
      rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) return err(DomainError.validation('A quoted field of the CSV is never closed'));
  if (field.length > 0 || wasQuoted || row.length > 0) {
    endField();
    rows.push(row);
  }
  const sheet = headerAndRows('CSV', rows);
  return sheet.ok ? ok([sheet.value]) : sheet;
}

async function readWorkbook(bytes: Uint8Array): Promise<Result<Sheet[], DomainError>> {
  const buffer = Buffer.from(bytes);
  let names: string[];
  try {
    names = await readSheetNames(buffer);
  } catch {
    return err(DomainError.validation('These bytes are not an Excel workbook that can be read'));
  }
  const sheets: Sheet[] = [];
  for (const name of names) {
    const rows = await readXlsxFile(buffer, { sheet: name });
    const cells = rows.map((row) => row.map(cellOf));
    const sheet = headerAndRows(name, cells);
    if (sheet.ok) sheets.push(sheet.value);
  }
  if (sheets.length === 0)
    return err(DomainError.validation('The workbook holds no sheet with rows'));
  return ok(sheets);
}

/** A cell as the table reads it: a date as the day it shows, or with its time when it has one. */
function cellOf(value: unknown): SheetCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string')
    return value;
  return String(value);
}
