import type { Exercise, ExerciseSessionEntry, ExerciseStats, Workout, WorkoutStats } from "@motionmeet/shared";
import { database, type DatabaseTransaction } from "../configs/database.js";
import { numberValue, toIsoString } from "../repositories/entities.js";
import { calculateCurrentStreak } from "../utils/workoutMetrics.js";

const exerciseIdOf = (value: string | Exercise): string => typeof value === "string" ? value : value.id;
const dateKey = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);

export const applyWorkoutAnalytics = async (workout: Workout, { transaction }: { transaction: DatabaseTransaction }): Promise<void> => {
  const day = dateKey(workout.startTime);
  const date = new Date(`${day}T00:00:00.000Z`);
  const daily = await transaction.insertInto("user_daily_workout_stats").values({
    legacy_mongo_id: null, user_id: workout.userId, date_key: day, date,
    total_workouts: 1, total_duration_minutes: workout.durationMinutes,
    total_volume_kg: workout.volumeKg, total_sets: workout.totalSets, total_reps: workout.totalReps,
  }).onConflict((conflict) => conflict.columns(["user_id", "date_key"]).doUpdateSet((expression) => ({
    total_workouts: expression("user_daily_workout_stats.total_workouts", "+", 1),
    total_duration_minutes: expression("user_daily_workout_stats.total_duration_minutes", "+", workout.durationMinutes),
    total_volume_kg: expression("user_daily_workout_stats.total_volume_kg", "+", workout.volumeKg),
    total_sets: expression("user_daily_workout_stats.total_sets", "+", workout.totalSets),
    total_reps: expression("user_daily_workout_stats.total_reps", "+", workout.totalReps),
  }))).returning("id").executeTakeFirstOrThrow();

  const muscleSets = new Map<string, number>();
  for (const exercise of workout.exercises) {
    if (!exercise.exerciseId) continue;
    const completedSets = exercise.sets.filter((set) => set.completed !== false);
    if (!completedSets.length) continue;
    const totalVolume = completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
    const totalReps = completedSets.reduce((sum, set) => sum + set.reps, 0);
    const maxWeight = Math.max(...completedSets.map((set) => set.weight));
    muscleSets.set(exercise.muscleGroup, (muscleSets.get(exercise.muscleGroup) ?? 0) + completedSets.length);
    const exerciseId = exerciseIdOf(exercise.exerciseId);
    await transaction.insertInto("user_exercise_daily_stats").values({
      legacy_mongo_id: null, user_id: workout.userId, date_key: day, date, exercise_id: exerciseId,
      exercise_name: exercise.exerciseName, muscle_group: exercise.muscleGroup,
      total_volume_kg: totalVolume, total_reps: totalReps, total_sets: completedSets.length,
      total_sessions: 1, max_weight: maxWeight,
    }).onConflict((conflict) => conflict.columns(["user_id", "date_key", "exercise_id"]).doUpdateSet((expression) => ({
      exercise_name: exercise.exerciseName, muscle_group: exercise.muscleGroup,
      total_volume_kg: expression("user_exercise_daily_stats.total_volume_kg", "+", totalVolume),
      total_reps: expression("user_exercise_daily_stats.total_reps", "+", totalReps),
      total_sets: expression("user_exercise_daily_stats.total_sets", "+", completedSets.length),
      total_sessions: expression("user_exercise_daily_stats.total_sessions", "+", 1),
      max_weight: expression.fn<number>("greatest", [expression.ref("user_exercise_daily_stats.max_weight"), expression.val(maxWeight)]),
    }))).execute();
    const best = [...completedSets].sort((left, right) => right.weight - left.weight || right.reps - left.reps)[0];
    if (best) {
      await transaction.insertInto("personal_records").values({
        legacy_mongo_id: null, user_id: workout.userId, exercise_id: exerciseId,
        exercise_name: exercise.exerciseName, value: best.weight, reps: best.reps,
        recorded_at: new Date(workout.startTime), workout_id: workout.id,
      }).onConflict((conflict) => conflict.columns(["user_id", "exercise_id"]).doUpdateSet((expression) => ({
        exercise_name: exercise.exerciseName,
        value: expression.fn<number>("greatest", [expression.ref("personal_records.value"), expression.val(best.weight)]),
        reps: expression.case().when("personal_records.value", "<", best.weight).then(best.reps).else(expression.ref("personal_records.reps")).end(),
        recorded_at: expression.case().when("personal_records.value", "<", best.weight).then(new Date(workout.startTime)).else(expression.ref("personal_records.recorded_at")).end(),
        workout_id: expression.case().when("personal_records.value", "<", best.weight).then(workout.id).else(expression.ref("personal_records.workout_id")).end(),
      }))).execute();
    }
  }
  for (const [muscle, setCount] of muscleSets) {
    await transaction.insertInto("user_daily_muscle_stats").values({ daily_stat_id: daily.id, muscle, set_count: setCount })
      .onConflict((conflict) => conflict.columns(["daily_stat_id", "muscle"]).doUpdateSet((expression) => ({ set_count: expression("user_daily_muscle_stats.set_count", "+", setCount) }))).execute();
  }
};

