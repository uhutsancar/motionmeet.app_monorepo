import React, { useMemo } from 'react';
import Toast from 'react-native-toast-message';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

/** Extra fields a `message` banner carries: who it is from. */
export interface MessageToastProps {
  avatar?: string | null;
  name?: string;
}

type Tone = 'success' | 'error' | 'info';

const TONE_ICON: Record<Tone, React.ComponentProps<typeof Ionicons>['name']> = {
  success: 'checkmark',
  error: 'alert',
  info: 'information',
};

/**
 * One banner: a soft badge or the sender's avatar, a bold line and a quieter
 * one under it, on a raised surface that stands apart from the screen in both
 * themes. Replaces the generic library box with its thick coloured stripe.
 * Swiping it up dismisses it (the library's default); tapping it does what
 * the caller asked, if anything.
 */
const Banner = ({
  params,
  theme,
  width,
  tone,
  message,
}: {
  params: ToastConfigParams<MessageToastProps | Record<string, never>>;
  theme: MotionTheme;
  width: number;
  tone: Tone | 'message';
  message?: MessageToastProps;
}) => {
  // The library always hands over an onPress, so whether a banner leads
  // anywhere is known from its kind: only a message opens something.
  const actionable = tone === 'message';
  const accent = tone === 'success' ? theme.success : tone === 'error' ? theme.danger : theme.primary;
  const avatar = message?.avatar?.trim();
  const initial = (message?.name || params.text1 || '?').trim().charAt(0).toLocaleUpperCase();

  const leading = tone === 'message' ? (
    avatar ? (
      <Image source={{ uri: avatar }} style={styles.avatar} />
    ) : (
      <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
        <Text style={[styles.initial, { color: theme.primary }]}>{initial}</Text>
      </View>
    )
  ) : (
    <View style={[styles.badge, { backgroundColor: `${accent}26` }]}>
      <Ionicons name={TONE_ICON[tone]} size={18} color={accent} />
    </View>
  );

  return (
    <Pressable
      onPress={params.onPress}
      accessibilityRole={actionable ? 'button' : 'alert'}
      accessibilityLiveRegion="polite"
      accessibilityLabel={[params.text1, params.text2].filter(Boolean).join('. ')}
      style={({ pressed }) => [
        styles.banner,
        {
          width,
          backgroundColor: theme.surfaceLight,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {leading}
      <View style={styles.copy}>
        {params.text1 ? (
          <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={[styles.title, { color: theme.text }]}>
            {params.text1}
          </Text>
        ) : null}
        {params.text2 ? (
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={[styles.body, { color: theme.textSecondary }]}>
            {params.text2}
          </Text>
        ) : null}
      </View>
      {actionable ? <Ionicons name="chevron-forward" size={16} color={theme.textMuted} /> : null}
    </Pressable>
  );
};

const AppToast = () => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const usableWidth = Math.max(0, width - insets.left - insets.right);
  const toastWidth = Math.max(1, Math.min(usableWidth - 24, 520));

  const config = useMemo<ToastConfig>(() => ({
    success: (params) => <Banner params={params} theme={theme} width={toastWidth} tone="success" />,
    info: (params) => <Banner params={params} theme={theme} width={toastWidth} tone="info" />,
    error: (params) => <Banner params={params} theme={theme} width={toastWidth} tone="error" />,
    message: (params: ToastConfigParams<MessageToastProps>) => (
      <Banner params={params} theme={theme} width={toastWidth} tone="message" message={params.props} />
    ),
  }), [theme, toastWidth]);

  return (
    <Toast
      config={config}
      position="top"
      topOffset={insets.top + 8}
      bottomOffset={insets.bottom + 10}
      visibilityTime={3800}
    />
  );
};

const styles = StyleSheet.create({
  banner: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
    }),
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: 16, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
});

export default AppToast;
