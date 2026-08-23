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

export function setLocale(locale: Locale): void {
  localStorage.setItem('memorysmith.locale', locale);
  void i18n.changeLanguage(locale);
}

export default i18n;
