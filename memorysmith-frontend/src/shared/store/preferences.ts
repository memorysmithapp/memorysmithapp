import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface PreferencesState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
  /**
   * Whether the page open is drawn for paper (#258). Paper is white whatever
   * the reader chose, so while it is on the light theme is in force — and it
   * is never remembered: it belongs to the page, not to the person.
   */
  paper: boolean;
  setPaper: (paper: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      paper: false,
      setPaper: (paper) => set({ paper }),
    }),
    { name: 'memorysmith.preferences', partialize: ({ theme }) => ({ theme }) },
  ),
);

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme the page is drawn in: the choice of the person, unless it is paper. */
export function effectiveTheme(choice: ThemeChoice, paper: boolean): 'light' | 'dark' {
  return paper ? 'light' : resolveTheme(choice);
}
