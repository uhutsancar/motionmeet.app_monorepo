import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import en from './locales/en/translation.json';
import tr from './locales/tr/translation.json';

const LANGUAGE_KEY = 'settings.lang';

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const savedDataJSON = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedDataJSON) {
        callback(savedDataJSON);
        return;
      }
    } catch (error) {
      console.log('Error reading language', error);
    }
    const bestLng = Localization.getLocales()[0].languageCode;
    callback(bestLng === 'tr' ? 'tr' : 'en');
  },
  init: () => {},
  cacheUserLanguage: async (lng) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch (error) {
      console.log('Error saving language', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    interpolation: {
      escapeValue: false, 
    },
  });

export default i18n;
