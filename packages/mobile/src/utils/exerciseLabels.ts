import type { TFunction } from 'i18next';
import { capitalizeFirst } from './format';

/**
 * Display names for the exercise catalogue's own vocabulary.
 *
 * The catalogue came from ExerciseDB, so a movement's body part and equipment
 * are stored as English phrases ("upper legs", "body weight", "leverage
 * machine") and its name in lower case. Rows printed those as they were, an
 * English "waist · body weight" under every Turkish heading. Everything that
 * shows a catalogue value goes through here, so it reads in the app's
 * language with a capital letter, and an unknown value still shows as itself.
 */

const keyOf = (raw: string): string => raw.trim().toLowerCase().replace(/\s+/g, '_');

/** "upper legs" → "Üst bacak" / "Upper legs". */
export const bodyPartLabel = (raw: string | undefined | null, t: TFunction, language: string): string =>
  raw ? String(t(`body_parts.${keyOf(raw)}`, capitalizeFirst(raw.trim(), language))) : '';

/** "leverage machine" → "Kaldıraçlı makine" / "Leverage machine". */
export const equipmentLabel = (raw: string | undefined | null, t: TFunction, language: string): string =>
  raw ? String(t(`equipment_names.${keyOf(raw)}`, capitalizeFirst(raw.trim(), language))) : '';

/** "Üst bacak · Halter", leaving out whichever half is missing. */
export const exerciseMeta = (
  exercise: { muscleGroup?: string | null; equipment?: string | null },
  t: TFunction,
  language: string,
): string =>
  [bodyPartLabel(exercise.muscleGroup, t, language), equipmentLabel(exercise.equipment, t, language)]
    .filter(Boolean)
    .join(' · ');

/** Catalogue names are stored in lower case; a title starts with a capital. */
export const exerciseTitle = (name: string | undefined | null, language: string): string =>
  capitalizeFirst((name ?? '').trim(), language);
