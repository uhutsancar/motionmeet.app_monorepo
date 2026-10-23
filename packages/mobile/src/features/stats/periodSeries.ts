import type { WorkoutStats } from '@motionmeet/shared';

export type StatsPeriod = 'week' | 'month' | 'year';

export interface PeriodBucket {
  /** `YYYY-MM-DD` for days, `YYYY-MM` for the months of a year. */
  key: string;
  workouts: number;
  duration: number;
  volume: number;
  reps: number;
  sets: number;
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Every bucket of the period, oldest first, with real zeros for the days or
 * months without training: the last 7 or 30 days, or the last 12 months.
 * Uses the same UTC day and month keys the server groups by.
 */
export const toPeriodBuckets = (stats: WorkoutStats['stats'] | undefined, period: StatsPeriod, now = new Date()): PeriodBucket[] => {
  const byKey = new Map<string, Omit<PeriodBucket, 'key'>>();
  stats?.dates.forEach((key, index) => {
    byKey.set(key, {
      workouts: stats.workouts[index] ?? 0,
      duration: stats.durations[index] ?? 0,
      volume: stats.volumes[index] ?? 0,
      reps: stats.reps[index] ?? 0,
      sets: stats.sets[index] ?? 0,
    });
  });
  const empty = { workouts: 0, duration: 0, volume: 0, reps: 0, sets: 0 };
  const keys: string[] = [];
  if (period === 'year') {
    for (let back = 11; back >= 0; back -= 1) {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      keys.push(dayKey(month).slice(0, 7));
    }
  } else {
    const count = period === 'week' ? 7 : 30;
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (let back = count - 1; back >= 0; back -= 1) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - back);
      keys.push(dayKey(day));
    }
  }
  return keys.map((key) => ({ key, ...(byKey.get(key) ?? empty) }));
};
