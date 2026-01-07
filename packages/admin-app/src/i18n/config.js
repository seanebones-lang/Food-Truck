import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import es from './locales/es.json';
import ar from './locales/ar.json';

// RTL languages
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Helper to check if current language is RTL
export const isRTL = () => {
  const currentLang = i18n.language.split('-')[0];
  return RTL_LANGUAGES.includes(currentLang);
};

// Helper to get text direction
export const getTextDirection = () => {
  return isRTL() ? 'rtl' : 'ltr';
};

export default i18n;
