import type { WorkoutStats } from '@motionmeet/shared';

export const WEEKS_SHOWN = 12;

export interface WeekBucket {
  /** Monday of the week (UTC), `YYYY-MM-DD`, the same key the server groups by. */
  key: string;
  workouts: number;
  duration: number;
  volume: number;
  sets: number;
}

const mondayKey = (date: Date): string => {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
};

/**
 * The last twelve weeks, oldest first, every week present.
 *
 * The server returns only weeks that had training; a gap is a real week with
 * nothing in it and is drawn as one, so three quiet weeks look like three
 * quiet weeks instead of disappearing from the axis.
 */
export const toWeekBuckets = (stats: WorkoutStats['stats'] | undefined, now = new Date()): WeekBucket[] => {
  const byKey = new Map<string, WeekBucket>();
  stats?.dates.forEach((key, index) => {
    byKey.set(key, {
      key,
      workouts: stats.workouts[index] ?? 0,
      duration: stats.durations[index] ?? 0,
      volume: stats.volumes[index] ?? 0,
      sets: stats.sets[index] ?? 0,
    });
  });
  const current = new Date(`${mondayKey(now)}T00:00:00.000Z`);
  const weeks: WeekBucket[] = [];
  for (let offset = WEEKS_SHOWN - 1; offset >= 0; offset -= 1) {
    const monday = new Date(current);
    monday.setUTCDate(monday.getUTCDate() - offset * 7);
    const key = monday.toISOString().slice(0, 10);
    weeks.push(byKey.get(key) ?? { key, workouts: 0, duration: 0, volume: 0, sets: 0 });
  }
  return weeks;
};
