import React, { useState, useEffect } from 'react';
import { ScrollView, Switch, StatusBar, Alert, Linking } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mm_privacy_prefs';

const DEFAULT_PREFS = {
  publicProfile: true,
  showWorkoutsOnFeed: true,
  allowFollowers: true,
  showInSearch: true,
  allowMessages: true,
};

const PrivacyScreen = ({ navigation }) => {
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

  const handleDeleteAccount = () => {
    Alert.alert(
      t('privacy.delete_account', 'Hesabı Sil'),
      t('privacy.delete_confirm', 'Bu işlem geri alınamaz. Tüm verileriniz silinecek.'),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('privacy.delete_btn', 'Sil'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('privacy.contact_support', 'Hesap silmek için lütfen destek ile iletişime geçin: support@motionmeet.app'));
          }
        },
      ]
    );
  };

  const SwitchRow = ({ label, subtitle, prefKey, isLast }) => (
    <Surface elevation={0} style={[styles.row, !isLast && styles.rowBorder]}>
      <Surface elevation={0} style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </Surface>
      <Switch
        value={prefs[prefKey]}
        onValueChange={() => toggle(prefKey)}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor="#fff"
        ios_backgroundColor={theme.border}
      />
    </Surface>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('settings.privacy', 'Gizlilik')}</Text>
        <Surface elevation={0} style={{ width: 40 }} />
      </Surface>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Visibility */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('privacy.profile_section', 'PROFİL GÖRÜNÜRLÜĞü').toUpperCase()}</Text>
          <Surface elevation={0} style={styles.card}>
            <SwitchRow
              label={t('privacy.public_profile', 'Genel Profil')}
              subtitle={t('privacy.public_sub', 'Profiliniz herkes tarafından görülür')}
              prefKey="publicProfile"
            />
            <SwitchRow
              label={t('privacy.show_in_search', 'Aramada Göster')}
              subtitle={t('privacy.search_sub', 'Arama sonuçlarında görün')}
              prefKey="showInSearch"
              isLast
            />
          </Surface>
        </Surface>

        {/* Workout Privacy */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('privacy.workout_section', 'ANTRENMAN').toUpperCase()}</Text>
          <Surface elevation={0} style={styles.card}>
            <SwitchRow
              label={t('privacy.workouts_on_feed', 'Antrenmanları Akışta Göster')}
              subtitle={t('privacy.feed_sub', 'Takipçileriniz antrenmanlarınızı görebilir')}
              prefKey="showWorkoutsOnFeed"
              isLast
            />
          </Surface>
        </Surface>

        {/* Social Privacy */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('privacy.social_section', 'SOSYAL').toUpperCase()}</Text>
          <Surface elevation={0} style={styles.card}>
            <SwitchRow
              label={t('privacy.allow_followers', 'Takipçilere İzin Ver')}
              subtitle={t('privacy.followers_sub', 'Hesabınızı takip edebilenler')}
              prefKey="allowFollowers"
            />
            <SwitchRow
              label={t('privacy.allow_messages', 'Mesajlara İzin Ver')}
              subtitle={t('privacy.messages_sub', 'Bağlantılarınız size mesaj atabilir')}
              prefKey="allowMessages"
              isLast
            />
          </Surface>
        </Surface>

        {/* Links */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('privacy.legal_section', 'YASAL').toUpperCase()}</Text>
          <Surface elevation={0} style={styles.card}>
            <TouchableRipple borderless
              style={[styles.row, styles.rowBorder]}
              onPress={() => Linking.openURL('https://motionmeet.app/privacy')}
            >
              <Text style={styles.rowLabel}>{t('privacy.privacy_policy', 'Gizlilik Politikası')}</Text>
              <Ionicons name="open-outline" size={18} color={theme.textMuted} />
            </TouchableRipple>
            <TouchableRipple borderless
              style={[styles.row, styles.rowBorder]}
              onPress={() => Linking.openURL('https://motionmeet.app/terms')}
            >
              <Text style={styles.rowLabel}>{t('privacy.terms', 'Kullanım Koşulları')}</Text>
              <Ionicons name="open-outline" size={18} color={theme.textMuted} />
            </TouchableRipple>
            <TouchableRipple borderless style={styles.row} onPress={handleDeleteAccount}>
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>{t('privacy.delete_account', 'Hesabı Sil')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ef4444" />
            </TouchableRipple>
          </Surface>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
};

const getStyles = (theme) => ({
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

export default PrivacyScreen;
