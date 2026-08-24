import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface EquipmentAvatarProps {
  /** The equipment's `code` from the metadata catalogue. */
  code: string;
  size?: number;
  /** Lifts the plate behind the drawing, for a row that is currently chosen. */
  selected?: boolean;
}

/**
 * The drawings, keyed by the canonical name each catalogue code maps onto.
 *
 * Deliberately line art on a 24-unit grid at one stroke weight. A set of icons
 * only reads as a set if every one of them is drawn the same way — mixing
 * filled and outlined shapes, or weights, makes the column look like clip art
 * even when each piece is fine on its own.
 */
type EquipmentGlyph =
  | 'bodyweight'
  | 'barbell'
  | 'dumbbell'
  | 'band'
  | 'kettlebell'
  | 'machine'
  | 'cables'
  | 'plate'
  | 'suspension'
  | 'other';

/**
 * Catalogue codes are not stable across the app's own metadata and the imported
 * exercise dataset — the same rack of weights arrives as `barbell`, `bar`,
 * `olympic barbell` or `smith machine` depending on the source. Everything is
 * normalised to one glyph here rather than in each screen, so a new code only
 * has to be named once and the picture follows it everywhere.
 */
const GLYPH_BY_CODE: Record<string, EquipmentGlyph> = {
  none: 'bodyweight',
  bodyweight: 'bodyweight',
  body_weight: 'bodyweight',
  'body weight': 'bodyweight',
  assisted: 'bodyweight',

  bar: 'barbell',
  barbell: 'barbell',
  ez_bar: 'barbell',
  'olympic barbell': 'barbell',
  'ez barbell': 'barbell',
  'trap bar': 'barbell',

  dumbbell: 'dumbbell',

  band: 'band',
  bands: 'band',
  resistance_band: 'band',
  'resistance band': 'band',
  'elastic band': 'band',

  kettlebell: 'kettlebell',

  machine: 'machine',
  'leverage machine': 'machine',
  'sled machine': 'machine',
  'smith machine': 'machine',
  'stationary bike': 'machine',
  'stepmill machine': 'machine',
  'elliptical machine': 'machine',

  cable: 'cables',
  cables: 'cables',

  plate: 'plate',
  weighted: 'plate',
  'weight plate': 'plate',

  suspension: 'suspension',
  suspension_band: 'suspension',
  'suspension band': 'suspension',
  trx: 'suspension',

  other: 'other',
};

export const equipmentGlyphFor = (code: string): EquipmentGlyph =>
  GLYPH_BY_CODE[code.trim().toLowerCase().replace(/\s+/g, ' ')] ?? 'other';

interface GlyphProps {
  stroke: string;
  /** Scaled with the avatar so a small chip is not drawn with a hairline. */
  width: number;
}

