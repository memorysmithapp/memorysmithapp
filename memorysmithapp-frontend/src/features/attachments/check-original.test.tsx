/**
 * What the check against the original shows (#466, RN-KNW-090, RN-KNW-091):
 * the differences side by side, and the question only to whoever may write,
 * in both locales.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CheckReport } from './original';

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

/** The photo of #461: reduced from 2400×1800 and given an sRGB profile. */
const reduced: CheckReport = {
  identical: false,
  keptUnread: false,
  kept: {
    bytes: 1960955,
    sha256: '117e6e36'.padEnd(64, '0'),
    type: 'image/jpeg',
    image: { width: 2048, height: 1536, color: 'rgb', alpha: false, icc: true, exif: false },
  },
  local: {
    bytes: 3098360,
    sha256: 'bc7a1655'.padEnd(64, '0'),
    type: 'image/jpeg',
    image: { width: 2400, height: 1800, color: 'rgb', alpha: false, icc: false, exif: false },
  },
  pixels: {
    kind: 'compared',
    samples: 3145728,
    identicalShare: 0.0198,
    meanDifference: 15.9,
    peakDifference: 117,
  },
};

let render: (locale: string, report: CheckReport, writable: boolean) => Promise<string>;

beforeAll(async () => {
  const i18n = (await import('../../i18n')).default;
  const { CheckReportView } = await import('./CheckOriginal');
  render = async (locale, report, writable) => {
    await i18n.changeLanguage(locale);
    return renderToStaticMarkup(
      <CheckReportView name="anexo-foto.jpg" report={report} writable={writable} />,
    );
  };
});

describe('the report of a check', () => {
  it('shows both sizes, both dimensions, the profile and how much of the picture changed', async () => {
    const html = await render('en_US', reduced, true);

    expect(html).toContain('The kept file is not your file');
    expect(html).toContain('2048 × 1536 pixels');
    expect(html).toContain('2400 × 1800 pixels');
    expect(html).toContain('Color profile (ICC)');
    expect(html).toContain('1.98%');
    expect(html).toContain('15.9');
    expect(html).toContain('117');
    expect(html).toContain('Keep the file from your computer in place of the kept one?');
    expect(html).toContain('“anexo-foto.jpg”');
  });

  it('asks the question in pt_BR too, and only to whoever may write', async () => {
    const writer = await render('pt_BR', reduced, true);
    expect(writer).toContain('O arquivo guardado não é o seu arquivo');
    expect(writer).toContain('Guardar o arquivo do seu computador no lugar do guardado?');

    const reader = await render('pt_BR', reduced, false);
    expect(reader).not.toContain('Guardar o arquivo do seu computador');
    expect(reader).toContain('Só quem pode escrever neste caderno');
  });

  it('says identical, with the hash, when the two are the same file', async () => {
    const html = await render(
      'en_US',
      { identical: true, bytes: 3098360, sha256: 'bc7a1655'.padEnd(64, '0') },
      true,
    );
    expect(html).toContain('This is the original');
    expect(html).toContain('bc7a1655'.padEnd(64, '0'));
    expect(html).not.toContain('Keep the file from your computer');
  });

  it('says why the pixels were not compared above the ceiling', async () => {
    const html = await render(
      'en_US',
      { ...reduced, pixels: { kind: 'over-ceiling', ceiling: 40_000_000 } },
      true,
    );
    expect(html).toContain('more than 40 megapixels');
  });
});
