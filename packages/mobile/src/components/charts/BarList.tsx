import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface BarListRow {
  key: string;
  label: string;
  /** What the bar measures, as a share of the largest row. */
  value: number;
  /** The figure printed on the right, already formatted. */
  display: string;
  /** The same measure for the previous period, drawn as a 2px tick. */
  previous?: number;
}

interface BarListProps {
  rows: BarListRow[];
  /** Grey bars when this list supports a screen rather than being its answer. */
  muted?: boolean;
}

/**
 * "Who ranks?" as a sorted list: name and figure on one line, a thin bar
 * under it. Replaces the radar, which squeezed eight muscle groups into a
 * blob near its centre and could not be read without a legend. A tick marks
 * last period's share when there is one, so drift reads without a second
 * series.
 */
const BarList = ({ rows, muted = false }: BarListProps) => {
  const { theme } = useTheme();
  const largest = Math.max(1e-9, ...rows.map((row) => Math.max(row.value, row.previous ?? 0)));

  return (
    <View>
      {rows.map((row, index) => (
        <View key={row.key} style={[styles.row, index > 0 && styles.rowGap]}>
          <View style={styles.line}>
            <Text numberOfLines={1} style={[styles.label, { color: theme.text }]}>{row.label}</Text>
            <Text style={[styles.value, { color: theme.textSecondary }]}>{row.display}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: theme.surfaceLight }]}>
            {row.value > 0 && (
              <View
                style={[
                  styles.fill,
                  {
                    width: `${(row.value / largest) * 100}%`,
                    backgroundColor: muted ? theme.textMuted : theme.primary,
                  },
                ]}
              />
            )}
            {row.previous !== undefined && row.previous > 0 && (
              <View
                style={[styles.tick, { left: `${(row.previous / largest) * 100}%`, backgroundColor: theme.text }]}
              />
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { paddingVertical: 2 },
  rowGap: { marginTop: 12 },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: '500' },
  value: { fontSize: 12.5, fontWeight: '500', fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'visible' },
  fill: { height: 4, borderRadius: 2 },
  tick: { position: 'absolute', top: -3, width: 2, height: 10, borderRadius: 1 },
});

export default BarList;
