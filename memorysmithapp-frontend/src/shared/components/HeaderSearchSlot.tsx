import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The place among the icons of the header where a notebook puts its search
 * (#418).
 *
 * Search belongs to a notebook: what it asks is the notebook's own index, and
 * the tree the page already holds is what turns a hit into a link. So the page
 * that has a notebook draws the magnifier, and the shell only lends it a place
 * in the header. A page without a notebook has no search, and draws nothing
 * there rather than a magnifier that could only answer nothing.
 */
const SlotContext = createContext<HTMLElement | null>(null);

export const HeaderSearchSlotProvider = SlotContext.Provider;

/** Draws its children among the icons of the header, when the shell has one. */
export function HeaderSearch({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}
