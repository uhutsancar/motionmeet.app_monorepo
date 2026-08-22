import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';

export const SUPPORTED_LANGUAGES = ['en', 'tr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = 'appLanguage';

const isSupported = (value: string | null | undefined): value is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(value || '');

/**
 * The language to open in when nobody has chosen one yet.
 *
 * Read from the browser's own preference list, which is the setting the member
 * already made once for every site they use. It is checked most-preferred
 * first, and each entry is matched on its base tag so `tr-TR` and `tr` both
 * land on Turkish. Nothing is asked on the sign-in screen for this: the picker
 * lives in Settings, and putting a second one in front of the form would make
 * choosing a language a step of signing in.
 */
const detectBrowserLanguage = (): SupportedLanguage => {
  const preferences = typeof navigator === 'undefined'
    ? []
    : [...(navigator.languages ?? []), navigator.language];
  for (const preference of preferences) {
    const base = String(preference || '').toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'en';
};

const readSavedLanguage = (): SupportedLanguage => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isSupported(saved)) return saved;
  } catch {
    // Storage can be blocked outright; detection still works without it.
  }
  return detectBrowserLanguage();
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

/** Applies a language, fetching its catalogue first so nothing renders in English mid-flight. */
const applyLanguage = async (language: SupportedLanguage): Promise<void> => {
  await loadCatalogue(language);
  await i18n.changeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = language;
};

/** Switches language because the member asked, and remembers that they did. */
export const changeLanguage = async (language: SupportedLanguage): Promise<void> => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // An explicit choice that cannot be stored still applies to this session.
  }
  await applyLanguage(language);
};

/**
 * Resolves once the opening language is ready. `main.tsx` awaits it so the first
 * paint is already in the right language rather than flashing English.
 *
 * A detected language is applied but deliberately not stored: only choosing one
 * in Settings is a decision, so someone whose browser preference changes is not
 * held to a guess this app made for them once.
 */
export const initI18n = async (): Promise<void> => {
  const language = readSavedLanguage();
  if (language === 'en') {
    if (typeof document !== 'undefined') document.documentElement.lang = 'en';
    return;
  }
  await applyLanguage(language);
};

export default i18n;
