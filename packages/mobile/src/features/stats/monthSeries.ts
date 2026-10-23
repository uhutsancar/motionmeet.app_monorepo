import type { WorkoutStats } from '@motionmeet/shared';

export type MonthMetric = 'workouts' | 'duration' | 'volume' | 'sets';

export interface DayBucket {
  /** `YYYY-MM-DD`, the server's day key. */
  key: string;
  day: number;
  workouts: number;
  duration: number;
  volume: number;
  sets: number;
}

/**
 * Every day of the current month up to today, oldest first. The server only
 * returns days that had training; the rest are real zeros and are drawn as
 * gaps on the axis instead of being skipped, so "trained on the 2nd and the
 * 20th" no longer looks like two days in a row.
 */
export const toMonthDays = (stats: WorkoutStats['stats'] | undefined, now = new Date()): DayBucket[] => {
  const byKey = new Map<string, Omit<DayBucket, 'key' | 'day'>>();
  stats?.dates.forEach((key, index) => {
    byKey.set(key, {
      workouts: stats.workouts[index] ?? 0,
      duration: stats.durations[index] ?? 0,
      volume: stats.volumes[index] ?? 0,
      sets: stats.sets[index] ?? 0,
    });
  });
  const prefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-`;
  const days: DayBucket[] = [];
  for (let day = 1; day <= now.getUTCDate(); day += 1) {
    const key = `${prefix}${String(day).padStart(2, '0')}`;
    days.push({ key, day, ...(byKey.get(key) ?? { workouts: 0, duration: 0, volume: 0, sets: 0 }) });
  }
  return days;
};
