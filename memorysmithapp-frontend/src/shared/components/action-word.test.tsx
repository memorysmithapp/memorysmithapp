/**
 * An action button that carries an icon (#325): the icon and its word on a
 * computer, the icon alone from 860 px down with the word as its accessible
 * name; and the confirmations and cancels of a dialog or an in-place question,
 * which keep their word on every width.
 */

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActionWord } from './ActionWord';
import { DownloadIcon } from './icons';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('an action button that carries an icon', () => {
  it('draws the icon unheard and the word as text, never as an aria-label', () => {
    const html = renderToStaticMarkup(
      <button type="button" className="button is-quiet">
        <ActionWord icon={<DownloadIcon />} word="Download" />
      </button>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<span class="action-word">Download</span>');
    expect(html).not.toContain('aria-label');
  });

  it('hides the word, never removes it, from 860 px down, on a 44 px target', () => {
    const css = read('../../styles.css');
    const phone = css.slice(css.indexOf('.button:has(> .action-word:not(.is-kept))') - 40);
    expect(phone).toMatch(/^[\s\S]*@media \(max-width: 860px\)/);
    expect(phone).toMatch(
      /\.button:has\(> \.action-word:not\(\.is-kept\)\) \{\s*min-width: 44px;\s*min-height: 44px;/,
    );
    expect(phone).toMatch(
      /\.action-word:not\(\.is-kept\) \{\s*position: absolute;[\s\S]*?clip-path: inset\(50%\);/,
    );
    expect(phone).not.toMatch(/\.action-word[^{]*\{[^}]*display: none/);
  });

  it('keeps the word of a button that spans the width of a phone, which is not short of room', () => {
    const html = renderToStaticMarkup(
      <button type="button" className="button is-primary is-wide">
        <ActionWord icon={<DownloadIcon />} word="Sign in" wide />
      </button>,
    );
    expect(html).toContain('<span class="action-word is-kept">Sign in</span>');
    for (const path of [
      '../../features/portability/StartTransfer.tsx',
      '../../features/profile/ProfilePage.tsx',
      '../../features/auth/LoginPage.tsx',
    ]) {
      expect(read(path)).toMatch(/\bwide\b/);
    }
  });

  it('is the one the bar uses too', () => {
    expect(read('../../features/structure/NotebookBreadcrumb.tsx')).toContain('<ActionWord');
    expect(read('../../styles.css')).not.toContain('.bar-button-label');
  });

  it('is not taken by a confirmation or a cancel, which keeps its word', () => {
    for (const path of [
      './DeleteContentSlot.tsx',
      './Menu.tsx',
      './Sheet.tsx',
      '../../features/dashboard/NotebookActions.tsx',
      '../../features/note/MoveNote.tsx',
      '../../features/structure/EditFolder.tsx',
      '../../features/portability/ExportChoice.tsx',
      '../../features/sharing/ShareDialog.tsx',
      '../../features/sharing/SharedNotebookCards.tsx',
    ]) {
      expect(read(path), path).not.toContain('ActionWord');
    }
  });
});
