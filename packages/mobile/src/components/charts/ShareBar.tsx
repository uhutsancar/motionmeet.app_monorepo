import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface SharePart {
  key: string;
  label: string;
  value: number;
  /** Printed beside the label, already formatted ("32 set"). */
  display: string;
}

interface ShareBarProps {
  parts: SharePart[];
  accessibilityLabel?: string;
}

/** Opacity steps of the one hue, largest share first. */
const STEPS = [1, 0.75, 0.55, 0.4, 0.28, 0.18];

/**
 * "What share went where?" as one 100% bar: the parts in one hue, from full
 * to faint by size, split by 2pt seams, and a two-column key underneath that
 * carries the figures. It reads at a glance where a radar needs a moment, and
 * keeps the radar for the screens that are about balance.
 */
const ShareBar = ({ parts, accessibilityLabel }: ShareBarProps) => {
  const { theme } = useTheme();
  const shown = parts.filter((part) => part.value > 0).sort((a, b) => b.value - a.value);
  const total = shown.reduce((sum, part) => sum + part.value, 0);
  if (!total) return null;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.bar, { backgroundColor: theme.background }]}>
        {shown.map((part, index) => (
          <View
            key={part.key}
            style={{
              flex: part.value,
              marginLeft: index ? 2 : 0,
              backgroundColor: theme.primary,
              opacity: STEPS[Math.min(index, STEPS.length - 1)],
            }}
          />
        ))}
      </View>
      <View style={styles.key}>
        {shown.map((part, index) => (
          <View key={part.key} style={styles.keyItem}>
            <View
              style={[
                styles.dot,
                { backgroundColor: theme.primary, opacity: STEPS[Math.min(index, STEPS.length - 1)] },
              ]}
            />
            <Text numberOfLines={1} style={[styles.keyLabel, { color: theme.text }]}>{part.label}</Text>
            <Text style={[styles.keyValue, { color: theme.textMuted }]}>{part.display}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  key: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 8 },
  keyItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  keyLabel: { flex: 1, minWidth: 0, fontSize: 13 },
  keyValue: { fontSize: 12.5, fontVariant: ['tabular-nums'] },
});

export default ShareBar;
