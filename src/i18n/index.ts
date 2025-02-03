import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import en from './locales/en.json';
import ar from './locales/ar.json';
import nl from './locales/nl.json';
import de from './locales/de.json';

const resources = {
  en: {
    translation: en
  },
  ar: {
    translation: ar
  },
  nl: {
    translation: nl
  },
  de: {
    translation: de
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    supportedLngs: ['en', 'ar', 'nl', 'de']
  });

export default i18n;