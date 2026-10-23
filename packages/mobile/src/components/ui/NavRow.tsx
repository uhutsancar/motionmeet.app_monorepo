import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { ICON, TYPE } from '../../config/layout';

interface NavRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  /** A figure that says what is behind the row, right-aligned before the chevron. */
  value?: string;
  onPress: () => void;
  last?: boolean;
  /** Red title and icon, no chevron: signing out, deleting. */
  danger?: boolean;
  /** Replaces the chevron, e.g. a switch. */
  accessory?: React.ReactNode;
}

/**
 * A row that opens another screen: one grey outline icon, the name, an
 * optional line of what is inside, a chevron. 48pt with one line, the way
 * Instagram's settings rows are; the divider starts at the text so the icons
 * stand in a clean column.
 */
const NavRow = ({ icon, title, subtitle, value, onPress, last = false, danger = false, accessory }: NavRowProps) => {
  const { theme } = useTheme();
  const tint = danger ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceLight }]}
    >
      <Ionicons name={icon} size={ICON.row} color={danger ? theme.danger : theme.textSecondary} style={styles.icon} />
      <View style={[styles.body, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
        <View style={styles.text}>
          <Text numberOfLines={1} style={[styles.title, { color: tint }]}>{title}</Text>
          {subtitle ? (
            <Text numberOfLines={1} style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {value ? <Text numberOfLines={1} style={[styles.value, { color: theme.textMuted }]}>{value}</Text> : null}
        {accessory ?? (danger ? null : <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />)}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 48 },
  icon: { width: 22 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12, paddingRight: 14, alignSelf: 'stretch' },
  text: { flex: 1, minWidth: 0, paddingVertical: 10 },
  title: { fontSize: TYPE.row, fontWeight: '400' },
  subtitle: { fontSize: TYPE.meta, marginTop: 1 },
  value: { maxWidth: '45%', fontSize: 13, marginRight: 6, fontVariant: ['tabular-nums'] },
});

export default NavRow;
