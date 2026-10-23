import type { TFunction } from 'i18next';
import type { WorkoutStats } from '@motionmeet/shared';
import type { RadarAxis } from '../../components/charts/RadarChart';
import { formatNumber } from '../../utils/format';

/**
 * Groups that are not a muscle a program can lean toward. Kept off the radar
 * so its six corners - and the shape people recognise - never change.
 */
export const NOT_A_MUSCLE = new Set(['cardio', 'full_body']);

/**
 * The radar's corners, in the catalogue's own order so the shape stays put
 * from one visit to the next. Sets give the shape when the server sends
 * them; an older server only has shares, which draw the same shape.
 */
export const toMuscleAxes = (
  groups: Array<{ code: string; name: string }>,
  stats: WorkoutStats | null | undefined,
  t: TFunction,
  language: string,
): RadarAxis[] =>
  groups
    .filter((group) => !NOT_A_MUSCLE.has(group.code))
    .map((group) => {
      const sets = stats?.muscleSets?.[group.code];
      const share = stats?.muscleDistribution?.[group.code] ?? 0;
      return {
        key: group.code,
        label: String(t(`muscle_groups.${group.code}`, group.name || group.code)),
        value: sets ?? share,
        previous: stats?.previousMuscleSets?.[group.code],
        display: sets !== undefined
          ? String(t('monthly_report.sets_count', { count: sets, defaultValue: '{{count}} set' }))
          : `%${formatNumber(share * 100, language)}`,
      };
    });
