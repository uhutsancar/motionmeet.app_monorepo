import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';
import { CONTROL, ICON, TYPE } from '../../config/layout';

interface SoftButtonProps {
  label: string;
  onPress: () => void;
  /** The one action a screen or card asks for, in the accent. */
  primary?: boolean;
  /** Red text for the one destructive action on a screen. */
  danger?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  busy?: boolean;
  dimmed?: boolean;
  /** 40pt instead of 32pt, for the action a whole screen exists for. */
  large?: boolean;
  /** Takes the row's free width (the default) or only its own. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The quiet button Hevy and Instagram use: a short soft-grey slab with its
 * label, no outline, 32pt tall. `primary` fills it with the accent for the
 * single action that matters on the card - "Start routine", "Follow".
 */
const SoftButton = ({
  label,
  onPress,
  primary = false,
  danger = false,
  icon,
  busy = false,
  dimmed = false,
  large = false,
  fill = true,
  style,
}: SoftButtonProps) => {
  const { theme } = useTheme();
  const ink = primary ? '#FFFFFF' : danger ? theme.danger : theme.text;
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={({ pressed }) => [
        styles.button,
        large && styles.large,
        fill && styles.fill,
        {
          backgroundColor: primary ? theme.primary : theme.surfaceLight,
          opacity: dimmed ? 0.5 : pressed ? 0.72 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={ink} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={large ? ICON.inline + 2 : ICON.inline} color={ink} /> : null}
          <Text numberOfLines={1} style={[styles.label, large && styles.largeLabel, { color: ink }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: CONTROL.height,
    borderRadius: CONTROL.radius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  large: { minHeight: CONTROL.large },
  fill: { flex: 1 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: TYPE.button, fontWeight: '600' },
  largeLabel: { fontSize: 14.5 },
});

export default SoftButton;
