import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useClerk } from '@clerk/clerk-expo';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const ROW_ICON_SIZE = 22;

/* ── Reusable setting row ── */
const SettingRow = ({ iconName, iconColor = '#888', label, subtitle, onPress, isLast, theme }) => (
  <TouchableOpacity
    style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.rowLeft}>
      <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
        <Ionicons name={iconName} size={ROW_ICON_SIZE} color={iconColor} />
      </View>
      <View>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: theme.textMuted }]}>{subtitle}</Text> : null}
      </View>
    </View>
    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
  </TouchableOpacity>
);

const Settings = ({ navigation }) => {
  const { signOut } = useClerk();
  const { t, i18n } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();

  const isTr = i18n.language.startsWith('tr');
  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settings.title', 'Ayarlar')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Account section */}
        <View style={styles.sectionLabel}>
          <Text style={[styles.sectionText, { color: theme.textMuted }]}>{t('settings.account', 'HESAP').toUpperCase()}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SettingRow
            iconName="person-outline" iconColor="#3b82f6"
            label={t('settings.account', 'Hesap')}
            subtitle={t('settings.account_sub', 'Profil, Güvenlik')}
            onPress={() => navigation.navigate('Profile')}
            theme={theme}
          />
          <SettingRow
            iconName="notifications-outline" iconColor="#f59e0b"
            label={t('settings.notifications', 'Bildirimler')}
            onPress={() => navigation.navigate('NotificationsScreen')}
            theme={theme}
          />
          <SettingRow
            iconName="lock-closed-outline" iconColor="#10b981"
            label={t('settings.privacy', 'Gizlilik')}
            subtitle={t('settings.privacy_sub', 'E-posta, Anlık')}
            onPress={() => navigation.navigate('PrivacyScreen')}
            theme={theme}
          />
          <SettingRow
            iconName="help-circle-outline" iconColor="#8b5cf6"
            label={t('settings.support', 'Destek')}
            onPress={() => navigation.navigate('SupportScreen')}
            isLast
            theme={theme}
          />
        </View>

        {/* Appearance section */}
        <View style={styles.sectionLabel}>
          <Text style={[styles.sectionText, { color: theme.textMuted }]}>{t('settings.appearance', 'GÖRÜNÜM').toUpperCase()}</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Theme toggle */}
          <View style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={ROW_ICON_SIZE} color={theme.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.theme', 'Tema')}</Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => isDark && toggleTheme()}
                style={[styles.toggleBtn, !isDark && [styles.toggleActive, { backgroundColor: theme.surface }]]}
              >
                <Text style={[styles.toggleText, { color: !isDark ? theme.primary : theme.textMuted }]}>
                  {t('settings.light', 'Açık')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => !isDark && toggleTheme()}
                style={[styles.toggleBtn, isDark && [styles.toggleActive, { backgroundColor: theme.surface }]]}
              >
                <Text style={[styles.toggleText, { color: isDark ? theme.primary : theme.textMuted }]}>
                  {t('settings.dark', 'Koyu')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Language toggle */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                <Ionicons name="globe" size={ROW_ICON_SIZE} color={theme.primary} />
              </View>
              <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings.language', 'Dil')}</Text>
            </View>
            <View style={[styles.toggle, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <TouchableOpacity
                onPress={() => changeLanguage('en')}
                style={[styles.toggleBtn, !isTr && [styles.toggleActive, { backgroundColor: theme.surface }]]}
              >
                <Text style={[styles.toggleText, { color: !isTr ? theme.primary : theme.textMuted }]}>EN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => changeLanguage('tr')}
                style={[styles.toggleBtn, isTr && [styles.toggleActive, { backgroundColor: theme.surface }]]}
              >
                <Text style={[styles.toggleText, { color: isTr ? theme.primary : theme.textMuted }]}>TR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Sign out button - matching mockup style */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: '#ef4444' }]}
          onPress={() => signOut()}
          activeOpacity={0.85}
        >
          <Text style={styles.signOutText}>{t('settings.logout', 'Çıkış Yap')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerTitle: { fontSize: 30, fontWeight: '800' },
  sectionLabel: { paddingHorizontal: 20, marginBottom: 8, marginTop: 16 },
  sectionText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  card: {
    marginHorizontal: 16, borderRadius: 20, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 1 },
  toggle: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 3,
  },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9 },
  toggleActive: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 3, elevation: 2,
  },
  toggleText: { fontSize: 12, fontWeight: '700' },
  signOutBtn: {
    marginHorizontal: 16, marginTop: 28,
    paddingVertical: 18, borderRadius: 60,
    alignItems: 'center', shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  signOutText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

export default Settings;