const statsCutoff = (period: string, now: Date): Date => {
  if (period === "calendar_month") return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = new Date(now);
  result.setUTCDate(result.getUTCDate() - (period === "week" ? 7 : period === "month" ? 30 : 365) + 1);
  result.setUTCHours(0, 0, 0, 0);
  return result;
};

export const getComputedWorkoutStats = async (userId: string, period: string): Promise<WorkoutStats> => {
  const now = new Date();
  const cutoff = statsCutoff(period, now);
  const rows = await database.selectFrom("user_daily_workout_stats").selectAll().where("user_id", "=", userId)
    .where("date", ">=", cutoff).where("date", "<=", now).orderBy("date").limit(366).execute();
  const dailyIds = rows.map((row) => row.id);
  const exerciseRows = await database.selectFrom("user_exercise_daily_stats").selectAll().where("user_id", "=", userId)
    .where("date", ">=", cutoff).where("date", "<=", now).execute();
  const muscleRows = dailyIds.length ? await database.selectFrom("user_daily_muscle_stats").selectAll().where("daily_stat_id", "in", dailyIds).execute() : [];
  const activeMuscles = await database.selectFrom("muscle_groups").select("code").where("is_active", "=", true).execute();
  const grouped = new Map<string, { label: string; volume: number; duration: number; reps: number; sets: number; workouts: number }>();
  for (const row of rows) {
    const date = new Date(row.date);
    const key = period === "year" ? row.date_key.slice(0, 7) : row.date_key;
    const current = grouped.get(key) ?? { label: period === "year" ? date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }) : date.toLocaleDateString("en-US", { month: period.includes("month") ? "short" : undefined, day: period.includes("month") ? "numeric" : undefined, weekday: period.includes("month") ? undefined : "short", timeZone: "UTC" }), volume: 0, duration: 0, reps: 0, sets: 0, workouts: 0 };
    current.volume += numberValue(row.total_volume_kg); current.duration += row.total_duration_minutes;
    current.reps += numberValue(row.total_reps); current.sets += row.total_sets; current.workouts += row.total_workouts;
    grouped.set(key, current);
  }
  const muscleCounts = new Map(activeMuscles.map((row) => [row.code, 0]));
  for (const row of muscleRows) muscleCounts.set(row.muscle, (muscleCounts.get(row.muscle) ?? 0) + row.set_count);
  const muscleTotal = [...muscleCounts.values()].reduce((sum, count) => sum + count, 0);
  const breakdown = new Map<string, { volume: number; reps: number; sets: number }>();
  for (const row of exerciseRows) {
    const current = breakdown.get(row.exercise_name) ?? { volume: 0, reps: 0, sets: 0 };
    current.volume += numberValue(row.total_volume_kg); current.reps += numberValue(row.total_reps); current.sets += row.total_sets;
    breakdown.set(row.exercise_name, current);
  }
  const values = [...grouped.entries()];
  const dateKeys = await database.selectFrom("user_daily_workout_stats").select("date_key").where("user_id", "=", userId).where("date", "<=", now).orderBy("date", "desc").limit(370).execute();
  return {
    stats: { labels: values.map(([, value]) => value.label), dates: values.map(([key]) => key), volumes: values.map(([, value]) => Math.round(value.volume)), durations: values.map(([, value]) => value.duration), reps: values.map(([, value]) => value.reps), sets: values.map(([, value]) => value.sets), workouts: values.map(([, value]) => value.workouts) },
    exerciseBreakdown: [...breakdown.entries()].sort((left, right) => right[1].volume - left[1].volume).slice(0, 5).map(([name, value]) => ({ name, ...value, total: Math.round(value.volume) })),
    muscleDistribution: Object.fromEntries([...muscleCounts].map(([muscle, count]) => [muscle, muscleTotal ? Number((count / muscleTotal).toFixed(3)) : 0])),
    totalVolume: Math.round(rows.reduce((sum, row) => sum + numberValue(row.total_volume_kg), 0)),
    totalDuration: rows.reduce((sum, row) => sum + row.total_duration_minutes, 0),
    totalWorkouts: rows.reduce((sum, row) => sum + row.total_workouts, 0),
    totalSets: rows.reduce((sum, row) => sum + row.total_sets, 0),
    workoutDates: rows.map((row) => row.date_key), currentStreakDays: calculateCurrentStreak(dateKeys.map((row) => row.date_key), now),
  };
};

