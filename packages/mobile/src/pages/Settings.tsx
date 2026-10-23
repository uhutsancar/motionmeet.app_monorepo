import React from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Switch, Text, TouchableRipple } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useAuthContext } from '../context/AuthProvider';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';
import { useScrollEdge } from '../hooks/useScrollEdge';
import { ICON, TYPE } from '../config/layout';
import type { NavigationOnlyProps } from '../navigation/types';

interface SettingsSectionProps extends React.PropsWithChildren {
  title: string;
  theme: MotionTheme;
}

interface SettingsRowProps {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  theme: MotionTheme;
  /** Suppresses the hairline above the first row of a group. */
  first?: boolean;
}

/**
 * One group of settings.
 *
 * Deliberately not a card. Boxing each group in an outlined surface pushed the
 * content into a column narrower than the screen and drew four hard edges
 * around rows that are already visually grouped by their heading and the gap
 * above it. The rows now run the full width, and the only rule anywhere is the
 * hairline between two of them.
 */
const SettingsSection = ({ title, children, theme }: SettingsSectionProps) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title}</Text>
    <View>{children}</View>
  </View>
);

const SettingsRow = ({ icon, title, description, onPress, right, theme, first }: SettingsRowProps) => (
  <TouchableRipple onPress={onPress} disabled={!onPress}>
    <View
      style={[
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={ICON.row + 1}
        color={theme.textSecondary}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.rowDescription, { color: theme.textMuted }]} numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
      {right ||
        (onPress ? (
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textMuted} />
        ) : null)}
    </View>
  </TouchableRipple>
);

const Settings = ({ navigation }: NavigationOnlyProps) => {
  const { signOut } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();
  const isTr = i18n.language.startsWith('tr');
  const headerEdge = useScrollEdge();

  const languageControl = (
    <View style={[styles.languageSwitch, { backgroundColor: theme.surfaceLight }]}>
      {['en', 'tr'].map((language) => {
        const active = language === (isTr ? 'tr' : 'en');
        return (
          <TouchableRipple
            key={language}
            borderless
            onPress={() => i18n.changeLanguage(language)}
            style={[styles.languageOption, active && { backgroundColor: theme.surface }]}
          >
            <Text
              style={[styles.languageLabel, { color: active ? theme.primary : theme.textMuted }]}
            >
              {language.toUpperCase()}
            </Text>
          </TouchableRipple>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background }}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScreenHeader
        title={t('settings.title', 'Settings')}
        onBack={() => navigation.goBack()}
        scrolled={headerEdge.scrolled}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={headerEdge.onScroll}
        scrollEventThrottle={headerEdge.scrollEventThrottle}
      >
        <SettingsSection title={t('settings.account', 'Hesap')} theme={theme}>
          <SettingsRow
            first
            icon="account-outline"
            title={t('settings.account', 'Account')}
            description={t('settings.account_sub', 'Profile and security')}
            onPress={() => navigation.navigate('ProfileEdit')}
            theme={theme}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.preferences', 'Tercihler')} theme={theme}>
          <SettingsRow
            first
            icon="bell-outline"
            title={t('settings.notifications', 'Notifications')}
            description={t('settings.notifications_sub', 'Reminders and activity')}
            onPress={() => navigation.navigate('NotificationsScreen')}
            theme={theme}
          />
          <SettingsRow
            icon="lock-outline"
            title={t('settings.privacy', 'Privacy')}
            description={t('settings.privacy_sub', 'Visibility and data')}
            onPress={() => navigation.navigate('PrivacyScreen')}
            theme={theme}
          />
          <SettingsRow
            icon="map-marker-outline"
            title={t('settings.location', 'Location & Nearby')}
            description={t('settings.location_sub', 'Profile place, visibility and stored position')}
            onPress={() => navigation.navigate('LocationSettingsScreen')}
            theme={theme}
          />
          <SettingsRow
            icon={isDark ? 'weather-night' : 'weather-sunny'}
            title={t('settings.theme', 'Theme')}
            description={isDark ? t('settings.dark', 'Dark') : t('settings.light', 'Light')}
            right={<Switch value={isDark} onValueChange={toggleTheme} color={theme.primary} />}
            theme={theme}
          />
          <SettingsRow
            icon="web"
            title={t('settings.language', 'Language')}
            right={languageControl}
            theme={theme}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.support', 'Destek')} theme={theme}>
          <SettingsRow
            first
            icon="help-circle-outline"
            title={t('settings.support', 'Help & support')}
            description={t('support.subtitle', 'FAQs and contact')}
            onPress={() => navigation.navigate('SupportScreen')}
            theme={theme}
          />
          {/* Both bundled datasets require their notice to stay reachable in
              released builds; see docs/LICENSES.md. */}
          <SettingsRow
            icon="license"
            title={t('licenses.title', 'Data & licences')}
            description={t('licenses.subtitle', 'Open data sources used by MotionMeet')}
            onPress={() => navigation.navigate('LicensesScreen')}
            theme={theme}
          />
        </SettingsSection>

        <Pressable
          onPress={() => signOut()}
          style={styles.signOut}
          accessibilityRole="button"
          accessibilityLabel={t('settings.logout', 'Sign out')}
        >
          <Text style={[styles.signOutLabel, { color: theme.danger }]}>
            {t('settings.logout', 'Sign out')}
          </Text>
        </Pressable>

        {/* Read from the app config rather than hardcoded, so a version bump
            cannot leave this line claiming an older build. */}
        <Text style={[styles.version, { color: theme.textMuted }]}>
          MotionMeet v{Constants.expoConfig?.version ?? '—'} · © 2026 MotionMeet Studios
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingTop: 4,
    paddingBottom: 32,
    gap: 22,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontSize: TYPE.row,
    fontWeight: '400',
  },
  rowDescription: {
    fontSize: TYPE.meta,
  },
  languageSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 11,
  },
  languageOption: {
    minWidth: 38,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  signOut: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    fontSize: TYPE.row,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
  },
});

export default Settings;
