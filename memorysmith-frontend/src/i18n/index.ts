import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en_US from './locales/en_US.json';
import pt_BR from './locales/pt_BR.json';

export const SUPPORTED_LOCALES = ['en_US', 'pt_BR'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const stored = localStorage.getItem('memorysmith.locale');
const initial: Locale = stored === 'pt_BR' || stored === 'en_US' ? stored : 'pt_BR';

void i18n.use(initReactI18next).init({
  resources: {
    en_US: { translation: en_US },
    pt_BR: { translation: pt_BR },
  },
  lng: initial,
  fallbackLng: 'en_US',
  interpolation: { escapeValue: false },
});

/**
 * The locale of the interface as a BCP 47 tag, which is what `Intl` takes.
 *
 * They are not the same string. The interface names its locales `en_US` and
 * `pt_BR`, with an underscore, because that is how the resources are keyed —
 * and `new Intl.DateTimeFormat('en_US')` does not fail softly: it throws
 * `RangeError: Invalid language tag`, which took the whole screen down the
 * first time a date was formatted in a transfer (#161). Two screens had each
 * written the conversion out by hand; this is the third, and the last.
 */
export function intlLocale(language: string): string {
  return language === 'pt_BR' ? 'pt-BR' : 'en-US';
}

export function setLocale(locale: Locale): void {
  localStorage.setItem('memorysmith.locale', locale);
  void i18n.changeLanguage(locale);
}

export default i18n;
