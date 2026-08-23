/**
 * Centralized dayjs configuration - the web counterpart of
 * `packages/mobile/src/utils/dayjs.ts`, so both clients format a timestamp the
 * same way from the same library.
 *
 * This replaced `moment`, which the web app used for four things: `fromNow`,
 * a handful of `format` calls, ISO week boundaries on the profile chart, and a
 * locale switch. Moment is a 60 KB chunk that the feed pulled in through
 * PostCard, so it was on the critical path of the first screen after login;
 * dayjs plus these three plugins is a small fraction of that, and the library
 * is already a mobile dependency.
 *
 * Import from here rather than from 'dayjs' directly, so the plugins and locales
 * are always loaded.
 */
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import isoWeek from "dayjs/plugin/isoWeek";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/tr";
import "dayjs/locale/en";

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
// Both used by the profile's six-week activity chart, which buckets workouts
// into ISO weeks.
dayjs.extend(isoWeek);
dayjs.extend(isBetween);

dayjs.locale("en");

export default dayjs;

/** Call this whenever the i18n language changes. */
export const setDayjsLocale = (language: string): void => {
  dayjs.locale(language.startsWith("tr") ? "tr" : "en");
};
