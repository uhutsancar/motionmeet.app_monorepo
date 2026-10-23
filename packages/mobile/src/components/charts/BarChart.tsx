import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { labelEvery, zeroBasedTicks } from './scale';

export interface ChartPoint {
  key: string;
  /** Short x label, already in the reader's language. */
  label: string;
  value: number;
}

interface BarChartProps {
  data: ChartPoint[];
  /** The bar drawn in the full hue; the rest are a quiet tint of it. */
  selectedIndex: number;
  onSelect?: (index: number) => void;
  formatTick: (value: number) => string;
  /** Counts: whole-number ticks only. */
  integer?: boolean;
  height?: number;
  /**
   * `lollipop`: a 2pt stem and a dot per period instead of a column - for
   * sparse daily totals, where most periods are rest days and a field of
   * columns (or a line dropping to zero between them) reads as noise.
   */
  variant?: 'bar' | 'lollipop';
  accessibilityLabel?: string;
}

const Y_LANE = 34;
const X_LANE = 20;
const TOP = 8;
const MAX_BAR = 16;
const RADIUS = 2.5;

/** A bar with rounded top corners and a square foot on the baseline. */
const barPath = (x: number, y: number, width: number, height: number): string => {
  const r = Math.min(RADIUS, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
};

/**
 * Columns for "how much per period", one hue.
 *
 * The selected period - the current one unless the reader taps another - is
 * the only bar in the full accent; the others are the same hue, faded, so the
 * eye lands on the one the big number above the chart is about. Ticks sit in
 * their own lane on the right, never on a bar. Empty periods draw nothing:
 * a zero is not given a stub that reads as a little activity.
 */
const BarChart = ({
  data,
  selectedIndex,
  onSelect,
  formatTick,
  integer = false,
  height = 160,
  variant = 'bar',
  accessibilityLabel,
}: BarChartProps) => {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const max = Math.max(0, ...data.map((point) => point.value));
  const ticks = zeroBasedTicks(max, 4, integer);
  const top = ticks[ticks.length - 1] || 1;
  const plotWidth = Math.max(0, width - Y_LANE);
  const plotHeight = height - X_LANE - TOP;
  const slot = data.length ? plotWidth / data.length : 0;
  const barWidth = Math.min(MAX_BAR, slot * 0.62);
  const every = labelEvery(data.length, plotWidth);
  const yOf = (value: number) => TOP + plotHeight - (value / top) * plotHeight;

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tick, index) => (
            <React.Fragment key={tick}>
              <Line
                x1={0}
                x2={plotWidth}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={theme.border}
                strokeWidth={index === 0 ? 1 : StyleSheet.hairlineWidth}
              />
              <SvgText x={width - 2} y={yOf(tick) + 4} fontSize={10.5} fill={theme.textMuted} textAnchor="end">
                {formatTick(tick)}
              </SvgText>
            </React.Fragment>
          ))}

          {data.map((point, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            const barHeight = (point.value / top) * plotHeight;
            const selected = index === selectedIndex;
            const showLabel = selected || index === data.length - 1 || index % every === 0;
            const labelCollidesWithSelected =
              !selected && Math.abs(index - selectedIndex) < every && (index === data.length - 1 || index % every === 0);
            return (
              <React.Fragment key={point.key}>
                {point.value > 0 && variant === 'bar' && (
                  <Path
                    d={barPath(x, yOf(point.value), barWidth, barHeight)}
                    fill={theme.primary}
                    fillOpacity={selected ? 1 : 0.35}
                  />
                )}
                {point.value > 0 && variant === 'lollipop' && (
                  <>
                    <Line
                      x1={index * slot + slot / 2}
                      x2={index * slot + slot / 2}
                      y1={yOf(0)}
                      y2={yOf(point.value)}
                      stroke={theme.primary}
                      strokeOpacity={selected ? 1 : 0.4}
                      strokeWidth={2}
                    />
                    <Circle
                      cx={index * slot + slot / 2}
                      cy={yOf(point.value)}
                      r={selected ? 4.5 : 3.5}
                      fill={selected ? theme.primary : theme.background}
                      stroke={theme.primary}
                      strokeOpacity={selected ? 1 : 0.6}
                      strokeWidth={2}
                    />
                  </>
                )}
                {showLabel && !labelCollidesWithSelected && (
                  <SvgText
                    // The first and last labels hang inward from the plot's
                    // edges instead of being centred past them and clipped.
                    x={index === 0 ? 0 : index === data.length - 1 ? plotWidth : index * slot + slot / 2}
                    y={height - 6}
                    fontSize={10.5}
                    fontWeight={selected ? '600' : '400'}
                    fill={selected ? theme.text : theme.textMuted}
                    textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
                  >
                    {point.label}
                  </SvgText>
                )}
                {onSelect && (
                  <Rect
                    x={index * slot}
                    y={0}
                    width={slot}
                    height={height}
                    fill="transparent"
                    onPress={() => onSelect(index)}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
    </View>
  );
};

export default BarChart;
