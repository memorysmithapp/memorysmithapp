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
  /**
   * Whether the sidebar of the shell is folded to its icons (#414): the
   * reading takes the width, and the choice is the person's, so the browser
   * remembers it as it remembers the theme.
   */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      paper: false,
      setPaper: (paper) => set({ paper }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: 'memorysmith.preferences',
      partialize: ({ theme, sidebarCollapsed }) => ({ theme, sidebarCollapsed }),
    },
  ),
);

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  // Read through the global, so a page drawn without a window — a note
  // rendered to markup — is light rather than an error.
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme the page is drawn in: the choice of the person, unless it is paper. */
export function effectiveTheme(choice: ThemeChoice, paper: boolean): 'light' | 'dark' {
  return paper ? 'light' : resolveTheme(choice);
}
