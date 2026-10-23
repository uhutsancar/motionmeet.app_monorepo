import React, { useState, useEffect } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Surface, Switch, Text, useTheme as usePaperTheme } from 'react-native-paper';
import { logHandledError, showError } from '../utils/feedback';
import type { MD3Theme } from 'react-native-paper';
import type { NavigationOnlyProps } from '../navigation/types';

const STORAGE_KEY = '@mm_notification_prefs';

const DEFAULT_PREFS = {
  newMessage: true,
};

type NotificationPreferences = typeof DEFAULT_PREFS;
type NotificationPreferenceKey = keyof NotificationPreferences;

interface SwitchRowProps {
  label: string;
  subtitle?: string;
  prefKey: NotificationPreferenceKey;
  isLast?: boolean;
}

const NotificationsScreen = ({ navigation }: NavigationOnlyProps) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const styles = getStyles(theme, paperTheme);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!active || !value) return;
        const parsed: Partial<NotificationPreferences> = JSON.parse(value);
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      })
      .catch((error) => logHandledError('load-notification-preferences', error));
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (key: NotificationPreferenceKey) => {
    const previous = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      setPrefs(previous);
      logHandledError('save-notification-preferences', error);
      showError(
        t('common.error', 'Hata'),
        t('settings.save_failed', 'Ayar kaydedilemedi'),
      );
    }
  };

  const SwitchRow = ({ label, subtitle, prefKey, isLast = false }: SwitchRowProps) => (
    <Surface elevation={0} style={[styles.row, !isLast && styles.rowBorder]}>
      <Surface elevation={0} style={styles.rowText}>
        <Text variant="titleMedium" style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text variant="bodySmall" style={styles.rowSub}>{subtitle}</Text> : null}
      </Surface>
      <Switch
        value={prefs[prefKey]}
        onValueChange={() => toggle(prefKey)}
        color={theme.primary}
      />
    </Surface>
  );

  const sections = [
    {
      title: t('notifications.social', 'Sosyal'),
      items: [
        {
          key: 'newMessage',
          label: t('notifications.new_message', 'Yeni Mesaj'),
          subtitle: t('notifications.in_app_message_sub', 'Yeni mesajlar için uygulama içi bildirim göster'),
        },
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScreenHeader
        title={t('settings.notifications', 'Bildirimler')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sections.map((section) => (
          <Surface elevation={0} key={section.title} style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>{section.title}</Text>
            <Surface style={styles.card} elevation={0}>
              {section.items.map((item, i) => (
                <SwitchRow
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  prefKey={item.key as NotificationPreferenceKey}
                  isLast={i === section.items.length - 1}
                />
              ))}
            </Surface>
          </Surface>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme, _paperTheme: MD3Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.background,
    borderBottomWidth: 1, 
    borderBottomColor: theme.border,
    elevation: 0,
  },
  headerTitle: { fontSize: 16.5, fontWeight: '700', color: theme.text },
  scrollContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 40,
  },
  section: { marginTop: 24 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: theme.textMuted,
    paddingHorizontal: 20, marginBottom: 8,
  },
  card: {
    marginHorizontal: 16, backgroundColor: theme.surface, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowText: { flex: 1, minWidth: 0, paddingRight: 12 },
  rowLabel: { fontWeight: '600', color: theme.text },
  rowSub: { color: theme.textMuted, marginTop: 2 },
});

export default NotificationsScreen;
