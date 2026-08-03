/**
 * Centralized dayjs configuration.
 * Import `dayjs` from this file instead of directly from 'dayjs'
 * so that locale and plugins are always loaded.
 *
 * Usage:
 *   import dayjs from '../utils/dayjs';
 *   dayjs('2024-01-01').fromNow()        // relative time
 *   dayjs('2024-01-01').format('D MMM YYYY, HH:mm')
 *   dayjs.setLocale('tr')                // switch locale at runtime
 */
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// Default to the device locale; call dayjs.locale('tr') or dayjs.locale('en')
// from i18n setup to switch at runtime.
dayjs.locale('en');

export default dayjs;

/** Call this whenever i18n language changes. */
export const setDayjsLocale = (language: string): void => {
  dayjs.locale(language.startsWith('tr') ? 'tr' : 'en');
};
