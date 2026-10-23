import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { ICON, TYPE } from '../config/layout';

export interface ScreenHeaderAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  /** Drawn as a small dot over the icon, for anything unread. */
  badge?: boolean;
  tint?: string;
}

/** A word in the header's trailing edge: "Kaydet", "Bitti". */
export interface ScreenHeaderTextAction {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}

interface ScreenHeaderProps {
  title: string;
  /** Shows a leading control when given: a back chevron, or a close X. */
  onBack?: () => void;
  /** Which leading icon to draw. A sheet closes; a screen goes back. */
  backIcon?: 'back' | 'close';
  actions?: ScreenHeaderAction[];
  /** The screen's one confirming action, as accent text at the far edge. */
  textAction?: ScreenHeaderTextAction;
  /** Arbitrary content at the trailing edge, for the rare screen that needs a
      real button rather than an icon — saving a workout, for instance. */
  trailing?: React.ReactNode;
  /** Anything that should sit where the title is, instead of the title. */
  children?: React.ReactNode;
  /** A tab's own screen: a larger title and no back control. */
  large?: boolean;
  /** Content has scrolled under the header: its hairline fades in. */
  scrolled?: boolean;
  style?: ViewStyle;
}

/** Comfortably tappable without taking a bite out of the screen. */
export const SCREEN_HEADER_HEIGHT = 44;

/**
 * The bar at the top of a screen.
 *
 * 44 points, the same as Instagram's, with the title at 16.5pt beside the
 * back chevron. There is no rule under it at rest: the header and the page
 * read as one surface, and a hairline fades in only once content scrolls under
 * it (`scrolled`, from `useScrollEdge`). The edges carry the screen's own
 * actions - a settings gear, an add button, "Kaydet" - so a header is never a
 * band that holds nothing but a back arrow and a title.
 */
const ScreenHeader = ({
  title,
  onBack,
  backIcon = 'back',
  actions,
  textAction,
  trailing,
  children,
  large = false,
  scrolled = false,
  style,
}: ScreenHeaderProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const edge = useRef(new Animated.Value(scrolled ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(edge, { toValue: scrolled ? 1 : 0, duration: 160, useNativeDriver: true }).start();
  }, [edge, scrolled]);

  return (
    <View style={[styles.header, { backgroundColor: theme.background }, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={({ pressed }) => [styles.iconButton, styles.leading, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={
            backIcon === 'close' ? t('common.close', 'Kapat') : t('common.back', 'Geri')
          }
        >
          <Ionicons
            name={backIcon === 'close' ? 'close' : 'chevron-back'}
            size={backIcon === 'close' ? ICON.header : ICON.header + 1}
            color={theme.text}
          />
        </Pressable>
      ) : null}

      {children ?? (
        <Text
          numberOfLines={1}
          accessibilityRole="header"
          style={[
            large ? styles.largeTitle : styles.title,
            { color: theme.text },
            !onBack && styles.titleAlone,
          ]}
        >
          {title}
        </Text>
      )}

      {trailing}

      {actions?.length ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.accessibilityLabel}
              onPress={action.onPress}
              hitSlop={6}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
            >
              <Ionicons name={action.icon} size={ICON.header} color={action.tint ?? theme.text} />
              {action.badge ? (
                <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {textAction ? (
        <Pressable
          onPress={textAction.onPress}
          disabled={textAction.disabled || textAction.busy}
          hitSlop={8}
          style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={textAction.label}
          accessibilityState={{ busy: Boolean(textAction.busy), disabled: Boolean(textAction.disabled) }}
        >
          {textAction.busy ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Text
              style={[
                styles.textActionLabel,
                { color: textAction.disabled ? theme.textMuted : theme.primary },
              ]}
            >
              {textAction.label}
            </Text>
          )}
        </Pressable>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[styles.edge, { backgroundColor: theme.border, opacity: edge }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 2,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: TYPE.title,
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  largeTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: TYPE.rootTitle,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  titleAlone: {
    paddingLeft: 10,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leading: {
    marginRight: 2,
  },
  pressed: {
    opacity: 0.55,
  },
  textAction: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textActionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});

export default ScreenHeader;
