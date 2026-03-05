import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mm_notification_prefs';

const DEFAULT_PREFS = {
  pushEnabled: true,
  newFollower: true,
  postLike: true,
  postComment: true,
  newMessage: true,
  workoutReminder: false,
  weeklyReport: true,
};

const NotificationsScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
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
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={prefs[prefKey]}
        onValueChange={() => toggle(prefKey)}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#fff"
        ios_backgroundColor={theme.border}
      />
    </View>
  );

  const sections = [
    {
      title: t('notifications.general', 'Genel'),
      items: [
        { key: 'pushEnabled', label: t('notifications.push', 'Anlık Bildirimler'), subtitle: t('notifications.push_sub', 'Tüm bildirimleri aç veya kapat') },
      ]
    },
    {
      title: t('notifications.social', 'Sosyal'),
      items: [
        { key: 'newFollower', label: t('notifications.new_follower', 'Yeni Takipçi') },
        { key: 'postLike', label: t('notifications.post_like', 'Gönderi Beğenisi') },
        { key: 'postComment', label: t('notifications.post_comment', 'Gönderi Yorumu') },
        { key: 'newMessage', label: t('notifications.new_message', 'Yeni Mesaj') },
      ]
    },
    {
      title: t('notifications.workout', 'Antrenman'),
      items: [
        { key: 'workoutReminder', label: t('notifications.workout_reminder', 'Antrenman Hatırlatıcısı'), subtitle: t('notifications.reminder_sub', 'Günlük antrenman hatırlatması') },
        { key: 'weeklyReport', label: t('notifications.weekly_report', 'Haftalık Rapor'), subtitle: t('notifications.weekly_sub', 'Her Pazartesi gönderilir') },
      ]
    }
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.notifications', 'Bildirimler')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionLabel}>{section.title.toUpperCase()}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <SwitchRow
                  key={item.key}
                  label={item.label}
                  subtitle={item.subtitle}
                  prefKey={item.key}
                  isLast={i === section.items.length - 1}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
  section: { marginTop: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: theme.textMuted,
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
  rowLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
});

export default NotificationsScreen;
