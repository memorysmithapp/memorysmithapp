import type { ReactNode } from 'react';

/**
 * What an action button that carries an icon shows (#325): the icon and its
 * word on a wide screen, the icon alone from 860 px down, where the word stays
 * as the accessible name, hidden by CSS and never removed. The element and its
 * classes stay the caller's, so a button and a link take it alike.
 *
 * A confirmation or a cancel of a dialog or an in-place question does not take
 * it: its word stays on every width.
 */
export function ActionWord({ icon, word }: { icon: ReactNode; word: string }) {
  return (
    <>
      {icon}
      <span className="action-word">{word}</span>
    </>
  );
}
