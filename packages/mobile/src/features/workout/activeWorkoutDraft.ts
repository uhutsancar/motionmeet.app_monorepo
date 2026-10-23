import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveWorkoutExercise } from '../../types/workoutDraft';

/**
 * The workout someone is in the middle of, kept on the device so that closing
 * the screen, the OS killing the app, or a dead battery does not throw away the
 * sets already logged.
 *
 * One draft per member, keyed by their id, so signing in as someone else never
 * opens another person's session. Only what is needed to rebuild the screen is
 * stored - not the timer tick, not scroll position.
 */
export interface ActiveWorkoutDraft {
  version: 1;
  ownerId: string;
  draftId: string;
  /** Epoch ms. The timer is always `now - startedAt`, so it survives restarts. */
  startedAt: number;
  updatedAt: number;
  name: string;
  note: string;
  exercises: ActiveWorkoutExercise[];
  /**
   * Fixed the first time Finish is pressed and reused by every save attempt
   * after that, even across an app restart, so a save whose response was lost
   * cannot create the workout twice.
   */
  saveOperationId?: string;
}

const DRAFT_VERSION = 1;
const keyFor = (ownerId: string): string => `@mm_active_workout:${ownerId}`;

const isDraft = (value: unknown, ownerId: string): value is ActiveWorkoutDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ActiveWorkoutDraft>;
  return draft.version === DRAFT_VERSION
    && draft.ownerId === ownerId
    && typeof draft.draftId === 'string'
    && typeof draft.startedAt === 'number'
    && typeof draft.name === 'string'
    && Array.isArray(draft.exercises)
    && draft.exercises.every((exercise) => exercise && Array.isArray(exercise.sets));
};

/**
 * The member's unfinished workout, or null when there is none.
 *
 * A stored value that cannot be read back (an older shape, a half-written
 * file) is moved aside rather than deleted, so a later version can still
 * recover it and a new workout does not overwrite it.
 */
export const loadActiveWorkoutDraft = async (ownerId: string): Promise<ActiveWorkoutDraft | null> => {
  const key = keyFor(ownerId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed, ownerId)) return parsed;
  } catch {
    // Falls through to the set-aside below.
  }
  await AsyncStorage.multiSet([[`${key}:unreadable:${Date.now()}`, raw]]);
  await AsyncStorage.removeItem(key);
  return null;
};

export const saveActiveWorkoutDraft = (draft: ActiveWorkoutDraft): Promise<void> =>
  AsyncStorage.setItem(keyFor(draft.ownerId), JSON.stringify({ ...draft, updatedAt: Date.now() }));

/**
 * Writes the draft only while it is still the stored one. Once the workout has
 * been saved or cancelled its record is gone, and a workout screen still
 * mounted underneath the summary must not write it back on its way out.
 */
export const updateActiveWorkoutDraft = async (draft: ActiveWorkoutDraft): Promise<void> => {
  const raw = await AsyncStorage.getItem(keyFor(draft.ownerId));
  if (!raw) return;
  try {
    if ((JSON.parse(raw) as { draftId?: unknown }).draftId !== draft.draftId) return;
  } catch {
    return;
  }
  await saveActiveWorkoutDraft(draft);
};

export const clearActiveWorkoutDraft = (ownerId: string): Promise<void> =>
  AsyncStorage.removeItem(keyFor(ownerId));

export const createActiveWorkoutDraft = (
  ownerId: string,
  name: string,
  exercises: ActiveWorkoutExercise[],
): ActiveWorkoutDraft => ({
  version: DRAFT_VERSION,
  ownerId,
  draftId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  startedAt: Date.now(),
  updatedAt: Date.now(),
  name,
  note: '',
  exercises,
});
