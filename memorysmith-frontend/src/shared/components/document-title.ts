import { useEffect } from 'react';

const PRODUCT = 'MemorySmith';

/**
 * The title of the tab: what is open, then what holds it, then the product
 * (RN-DSC-058).
 *
 * An address carries identifiers and no name (RN-DSC-045), so this is what
 * tells two entries of the history, two tabs and two bookmarks apart. A tab,
 * the history and a bookmark read the document title rather than the URL, and
 * unlike a name in the address it cannot go stale: it is computed on render.
 */
export function documentTitleOf(...parts: Array<string | null | undefined>): string {
  const named = parts.filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return [...named, PRODUCT].join(' · ');
}

/** Sets the title of the tab for as long as the page that calls it is open. */
export function useDocumentTitle(...parts: Array<string | null | undefined>): void {
  const title = documentTitleOf(...parts);
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = PRODUCT;
    };
  }, [title]);
}