export const getComputedExerciseStats = async (exerciseId: string, userId: string): Promise<ExerciseStats> => {
  const [record, history, sessions] = await Promise.all([
    database.selectFrom("personal_records").select("value").where("user_id", "=", userId).where("exercise_id", "=", exerciseId).executeTakeFirst(),
    database.selectFrom("user_exercise_daily_stats").select(["date", "max_weight", "total_volume_kg"]).where("user_id", "=", userId).where("exercise_id", "=", exerciseId).orderBy("date", "asc").limit(365).execute(),
    database.selectFrom("user_exercise_daily_stats").select((expression) => expression.fn.sum<number>("total_sessions").as("count")).where("user_id", "=", userId).where("exercise_id", "=", exerciseId).executeTakeFirst(),
  ]);
  return { personalRecord: numberValue(record?.value), totalSessions: numberValue(sessions?.count), history: history.map((row) => ({ date: toIsoString(row.date) ?? new Date(0).toISOString(), maxWeight: numberValue(row.max_weight), volume: numberValue(row.total_volume_kg) })) };
};

/**
 * Past performances of one exercise, newest first. The daily aggregate tables
 * only keep totals, so the individual sets are read from the workout rows.
 * Feeds both the exercise history tab and the "previous" column shown while a
 * workout is being logged.
 */
export const getComputedExerciseSessions = async (
  exerciseId: string,
  userId: string,
  requestedLimit: unknown = 20,
): Promise<ExerciseSessionEntry[]> => {
  const limit = Math.min(Math.max(Number(requestedLimit) || 20, 1), 50);
  const sessions = await database
    .selectFrom("workout_exercises")
    .innerJoin("workouts", "workouts.id", "workout_exercises.workout_id")
    .select([
      "workout_exercises.id as workout_exercise_id",
      "workouts.id as workout_id",
      "workouts.name as workout_name",
      "workouts.start_time as start_time",
    ])
    .where("workouts.user_id", "=", userId)
    .where("workout_exercises.exercise_id", "=", exerciseId)
    .orderBy("workouts.start_time", "desc")
    .limit(limit)
    .execute();

  if (sessions.length === 0) return [];

  const sets = await database
    .selectFrom("workout_sets")
    .select(["workout_exercise_id", "position", "weight", "reps", "set_type", "completed"])
    .where("workout_exercise_id", "in", sessions.map((session) => session.workout_exercise_id))
    .orderBy("position", "asc")
    .execute();

  const setsByExercise = new Map<string, ExerciseSessionEntry["sets"]>();
  for (const set of sets) {
    const bucket = setsByExercise.get(set.workout_exercise_id) ?? [];
    bucket.push({
      position: set.position,
      weight: numberValue(set.weight),
      reps: set.reps,
      setType: set.set_type,
      completed: set.completed,
    });
    setsByExercise.set(set.workout_exercise_id, bucket);
  }

  return sessions.map((session) => ({
    workoutId: session.workout_id,
    workoutName: session.workout_name,
    performedAt: toIsoString(session.start_time) ?? new Date(0).toISOString(),
    sets: setsByExercise.get(session.workout_exercise_id) ?? [],
  }));
};

export const getComputedPersonalRecords = async (userId: string, requestedLimit: unknown = 50): Promise<Array<{ exerciseId: string; name: string; value: number; reps: number; recordedAt: string }>> => {
  const limit = Math.min(Math.max(Number(requestedLimit) || 50, 1), 100);
  const rows = await database.selectFrom("personal_records").selectAll().where("user_id", "=", userId).orderBy("value", "desc").orderBy("recorded_at", "desc").limit(limit).execute();
  return rows.map((row) => ({ exerciseId: row.exercise_id, name: row.exercise_name, value: numberValue(row.value), reps: row.reps, recordedAt: toIsoString(row.recorded_at) ?? new Date(0).toISOString() }));
};
