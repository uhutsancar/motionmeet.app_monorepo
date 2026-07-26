import React, { useState, useEffect } from 'react';
import { ScrollView, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appbar, Surface, Switch, Text, useTheme as usePaperTheme, TouchableRipple } from 'react-native-paper';

const STORAGE_KEY = '@mm_notification_prefs';

const DEFAULT_PREFS = {
  newMessage: true,
};

const NotificationsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const paperTheme = usePaperTheme();
  const styles = getStyles(theme, paperTheme);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val) setPrefs(JSON.parse(val));
    });
  }, []);

  const toggle = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const SwitchRow = ({ label, subtitle, prefKey, isLast }) => (
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
    <Surface elevation={0} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
        <Appbar.Content title={t('settings.notifications', 'Bildirimler')} titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {sections.map((section) => (
          <Surface elevation={0} key={section.title} style={styles.section}>
            <Text variant="labelMedium" style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
            <Surface style={styles.card} elevation={0}>
              {section.items.map((item, i) => (
                <SwitchRow
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  prefKey={item.key}
                  isLast={i === section.items.length - 1}
                />
              ))}
            </Surface>
          </Surface>
        ))}
      </ScrollView>
    </Surface>
  );
};

const getStyles = (theme, paperTheme) => ({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.background,
    borderBottomWidth: 1, 
    borderBottomColor: theme.border,
    elevation: 0,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  section: { marginTop: 24 },
  sectionLabel: {
    fontWeight: '700', letterSpacing: 0.8, color: theme.textMuted,
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
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontWeight: '600', color: theme.text },
  rowSub: { color: theme.textMuted, marginTop: 2 },
});

export default NotificationsScreen;
