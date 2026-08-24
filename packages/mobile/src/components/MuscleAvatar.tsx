import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface MuscleAvatarProps {
  /** The muscle group's `code` from the metadata catalogue. */
  code: string;
  size?: number;
  selected?: boolean;
}

/**
 * Which region of the figure a catalogue code lights up.
 *
 * The exercise dataset describes a movement's muscles three different ways —
 * `body_part` ("upper arms"), `target` ("triceps") and `muscle_group` — and the
 * app's own catalogue uses a fourth, coarser set. Everything is folded onto one
 * of these regions here, so a new code only has to be named once.
 */
type MuscleRegion =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'abs'
  | 'cardio'
  | 'full_body';

const REGION_BY_CODE: Record<string, MuscleRegion> = {
  chest: 'chest',
  pectorals: 'chest',

  back: 'back',
  lats: 'back',
  'upper back': 'back',
  traps: 'back',
  spine: 'back',

  legs: 'legs',
  'upper legs': 'legs',
  'lower legs': 'legs',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',

  shoulders: 'shoulders',
  delts: 'shoulders',
  neck: 'shoulders',

  arms: 'arms',
  'upper arms': 'arms',
  'lower arms': 'arms',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',

  abs: 'abs',
  waist: 'abs',
  core: 'abs',

  cardio: 'cardio',
  'cardiovascular system': 'cardio',

  full_body: 'full_body',
  'full body': 'full_body',
};

export const muscleRegionFor = (code: string): MuscleRegion =>
  REGION_BY_CODE[code.trim().toLowerCase().replace(/[_\s]+/g, ' ')]
  ?? REGION_BY_CODE[code.trim().toLowerCase()]
  ?? 'full_body';

interface FigureProps {
  /** Muted colour for the parts of the body that are not the subject. */
  base: string;
  /** Accent for the region this avatar is about. */
  accent: string;
}

/**
 * The parts of one simplified, front-facing figure.
 *
 * Drawn rather than shipped as artwork so the set stays consistent, scales to
 * any size and re-tints with the theme. The shapes are deliberately blunt: at
 * 34 points nobody reads anatomy, they read *where on the body* — chest high
 * and central, legs low, arms at the sides — and that is all the picture has to
 * say for someone to pick the right filter at a glance.
 */
const Figure = ({ base, accent, region }: FigureProps & { region: MuscleRegion }) => {
  const on = (target: MuscleRegion) => (region === target || region === 'full_body' ? accent : base);
  const width = (target: MuscleRegion) => (region === target || region === 'full_body' ? 1 : 0.34);

  return (
    <>
      {/* Head */}
      <Circle cx={24} cy={7.5} r={4.4} fill={base} opacity={region === 'full_body' ? 1 : 0.34} />

      {/* Shoulders */}
      <Path
        d="M13.5 15.5c3-2.2 6.4-3.2 10.5-3.2s7.5 1 10.5 3.2l-1.6 3.6c-2.6-1.8-5.5-2.7-8.9-2.7s-6.3.9-8.9 2.7Z"
        fill={on('shoulders')}
        opacity={width('shoulders')}
      />

      {/* Chest */}
      <Path
        d="M15.4 19.6c2.5-1.7 5.3-2.5 8.6-2.5s6.1.8 8.6 2.5v6.2c0 1.6-1.2 2.6-2.9 2.6h-11.4c-1.7 0-2.9-1-2.9-2.6Z"
        fill={on('chest')}
        opacity={width('chest')}
      />

      {/* Abs */}
      <Rect x={18.6} y={28.8} width={10.8} height={9.4} rx={2.4} fill={on('abs')} opacity={width('abs')} />

      {/* Arms */}
      <Path
        d="M12.6 16.6c-1.7 1.1-2.6 2.8-2.6 5v10.6c0 1.4.9 2.3 2.2 2.3s2.2-.9 2.2-2.3V21.4Z"
        fill={on('arms')}
        opacity={width('arms')}
      />
      <Path
        d="M35.4 16.6c1.7 1.1 2.6 2.8 2.6 5v10.6c0 1.4-.9 2.3-2.2 2.3s-2.2-.9-2.2-2.3V21.4Z"
        fill={on('arms')}
        opacity={width('arms')}
      />

      {/* Legs */}
      <Path
        d="M18.8 39h4.1l-.5 12.4c-.05 1.5-.9 2.4-2.2 2.4s-2.1-.9-2.1-2.4Z"
        fill={on('legs')}
        opacity={width('legs')}
      />
      <Path
        d="M25.1 39h4.1l.7 12.4c.06 1.5-.8 2.4-2.1 2.4s-2.15-.9-2.2-2.4Z"
        fill={on('legs')}
        opacity={width('legs')}
      />
    </>
  );
};

/**
 * The picture beside a muscle group's name.
 *
 * A body with the region tinted, which is what every training app has settled
 * on because it answers "which one is 'Lat'?" without the reader knowing the
 * word. `cardio` is the exception: there is no region to point at, so it gets
 * the pulse from the brand mark instead of a shaded torso.
 */
const MuscleAvatar = ({ code, size = 34, selected = false }: MuscleAvatarProps) => {
  const { theme } = useTheme();
  const region = muscleRegionFor(code);
  const accent = selected ? theme.primary : theme.textSecondary;
  const base = theme.textMuted;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.plate,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: selected ? theme.primarySoft : theme.surfaceLight,
        },
      ]}
    >
      <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 48 60">
        {region === 'cardio' ? (
          <Path
            d="M6 30h6l4-7 5 15 5-24 5 24 4-8h7"
            fill="none"
            stroke={accent}
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Figure base={base} accent={accent} region={region} />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(MuscleAvatar);
