import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface StatCell {
  key: string;
  label: string;
  value: string;
  unit?: string;
}

interface StatStripProps {
  cells: StatCell[];
  /** When set, the cells are the chart's metric tabs. */
  selectedKey?: string;
  onSelect?: (key: string) => void;
}

/**
 * Headline figures as type in one strip, not as a row of boxed tiles with
 * an icon chip each. Label over value, the unit a smaller grey suffix,
 * cells split by hairlines. Four cells fold into two rows on a narrow
 * phone rather than squeezing. As tabs, the chosen cell carries a 2px rule
 * in the accent; every value stays in full ink so none reads as disabled.
 */
const StatStrip = ({ cells, selectedKey, onSelect }: StatStripProps) => {
  const { theme } = useTheme();
  const perRow = cells.length === 4 ? 2 : cells.length;
  const rows: StatCell[][] = [];
  for (let index = 0; index < cells.length; index += perRow) rows.push(cells.slice(index, index + perRow));

  return (
    <View style={[styles.strip, { borderColor: theme.border }]}>
      {rows.map((row, rowIndex) => (
        <View
          key={row.map((cell) => cell.key).join('|')}
          style={[styles.row, rowIndex > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
        >
          {row.map((cell, index) => {
            const selected = selectedKey === cell.key;
            const body = (
              <>
                <Text numberOfLines={1} style={[styles.label, { color: selected ? theme.text : theme.textMuted }]}>
                  {cell.label}
                </Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.value, { color: theme.text }]}>
                  {cell.value}
                  {cell.unit ? <Text style={[styles.unit, { color: theme.textMuted }]}> {cell.unit}</Text> : null}
                </Text>
                {onSelect && (
                  <View style={[styles.rule, { backgroundColor: selected ? theme.primary : 'transparent' }]} />
                )}
              </>
            );
            const cellStyle = [
              styles.cell,
              index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.border },
            ];
            return onSelect ? (
              <Pressable
                key={cell.key}
                onPress={() => onSelect(cell.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${cell.label}: ${cell.value}${cell.unit ? ` ${cell.unit}` : ''}`}
                style={({ pressed }) => [...cellStyle, pressed && { opacity: 0.7 }]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={cell.key} style={cellStyle} accessible accessibilityLabel={`${cell.label}: ${cell.value}${cell.unit ? ` ${cell.unit}` : ''}`}>
                {body}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  strip: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 14 },
  label: { fontSize: 12, fontWeight: '500' },
  value: { fontSize: 17, fontWeight: '600', marginTop: 2, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '500' },
  rule: { height: 2, borderRadius: 1, marginTop: 8, marginBottom: -10 },
});

export default StatStrip;
