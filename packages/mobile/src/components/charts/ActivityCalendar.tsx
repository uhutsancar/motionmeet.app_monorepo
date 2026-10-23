import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import type { DayBucket } from '../../features/stats/dailySeries';

interface ActivityCalendarProps {
  /** Monday-first days, oldest first, as `toDayBuckets` returns them. */
  days: DayBucket[];
  selectedKey?: string;
  onSelect?: (day: DayBucket) => void;
  /** Short weekday names, Monday first. */
  weekdayLabels: string[];
  /** Month name for a `YYYY-MM-DD` key, printed above the week it starts in. */
  monthLabel: (key: string) => string;
  lessLabel: string;
  moreLabel: string;
  accessibilityLabel?: string;
}

const DAY_LANE = 28;
const MONTH_LANE = 16;
const GAP = 3;
const MAX_CELL = 18;

/**
 * Training days as a grid of squares, a column per week and a row per
 * weekday - the consistency view Hevy and GitHub use. It answers "do I train
 * regularly?", which a bar per week cannot: three sessions crammed into a
 * weekend and three spread across a week look the same as bars.
 *
 * One hue, four steps by minutes trained that day; an empty day is the grey
 * of the surface and today is outlined. The steps are the day's share of the
 * longest day on screen, so one long session does not wash the rest out.
 */
const ActivityCalendar = ({
  days,
  selectedKey,
  onSelect,
  weekdayLabels,
  monthLabel,
  lessLabel,
  moreLabel,
  accessibilityLabel,
}: ActivityCalendarProps) => {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const weeks = Math.ceil(days.length / 7);
  const cell = weeks ? Math.min(MAX_CELL, (width - DAY_LANE - GAP * (weeks - 1)) / weeks) : 0;
  const gridWidth = weeks * cell + (weeks - 1) * GAP;
  const left = width - gridWidth;
  const height = MONTH_LANE + 7 * cell + 6 * GAP;
  const longest = Math.max(1, ...days.map((day) => (day.workouts ? Math.max(day.duration, 1) : 0)));
  const todayKey = days[days.length - 1]?.key;

  const levelOf = (day: DayBucket): number => {
    if (!day.workouts) return 0;
    const share = Math.max(day.duration, 1) / longest;
    return share > 0.75 ? 4 : share > 0.5 ? 3 : share > 0.25 ? 2 : 1;
  };
  const OPACITY = [0, 0.3, 0.55, 0.8, 1];

  const swatch = (level: number) => (
    <View
      key={level}
      style={[
        styles.swatch,
        { backgroundColor: level ? theme.primary : theme.surfaceLight, opacity: level ? OPACITY[level] : 1 },
      ]}
    />
  );

  return (
    <View>
      <View onLayout={onLayout} style={{ height: cell ? height : 140 }} accessible accessibilityLabel={accessibilityLabel}>
        {cell > 0 && (
          <Svg width={width} height={height}>
            {[0, 2, 4].map((row) => (
              <SvgText
                key={`day-${row}`}
                x={0}
                y={MONTH_LANE + row * (cell + GAP) + cell / 2 + 3.5}
                fontSize={10}
                fill={theme.textMuted}
              >
                {weekdayLabels[row]}
              </SvgText>
            ))}

            {Array.from({ length: weeks }, (_, week) => {
              const first = days[week * 7];
              const previous = days[(week - 1) * 7];
              const newMonth = first && (!previous || first.key.slice(5, 7) !== previous.key.slice(5, 7));
              // A label needs about three columns; the first one only prints
              // when the month really starts inside the grid's first week.
              if (!newMonth || (week === 0 && first.key.slice(8) > '07') || week > weeks - 2) return null;
              return (
                <SvgText key={`month-${week}`} x={left + week * (cell + GAP)} y={10} fontSize={10} fill={theme.textMuted}>
                  {monthLabel(first.key)}
                </SvgText>
              );
            })}

            {days.map((day, index) => {
              const week = Math.floor(index / 7);
              const row = index % 7;
              const level = levelOf(day);
              const x = left + week * (cell + GAP);
              const y = MONTH_LANE + row * (cell + GAP);
              const selected = day.key === selectedKey;
              const today = day.key === todayKey;
              return (
                <Rect
                  key={day.key}
                  x={x + (selected || today ? 0.75 : 0)}
                  y={y + (selected || today ? 0.75 : 0)}
                  width={cell - (selected || today ? 1.5 : 0)}
                  height={cell - (selected || today ? 1.5 : 0)}
                  rx={3}
                  fill={level ? theme.primary : theme.surfaceLight}
                  fillOpacity={level ? OPACITY[level] : 1}
                  stroke={selected ? theme.text : today ? theme.textSecondary : 'none'}
                  strokeWidth={selected || today ? 1.5 : 0}
                  onPress={onSelect ? () => onSelect(day) : undefined}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: theme.textMuted }]}>{lessLabel}</Text>
        {[0, 1, 2, 3, 4].map(swatch)}
        <Text style={[styles.legendText, { color: theme.textMuted }]}>{moreLabel}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 8 },
  legendText: { fontSize: 11, marginHorizontal: 3 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
});

export default ActivityCalendar;
