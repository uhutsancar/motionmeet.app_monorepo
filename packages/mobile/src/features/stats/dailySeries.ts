import type { Workout } from '@motionmeet/shared';

export interface DayBucket {
  /** Local calendar day, `YYYY-MM-DD`. */
  key: string;
  workouts: number;
  /** Minutes. */
  duration: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** A date's local calendar day as `YYYY-MM-DD`: training happens in local time. */
export const localDayKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Every day of the last `weeks` weeks, Monday first, oldest first, ending with
 * the current week (days after today are left out).
 *
 * Workouts are counted on the local day they started, the way the member
 * remembers them: a session at 23:30 belongs to that evening, not to the UTC
 * day after it.
 */
export const toDayBuckets = (workouts: Workout[], weeks: number, now = new Date()): DayBucket[] => {
  const byKey = new Map<string, DayBucket>();
  workouts.forEach((workout) => {
    const started = new Date(workout.startTime || workout.createdAt || '');
    if (Number.isNaN(started.getTime())) return;
    const key = localDayKey(started);
    const bucket = byKey.get(key) ?? { key, workouts: 0, duration: 0 };
    bucket.workouts += 1;
    bucket.duration += Math.max(0, workout.durationMinutes || 0);
    byKey.set(key, bucket);
  });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(today);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (weeks - 1) * 7);

  const days: DayBucket[] = [];
  for (const day = new Date(monday); day <= today; day.setDate(day.getDate() + 1)) {
    const key = localDayKey(day);
    days.push(byKey.get(key) ?? { key, workouts: 0, duration: 0 });
  }
  return days;
};

/**
 * Consecutive weeks with at least one workout, counted back from this week.
 * A current week with nothing in it yet does not break the streak: it is not
 * over. The days start on a Monday, so every seven of them are one week.
 */
export const weekStreak = (days: DayBucket[]): number => {
  const weeks: DayBucket[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  let streak = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    const trained = weeks[index].some((day) => day.workouts > 0);
    if (trained) streak += 1;
    else if (index !== weeks.length - 1) break;
  }
  return streak;
};
