import { useTranslation } from 'react-i18next';
import { usePreferences, resolveTheme } from '../store/preferences';
import { MoonIcon, SunIcon } from './icons';

/**
 * Light or dark in one press, from the header (#414). It flips what the page
 * shows now, so from "system" it chooses the opposite of what the system
 * gives; going back to "system" stays in the user menu, beside the language.
 */
export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const shown = resolveTheme(theme);
  const next = shown === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={t(next === 'dark' ? 'theme.toDark' : 'theme.toLight')}
      title={t(next === 'dark' ? 'theme.toDark' : 'theme.toLight')}
      onClick={() => setTheme(next)}
    >
      {shown === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
