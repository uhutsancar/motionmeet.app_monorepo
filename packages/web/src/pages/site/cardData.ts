/** Card helpers for the public pages, kept apart from the components. */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  buildShareCardSvg,
  shareCardLocaleFor,
  workoutToShareCardData,
  type ShareCardSize,
  type ShareCardTemplate,
  type ShareCardWorkoutLike,
} from "@motionmeet/shared";

export const svgSrc = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const MUSCLE_WORDS: Array<[RegExp, string]> = [
  [/bench|chest|fly|push ?up|göğüs|gogus|şınav/i, "chest"],
  [/squat|leg|lunge|calf|deadlift|bacak|baldır|hip thrust|glute/i, "legs"],
  [/row|pull|lat|chin|sırt|sirt|back/i, "back"],
  [/overhead|shoulder|lateral|military|omuz|face pull/i, "shoulders"],
  [/curl|triceps|pushdown|dip|biceps|kol|arm/i, "arms"],
  [/plank|crunch|sit ?up|leg raise|karın|karin|ab /i, "abs"],
];
const EQUIPMENT_WORDS: Array<[RegExp, string]> = [
  [/dumbbell|dambıl|dambil/i, "dumbbell"],
  [/cable|kablo|pushdown|face pull/i, "cables"],
  [/machine|makine|leg press/i, "machine"],
  [/kettlebell/i, "kettlebell"],
  [/barbell|bench|squat|deadlift|overhead|halter|row/i, "barbell"],
];

/**
 * Reads a typed log - a title line, then one movement per line such as
 * "Bench press 4x8 80" - into the shape the card renderer takes. Lines it
 * cannot read are skipped, never guessed at.
 */
export const parseWorkoutLog = (raw: string, untitled: string): ShareCardWorkoutLike & { volumeKg: number } => {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 40);
  const exercises: ShareCardWorkoutLike["exercises"] = [];
  let title = "";
  let volume = 0;
  let sets = 0;
  for (const line of lines) {
    const match = /^(.+?)\s+(\d{1,2})\s*[x×*]\s*(\d{1,3})(?:\s*[x×*@]?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:kg)?)?$/iu.exec(line);
    if (!match) {
      if (!title && !exercises.length) title = line.slice(0, 40);
      continue;
    }
    const [, name, setCount, reps, weight] = match;
    const count = Math.min(20, Number(setCount));
    const kilos = weight ? Number(weight.replace(",", ".")) : 0;
    sets += count;
    volume += count * Number(reps) * kilos;
    exercises.push({
      exerciseName: name.slice(0, 40),
      sets: Array.from({ length: count }, () => ({})),
      equipment: EQUIPMENT_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? (kilos ? "other" : "bodyweight"),
      muscleGroup: MUSCLE_WORDS.find(([pattern]) => pattern.test(name))?.[1],
    });
  }
  return { name: title || untitled, startTime: new Date().toISOString(), durationMinutes: 0, volumeKg: volume, totalSets: sets, exercises };
};

export const useShareCard = (workout: ShareCardWorkoutLike, template: ShareCardTemplate, size: ShareCardSize) => {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const locale = shareCardLocaleFor(i18n.language);
    const data = workoutToShareCardData(workout, "motionmeet", undefined, locale);
    return svgSrc(buildShareCardSvg(data, template, size));
  }, [i18n.language, size, template, workout]);
};

