/**
 * The closed list of types a notebook keeps, and the one thing that makes the
 * type mean anything: the bytes (#166, RN-KNW-050).
 *
 * The extension decides nothing here, on purpose, so every case below names a
 * type and hands it bytes — and the cases that matter most are the ones where
 * the name would have said something else.
 */

import { describe, expect, it } from 'vitest';
import { bytesSupport, FILE_MIME_TYPES, fileTypeOf, rendersAs } from '../src/files.js';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
const PDF = text('%PDF-1.7\n%âãÏÓ');
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0);
const riff = (form: string): Uint8Array =>
  new Uint8Array([...text('RIFF'), 0, 0, 0, 0, ...text(form)]);
const iso = (brand: string): Uint8Array =>
  new Uint8Array([0, 0, 0, 0x18, ...text('ftyp'), ...text(brand), 0, 0, 0, 0]);

describe('the list of types is closed', () => {
  it('holds the sixteen and nothing else', () => {
    expect(FILE_MIME_TYPES).toHaveLength(16);
    expect(fileTypeOf('application/x-msdownload')).toBeNull();
    expect(fileTypeOf('text/html')).toBeNull();
    expect(bytesSupport('text/html', text('<!doctype html>'))).toBe(false);
  });

  it('says how each one is drawn, and draws what it cannot draw as a card', () => {
    expect(rendersAs('image/png')).toBe('image');
    expect(rendersAs('image/svg+xml')).toBe('image');
    expect(rendersAs('audio/mpeg')).toBe('audio');
    expect(rendersAs('video/mp4')).toBe('video');
    expect(rendersAs('application/pdf')).toBe('card');
    expect(rendersAs('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'card',
    );
    expect(rendersAs('image/tiff')).toBe('card');
  });

  it('matches a type to the name an agent would usually write, without asking for it', () => {
    expect(fileTypeOf('image/jpeg')?.extensions).toEqual(['.jpg', '.jpeg']);
    expect(fileTypeOf('IMAGE/PNG')?.mimeType).toBe('image/png');
  });
});

describe('the bytes have to support the type that was declared', () => {
  it('accepts each format under its own signature', () => {
    expect(bytesSupport('image/png', PNG)).toBe(true);
    expect(bytesSupport('image/jpeg', JPEG)).toBe(true);
    expect(bytesSupport('application/pdf', PDF)).toBe(true);
    expect(bytesSupport('image/gif', text('GIF89a...'))).toBe(true);
    expect(bytesSupport('audio/ogg', text('OggS'))).toBe(true);
    expect(bytesSupport('audio/mpeg', text('ID3'))).toBe(true);
    expect(bytesSupport('audio/webm', bytes(0x1a, 0x45, 0xdf, 0xa3, 0))).toBe(true);
    expect(
      bytesSupport('application/vnd.openxmlformats-officedocument.wordprocessingml.document', ZIP),
    ).toBe(true);
  });

  it('refuses a document arriving under the type of a picture', () => {
    // The whole reason the check exists: HTML kept as an image is a page
    // waiting for something to serve it as one.
    expect(bytesSupport('image/png', text('<!doctype html><script>alert(1)</script>'))).toBe(false);
    expect(bytesSupport('image/jpeg', PDF)).toBe(false);
    expect(bytesSupport('application/pdf', PNG)).toBe(false);
    expect(bytesSupport('image/png', new Uint8Array())).toBe(false);
  });

  it('tells apart the two formats that share the RIFF header', () => {
    expect(bytesSupport('image/webp', riff('WEBP'))).toBe(true);
    expect(bytesSupport('audio/wav', riff('WAVE'))).toBe(true);
    expect(bytesSupport('image/webp', riff('WAVE'))).toBe(false);
    expect(bytesSupport('audio/wav', riff('WEBP'))).toBe(false);
  });

  it('tells an MP4 from a QuickTime by the brand, which is where it is written', () => {
    expect(bytesSupport('video/mp4', iso('isom'))).toBe(true);
    expect(bytesSupport('video/quicktime', iso('qt  '))).toBe(true);
    expect(bytesSupport('video/mp4', iso('qt  '))).toBe(false);
    expect(bytesSupport('video/quicktime', iso('isom'))).toBe(false);
    expect(bytesSupport('video/mp4', PNG)).toBe(false);
  });

  it('reads an SVG as the text it is, past a BOM and past the whitespace', () => {
    expect(bytesSupport('image/svg+xml', text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe(
      true,
    );
    expect(bytesSupport('image/svg+xml', text('﻿  \n<?xml version="1.0"?><svg/>'))).toBe(true);
    expect(bytesSupport('image/svg+xml', text('not a drawing'))).toBe(false);
    expect(bytesSupport('image/svg+xml', PNG)).toBe(false);
  });
});
