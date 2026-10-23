import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

export interface RadarAxis {
  key: string;
  /** Muscle group name, already in the reader's language. */
  label: string;
  /** This period's amount; sets the shape. */
  value: number;
  /** The period before, drawn as a dashed outline. */
  previous?: number;
  /** The figure printed under the label, already formatted. */
  display: string;
}

interface RadarChartProps {
  axes: RadarAxis[];
  /** Legend names for the two shapes; the legend shows only when there is a previous period. */
  currentLabel: string;
  previousLabel?: string;
  /** Largest drawing, for wide screens. */
  maxSize?: number;
  accessibilityLabel?: string;
}

const RINGS = [0.25, 0.5, 0.75, 1];
/** Room around the shape for a name and its figure at each corner. */
const GUTTER_X = 58;
const GUTTER_Y = 40;
const LABEL_GAP = 12;

/**
 * Where the training went, as a shape: one corner per muscle group, the
 * hexagonal rings the members asked to keep. A balanced program reads as a
 * round shape and a lopsided one leans toward the groups that got the work,
 * which a sorted list cannot show at a glance.
 *
 * Both periods share one scale - the larger of the two - so a dashed outline
 * outside the filled shape means "less than last time" on that corner. Every
 * corner carries its name and figure as text, so nothing depends on reading
 * a radius.
 */
const RadarChart = ({ axes, currentLabel, previousLabel, maxSize = 340, accessibilityLabel }: RadarChartProps) => {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const size = Math.min(width, maxSize);
  const chartWidth = size;
  const radius = Math.max(0, Math.min((size - GUTTER_X * 2) / 2, size / 2 - GUTTER_Y));
  const height = radius * 2 + GUTTER_Y * 2;
  const cx = chartWidth / 2;
  const cy = height / 2;
  const count = axes.length;
  const hasPrevious = axes.some((axis) => (axis.previous ?? 0) > 0);
  const largest = Math.max(1e-9, ...axes.map((axis) => Math.max(axis.value, axis.previous ?? 0)));
  const hasCurrent = axes.some((axis) => axis.value > 0);

  const angleOf = (index: number) => -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(count, 1);
  const pointAt = (index: number, fraction: number) => {
    const angle = angleOf(index);
    return { x: cx + radius * fraction * Math.cos(angle), y: cy + radius * fraction * Math.sin(angle) };
  };
  const polygonOf = (fractionOf: (index: number) => number) =>
    axes.map((_, index) => {
      const point = pointAt(index, fractionOf(index));
      return `${point.x},${point.y}`;
    }).join(' ');

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={accessibilityLabel}>
      {size > 0 && count >= 3 ? (
        <View style={{ alignItems: 'center' }}>
          <Svg width={chartWidth} height={height}>
            {RINGS.map((ring) => (
              <Polygon
                key={`ring-${ring}`}
                points={polygonOf(() => ring)}
                fill="none"
                stroke={theme.border}
                strokeWidth={ring === 1 ? 1.2 : 1}
              />
            ))}
            {axes.map((axis, index) => {
              const end = pointAt(index, 1);
              return <Line key={`spoke-${axis.key}`} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={theme.border} strokeWidth={1} />;
            })}

            {hasPrevious ? (
              <Polygon
                points={polygonOf((index) => (axes[index].previous ?? 0) / largest)}
                fill="none"
                stroke={theme.textMuted}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeLinejoin="round"
              />
            ) : null}

            {hasCurrent ? (
              <>
                <Polygon
                  points={polygonOf((index) => axes[index].value / largest)}
                  fill={theme.primary}
                  fillOpacity={0.24}
                  stroke={theme.primary}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {axes.map((axis, index) => {
                  if (axis.value <= 0) return null;
                  const point = pointAt(index, axis.value / largest);
                  return <Circle key={`dot-${axis.key}`} cx={point.x} cy={point.y} r={3} fill={theme.background} stroke={theme.primary} strokeWidth={2} />;
                })}
              </>
            ) : null}

            {axes.map((axis, index) => {
              const angle = angleOf(index);
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
              const edge = pointAt(index, 1);
              const x = edge.x + LABEL_GAP * cos;
              // Top corner: both lines above it; bottom: both below; sides: centred on it.
              const nameY = sin < -0.8 ? edge.y - 22 : sin > 0.8 ? edge.y + 20 : edge.y - 2 + LABEL_GAP * sin;
              const muted = axis.value <= 0;
              return (
                <React.Fragment key={`label-${axis.key}`}>
                  <SvgText x={x} y={nameY} fontSize={12.5} fontWeight="500" fill={muted ? theme.textMuted : theme.text} textAnchor={anchor}>
                    {axis.label}
                  </SvgText>
                  <SvgText x={x} y={nameY + 15} fontSize={11.5} fill={theme.textMuted} textAnchor={anchor}>
                    {axis.display}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      ) : null}

      {hasPrevious && previousLabel ? (
        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: theme.primary }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>{currentLabel}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.dash, { borderColor: theme.textMuted }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>{previousLabel}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  swatch: { width: 12, height: 12, borderRadius: 3, opacity: 0.85 },
  dash: { width: 16, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  legendText: { fontSize: 12.5 },
});

export default RadarChart;
