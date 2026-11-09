import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The place in the middle of the header where a page puts its search (#414).
 *
 * Search belongs to a notebook: what it asks is the notebook's own index, and
 * the tree the page already holds is what turns a hit into a link. So the page
 * that has a notebook draws the box, and the shell only lends it the middle of
 * the header. A page without a notebook has no search, and the middle stays
 * empty rather than offering a field that could only answer nothing.
 */
const SlotContext = createContext<HTMLElement | null>(null);

export const HeaderSearchSlotProvider = SlotContext.Provider;

/** Draws its children in the middle of the header, when the shell has one. */
export function HeaderSearch({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}
