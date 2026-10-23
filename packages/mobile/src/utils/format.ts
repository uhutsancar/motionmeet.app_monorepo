/**
 * Numbers and units the way the reader's language writes them.
 *
 * Screens used to print raw `toLocaleString()` in one place, "2216" in the
 * next and an English "min" or "reps" beside Turkish labels. Every figure on
 * a statistics screen goes through here so "2.216 dk" and "12,5 kg" look the
 * same wherever they appear.
 */

const localeOf = (language: string): string => (language.startsWith('tr') ? 'tr-TR' : 'en-US');
const isTurkish = (language: string): boolean => language.startsWith('tr');

export const formatNumber = (value: number, language: string, maxDecimals = 0): string =>
  (Number.isFinite(value) ? value : 0).toLocaleString(localeOf(language), {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  });

/** Weights keep one decimal only when there is one: 62,5 and 60, never 60,0. */
export const formatWeight = (kg: number, language: string): string => formatNumber(kg, language, 2);

/**
 * Short form for axis ticks: 950, 2,5 bin / 2.5k, 1,2 Mn / 1.2M.
 * Thousands are shortened from 1 000 up, so one axis does not mix "5.000"
 * with "10 bin" when its ticks cross ten thousand.
 */
export const formatCompact = (value: number, language: string): string => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, language, 1)}${isTurkish(language) ? ' Mn' : 'M'}`;
  }
  if (absolute >= 1_000) {
    return `${formatNumber(value / 1_000, language, 1)}${isTurkish(language) ? ' bin' : 'k'}`;
  }
  return formatNumber(value, language, 1);
};

/** The exercise catalogue stores names in lower case; a title starts with a capital. */
export const capitalizeFirst = (text: string, language: string): string =>
  text ? text.charAt(0).toLocaleUpperCase(localeOf(language)) + text.slice(1) : text;

/** Minutes as a duration a person reads: 45 dk, 1 sa 5 dk / 45 min, 1 h 5 min. */
export const formatDuration = (minutes: number, language: string): string => {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const [h, m] = isTurkish(language) ? ['sa', 'dk'] : ['h', 'min'];
  if (!hours) return `${rest} ${m}`;
  return rest ? `${hours} ${h} ${rest} ${m}` : `${hours} ${h}`;
};
