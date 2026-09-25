import { useEffect, useState } from 'react';

/** Whether a media query matches this window, followed as it changes. */
export function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? false
      : window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const follow = () => setMatches(media.matches);
    follow();
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [query]);
  return matches;
}

/**
 * Below this width a notebook has no sidebar: its navigation is the sheet at
 * the foot of the screen (#229). Every phone, and a tablet in portrait.
 */
export const NARROW_NOTEBOOK = '(max-width: 860px)';
