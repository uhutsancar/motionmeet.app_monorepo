import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

export interface ScreenHeaderAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  /** Drawn as a small dot over the icon, for anything unread. */
  badge?: boolean;
  tint?: string;
}

interface ScreenHeaderProps {
  title: string;
  /** Shows a leading control when given: a back chevron, or a close X. */
  onBack?: () => void;
  /** Which leading icon to draw. A sheet closes; a screen goes back. */
  backIcon?: 'back' | 'close';
  actions?: ScreenHeaderAction[];
  /** Arbitrary content at the trailing edge, for the rare screen that needs a
      real button rather than an icon — saving a workout, for instance. */
  trailing?: React.ReactNode;
  /** Anything that should sit where the title is, instead of the title. */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/** Comfortably tappable without taking a bite out of the screen. */
export const SCREEN_HEADER_HEIGHT = 48;

/**
 * The bar at the top of a screen.
 *
 * Paper's `Appbar.Header` is 64 points tall before its own status-bar padding,
 * and every screen that used one also drew a rule under it — so on a phone the
 * chrome above the content was most of a thumb's width, on every screen, before
 * anything had been shown. This is 48 points with no rule at all: the title
 * sits in the same optical line as the actions, the content starts immediately
 * beneath it, and the eye reads the two as one surface rather than as a header
 * stacked on a page.
 *
 * Nothing here is decorative. A back chevron appears only when there is
 * somewhere to go back to, and actions are icons rather than labelled buttons.
 */
const ScreenHeader = ({
  title,
  onBack,
  backIcon = 'back',
  actions,
  trailing,
  children,
  style,
}: ScreenHeaderProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={
            backIcon === 'close' ? t('common.close', 'Kapat') : t('common.back', 'Geri')
          }
        >
          <Ionicons
            name={backIcon === 'close' ? 'close' : 'chevron-back'}
            size={backIcon === 'close' ? 24 : 25}
            color={theme.text}
          />
        </Pressable>
      ) : null}

      {children ?? (
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.text }, onBack ? styles.titleWithBack : null]}
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
              hitSlop={10}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
            >
              <Ionicons name={action.icon} size={22} color={action.tint ?? theme.text} />
              {action.badge ? (
                <View style={[styles.badge, { backgroundColor: theme.danger }]} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    height: SCREEN_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 2,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  titleWithBack: {
    paddingHorizontal: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default ScreenHeader;
