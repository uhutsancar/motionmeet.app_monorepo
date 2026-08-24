import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MotionMark from './MotionMark';
import { useTheme } from '../context/ThemeContext';

interface MotionLogoProps {
  /** Height of the mark; the wordmark is sized from it. */
  size?: number;
  variant?: 'tile' | 'glyph';
  /** Hides the wordmark, for places too narrow to carry it. */
  markOnly?: boolean;
  color?: string;
}

/**
 * The mark and the word together — the lockup.
 *
 * One component so the gap, the type size and the weight beside the mark are
 * decided once. Screens that used to place their own `<Text>MotionMeet</Text>`
 * next to an icon each picked slightly different values, and the logo ended up
 * looking subtly different on the login screen, the header and the empty
 * states. There is only ever one lockup.
 */
const MotionLogo = ({ size = 28, variant = 'tile', markOnly = false, color }: MotionLogoProps) => {
  const { theme } = useTheme();

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="MotionMeet">
      <MotionMark size={size} variant={variant} />
      {!markOnly && (
        <Text
          numberOfLines={1}
          style={[
            styles.wordmark,
            {
              color: color ?? theme.text,
              fontSize: size * 0.62,
              // Tight, so the word sits against the mark as one shape rather
              // than as an icon with a caption next to it.
              letterSpacing: -0.4,
            },
          ]}
        >
          MotionMeet
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontWeight: '700',
  },
});

export default memo(MotionLogo);