const GLYPHS: Record<EquipmentGlyph, (props: GlyphProps) => React.ReactElement> = {
  /* A figure mid-movement: the one option that is not a piece of kit. */
  bodyweight: ({ stroke, width }) => (
    <>
      <Circle cx={12} cy={4.4} r={2.2} stroke={stroke} strokeWidth={width} fill="none" />
      <Path
        d="M12 6.9v6M12 12.9 8.4 20M12 12.9 15.6 20M5.4 9.4 12 8.4l6.6 1"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  /* A loaded bar: long shaft, a plate stack at each end, collars outside. */
  barbell: ({ stroke, width }) => (
    <>
      <Line x1={2} y1={12} x2={22} y2={12} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={5.6} y1={7.6} x2={5.6} y2={16.4} stroke={stroke} strokeWidth={width * 1.6} strokeLinecap="round" />
      <Line x1={8.2} y1={9.2} x2={8.2} y2={14.8} stroke={stroke} strokeWidth={width * 1.6} strokeLinecap="round" />
      <Line x1={15.8} y1={9.2} x2={15.8} y2={14.8} stroke={stroke} strokeWidth={width * 1.6} strokeLinecap="round" />
      <Line x1={18.4} y1={7.6} x2={18.4} y2={16.4} stroke={stroke} strokeWidth={width * 1.6} strokeLinecap="round" />
    </>
  ),

  /* The same drawing closed up, with a short handle. */
  dumbbell: ({ stroke, width }) => (
    <>
      <Line x1={9} y1={12} x2={15} y2={12} stroke={stroke} strokeWidth={width * 1.3} strokeLinecap="round" />
      <Line x1={6.6} y1={7.4} x2={6.6} y2={16.6} stroke={stroke} strokeWidth={width * 1.8} strokeLinecap="round" />
      <Line x1={17.4} y1={7.4} x2={17.4} y2={16.6} stroke={stroke} strokeWidth={width * 1.8} strokeLinecap="round" />
      <Line x1={3.4} y1={9.6} x2={3.4} y2={14.4} stroke={stroke} strokeWidth={width * 1.4} strokeLinecap="round" />
      <Line x1={20.6} y1={9.6} x2={20.6} y2={14.4} stroke={stroke} strokeWidth={width * 1.4} strokeLinecap="round" />
    </>
  ),

  /* A band under tension between two grips. */
  band: ({ stroke, width }) => (
    <>
      <Path
        d="M6.4 8.4C11 10.4 13 13.6 17.6 15.6"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M6.4 11.4C11 13.4 13 14.4 17.6 16.4"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx={4.8} cy={9.9} r={2.3} stroke={stroke} strokeWidth={width} fill="none" />
      <Circle cx={19.2} cy={16} r={2.3} stroke={stroke} strokeWidth={width} fill="none" />
    </>
  ),

  /* Bell body under a squared-off handle. */
  kettlebell: ({ stroke, width }) => (
    <>
      <Path
        d="M9.4 8a2.6 2.6 0 0 1 5.2 0"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M9.6 8.6C7.1 10 5.6 12.5 5.6 15.2c0 2.4 1.4 3.9 3.7 3.9h5.4c2.3 0 3.7-1.5 3.7-3.9 0-2.7-1.5-5.2-4-6.6Z"
        stroke={stroke}
        strokeWidth={width}
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  /* A weight stack in its frame, with the selector pin. */
  machine: ({ stroke, width }) => (
    <>
      <Rect x={4.6} y={4} width={9} height={16} rx={1.8} stroke={stroke} strokeWidth={width} fill="none" />
      <Line x1={6.8} y1={8} x2={11.4} y2={8} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={6.8} y1={11} x2={11.4} y2={11} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={6.8} y1={14} x2={11.4} y2={14} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={6.8} y1={17} x2={11.4} y2={17} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Path
        d="M15.6 6.4h3.8v10.8a2.4 2.4 0 0 1-2.4 2.4h-1.4"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  /* Pulley at the top, cable down to a straight bar. */
  cables: ({ stroke, width }) => (
    <>
      <Circle cx={7.2} cy={5.8} r={2.4} stroke={stroke} strokeWidth={width} fill="none" />
      <Path
        d="M9.6 5.8h6a2 2 0 0 1 2 2v4.4"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={17.6} y1={12.2} x2={17.6} y2={16.6} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={13.6} y1={17.4} x2={21.6} y2={17.4} stroke={stroke} strokeWidth={width * 1.5} strokeLinecap="round" />
    </>
  ),

  /* A single plate, face on. */
  plate: ({ stroke, width }) => (
    <>
      <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={width} fill="none" />
      <Circle cx={12} cy={12} r={2.4} stroke={stroke} strokeWidth={width} fill="none" />
      <Line x1={12} y1={4} x2={12} y2={6.4} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={12} y1={17.6} x2={12} y2={20} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={4} y1={12} x2={6.4} y2={12} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Line x1={17.6} y1={12} x2={20} y2={12} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
    </>
  ),

  /* Two straps from one anchor, with their handles. */
  suspension: ({ stroke, width }) => (
    <>
      <Line x1={4.6} y1={3.6} x2={19.4} y2={3.6} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      <Path
        d="M12 3.6v3.2M12 6.8 8 14.6M12 6.8l4 7.8"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={6.2} y1={16} x2={9.8} y2={16} stroke={stroke} strokeWidth={width * 1.5} strokeLinecap="round" />
      <Line x1={14.2} y1={16} x2={17.8} y2={16} stroke={stroke} strokeWidth={width * 1.5} strokeLinecap="round" />
    </>
  ),

  /* Anything the catalogue has not been taught to draw. */
  other: ({ stroke, width }) => (
    <>
      <Circle cx={6} cy={12} r={1.4} stroke={stroke} strokeWidth={width} fill="none" />
      <Circle cx={12} cy={12} r={1.4} stroke={stroke} strokeWidth={width} fill="none" />
      <Circle cx={18} cy={12} r={1.4} stroke={stroke} strokeWidth={width} fill="none" />
    </>
  ),
};

/**
 * The picture beside an equipment name.
 *
 * Every avatar is the same diameter and drawn on the same grid, so a column of
 * them lines up and no one option looks heavier than its neighbours. The plate
 * behind the drawing is a soft tint rather than an outlined tile: the point is
 * to let someone find "kettlebell" by shape at a glance, not to add another
 * box to the screen.
 *
 * The label always stays visible in its own right — the drawing is decoration
 * on top of a name, never a replacement for it, which is also why the SVG is
 * hidden from screen readers.
 */
const EquipmentAvatar = ({ code, size = 36, selected = false }: EquipmentAvatarProps) => {
  const { theme } = useTheme();
  const Glyph = GLYPHS[equipmentGlyphFor(code)];
  const stroke = selected ? theme.primary : theme.textSecondary;

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
      <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
        <Glyph stroke={stroke} width={1.6} />
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

export default memo(EquipmentAvatar);
