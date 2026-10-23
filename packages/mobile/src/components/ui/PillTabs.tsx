import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export interface PillTab<Key extends string> {
  key: Key;
  label: string;
}

interface PillTabsProps<Key extends string> {
  tabs: Array<PillTab<Key>>;
  selected: Key;
  onSelect: (key: Key) => void;
}

/**
 * The period switch above a report: plain labels, the chosen one on a soft
 * grey pill. No outline and no accent fill, so it reads as a control and
 * leaves the colour to the chart below it.
 */
const PillTabs = <Key extends string>({ tabs, selected, onSelect }: PillTabsProps<Key>) => {
  const { theme } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isSelected = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.pill, { backgroundColor: isSelected ? theme.surfaceLight : 'transparent' }]}
          >
            <Text style={[styles.label, { color: isSelected ? theme.text : theme.textMuted }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingHorizontal: 12, paddingTop: 4 },
  pill: { minHeight: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600' },
});

export default PillTabs;
