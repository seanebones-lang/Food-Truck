import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './locales/en.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import fr from './locales/fr.json';

// RTL languages
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

// Detect device language
const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      en: { translation: en },
      es: { translation: es },
      ar: { translation: ar },
      fr: { translation: fr },
    },
    lng: deviceLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Avoid suspense issues in React Native
    },
  });

// Helper to check if current language is RTL
export const isRTL = (): boolean => {
  const currentLang = i18n.language.split('-')[0];
  return RTL_LANGUAGES.includes(currentLang);
};

// Helper to get text direction
export const getTextDirection = (): 'ltr' | 'rtl' => {
  return isRTL() ? 'rtl' : 'ltr';
};

export default i18n;
