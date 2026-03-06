import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import it from './locales/it.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

const STORAGE_KEY = 'bookd_preferred_language';

function getDeviceLanguage(): string {
  const locales = getLocales();
  return locales[0]?.languageCode || 'en';
}

async function getStoredLanguage(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored || getDeviceLanguage();
}

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    de: { translation: de },
    it: { translation: it },
    fr: { translation: fr },
    pt: { translation: pt },
  },
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

// Async load stored language preference
getStoredLanguage().then((lang) => {
  if (lang !== i18next.language) {
    i18next.changeLanguage(lang);
  }
});

export default i18next;
