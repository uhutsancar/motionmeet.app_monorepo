import React, { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { labelEvery, rangeTicks, zeroBasedTicks } from './scale';
import type { ChartPoint } from './BarChart';

interface LineChartProps {
  data: ChartPoint[];
  selectedIndex: number;
  onSelect?: (index: number) => void;
  formatTick: (value: number) => string;
  /** Totals start at zero; a level such as body weight does not. */
  zeroBased?: boolean;
  /** Counts: whole-number ticks only. */
  integer?: boolean;
  height?: number;
  accessibilityLabel?: string;
}

const Y_LANE = 38;
const X_LANE = 20;
const TOP = 10;
const SIDE = 6;

/**
 * "Is it moving over time?" as one 2px line in straight segments.
 *
 * No smoothing: a curve between two daily totals invents values nobody
 * logged, and the old spline dipped below the lowest real point. No dot on
 * every point either - only the selected one, with a faint guide down to its
 * date, so tapping along the line reads one value at a time.
 */
const LineChart = ({
  data,
  selectedIndex,
  onSelect,
  formatTick,
  zeroBased = true,
  integer = false,
  height = 170,
  accessibilityLabel,
}: LineChartProps) => {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const values = data.map((point) => point.value);
  const ticks = zeroBased
    ? zeroBasedTicks(Math.max(0, ...values), 4, integer)
    : rangeTicks(Math.min(...values), Math.max(...values), 4);
  const low = ticks[0] ?? 0;
  const high = ticks[ticks.length - 1] ?? 1;
  const plotWidth = Math.max(0, width - Y_LANE - SIDE * 2);
  const plotHeight = height - X_LANE - TOP;
  const xOf = (index: number) => SIDE + (data.length > 1 ? (index / (data.length - 1)) * plotWidth : plotWidth / 2);
  const yOf = (value: number) => TOP + plotHeight - ((value - low) / (high - low || 1)) * plotHeight;
  const every = labelEvery(data.length, plotWidth, 56);

  const line = data.map((point, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(point.value)}`).join('');
  const area = zeroBased && data.length > 1
    ? `${line}L${xOf(data.length - 1)},${yOf(low)}L${xOf(0)},${yOf(low)}Z`
    : '';
  const selected = data[selectedIndex];

  const handlePress = (event: GestureResponderEvent) => {
    if (!onSelect || data.length === 0) return;
    const x = event.nativeEvent.locationX - SIDE;
    const index = data.length > 1 ? Math.round((x / plotWidth) * (data.length - 1)) : 0;
    onSelect(Math.max(0, Math.min(data.length - 1, index)));
  };

  return (
    <View onLayout={onLayout} style={{ height }} accessible accessibilityLabel={accessibilityLabel}>
      {width > 0 && data.length > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((tick, index) => (
            <React.Fragment key={tick}>
              <Line x1={0} x2={SIDE * 2 + plotWidth} y1={yOf(tick)} y2={yOf(tick)} stroke={theme.border} strokeWidth={index === 0 && zeroBased ? 1 : StyleSheet.hairlineWidth} />
              <SvgText x={width - 2} y={yOf(tick) + 4} fontSize={10.5} fill={theme.textMuted} textAnchor="end">
                {formatTick(tick)}
              </SvgText>
            </React.Fragment>
          ))}

          {area ? <Path d={area} fill={theme.primary} fillOpacity={0.1} /> : null}
          <Path d={line} stroke={theme.primary} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

          {selected && (
            <>
              <Line x1={xOf(selectedIndex)} x2={xOf(selectedIndex)} y1={TOP} y2={TOP + plotHeight} stroke={theme.textMuted} strokeOpacity={0.5} strokeWidth={1} />
              <Circle cx={xOf(selectedIndex)} cy={yOf(selected.value)} r={4.5} fill={theme.primary} stroke={theme.background} strokeWidth={2} />
            </>
          )}

          {data.map((point, index) => {
            const isSelected = index === selectedIndex;
            const regular = index === 0 || index === data.length - 1 || index % every === 0;
            const crowdsSelected = !isSelected && Math.abs(index - selectedIndex) < every;
            if (!isSelected && (!regular || crowdsSelected)) return null;
            const anchor = index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle';
            return (
              <SvgText
                key={point.key}
                x={xOf(index)}
                y={height - 6}
                fontSize={10.5}
                fontWeight={isSelected ? '600' : '400'}
                fill={isSelected ? theme.text : theme.textMuted}
                textAnchor={anchor}
              >
                {point.label}
              </SvgText>
            );
          })}

          {onSelect && <Rect x={0} y={0} width={width - Y_LANE} height={height} fill="transparent" onPress={handlePress} />}
        </Svg>
      )}
    </View>
  );
};

export default LineChart;
