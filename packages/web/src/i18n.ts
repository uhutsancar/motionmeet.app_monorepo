import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'tr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'appLanguage';

const readSavedLanguage = (): SupportedLanguage => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(saved || '')
    ? (saved as SupportedLanguage)
    : 'en';
};

// English is bundled because it is the fallback every missing key resolves
// against. Every other language is fetched only when it is actually selected,
// so a member never downloads a catalogue they will not read.
i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: enTranslation } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

const loaded = new Set<string>(['en']);

const loadCatalogue = async (language: SupportedLanguage): Promise<void> => {
  if (loaded.has(language)) return;
  // Explicit cases rather than a template literal: the bundler needs a literal
  // path to emit a chunk for each catalogue.
  const catalogue = language === 'tr'
    ? (await import('./locales/tr/translation.json')).default
    : null;
  if (!catalogue) return;
  i18n.addResourceBundle(language, 'translation', catalogue, true, true);
  loaded.add(language);
};

/** Switches language, fetching its catalogue first so nothing renders in English mid-flight. */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  await loadCatalogue(language);
  localStorage.setItem(STORAGE_KEY, language);
  await i18n.changeLanguage(language);
};

/**
 * Resolves once the saved language is ready. `main.tsx` awaits it so the first
 * paint is already in the right language rather than flashing English.
 */
export const initI18n = async (): Promise<void> => {
  const saved = readSavedLanguage();
  if (saved === 'en') return;
  await changeLanguage(saved);
};

export default i18n;
