import type { ReactNode } from 'react';

/**
 * What an action button that carries an icon shows (#325): the icon and its
 * word on a wide screen, the icon alone from 860 px down, where the word stays
 * as the accessible name, hidden by CSS and never removed. The element and its
 * classes stay the caller's, so a button and a link take it alike.
 *
 * A confirmation or a cancel of a dialog or an in-place question does not take
 * it: its word stays on every width. A button that spans the width of the
 * screen on a phone takes it with `wide`, and keeps its word there too: the
 * word is hidden to save room, and that button is not short of it.
 */
export function ActionWord({
  icon,
  word,
  wide = false,
}: {
  icon: ReactNode;
  word: string;
  wide?: boolean;
}) {
  return (
    <>
      {icon}
      <span className={wide ? 'action-word is-kept' : 'action-word'}>{word}</span>
    </>
  );
}
