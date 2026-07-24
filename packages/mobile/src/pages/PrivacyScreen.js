import React, { useState, useEffect } from 'react';
import { Alert, Linking, ScrollView, Share, StatusBar, StyleSheet, Switch } from 'react-native';
import { Button, Dialog, Portal, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import api from '../api/client';

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
  const { signOut } = useAuthContext();
  const styles = getStyles(theme);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [requestPending, setRequestPending] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/api/user/privacy')
      .then(({ data }) => {
        if (active && data?.privacy) setPrefs(data.privacy);
      })
      .catch((error) => {
        Alert.alert(
          t('common.error', 'Hata'),
          error.response?.data?.message || t('privacy.load_failed', 'Gizlilik ayarları yüklenemedi.')
        );
      });
    return () => {
      active = false;
    };
  }, [t]);

  const toggle = async (key) => {
    const previous = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      const { data } = await api.patch('/api/user/privacy', {
        [key]: updated[key],
      });
      if (data?.privacy) setPrefs(data.privacy);
    } catch (error) {
      setPrefs(previous);
      Alert.alert(
        t('common.error', 'Hata'),
        error.response?.data?.message || t('privacy.save_failed', 'Gizlilik ayarı kaydedilemedi.')
      );
    }
  };

  const handleDeleteAccount = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      setRequestPending(true);
      await api.delete('/api/user/account', {
        data: { password: deletePassword },
      });
      setDeleteDialogOpen(false);
      setDeletePassword('');
      await signOut();
    } catch (error) {
      Alert.alert(
        t('common.error', 'Hata'),
        error.response?.data?.message || t('privacy.delete_failed', 'Hesap silinemedi.')
      );
    } finally {
      setRequestPending(false);
    }
  };

  const exportData = async () => {
    try {
      setRequestPending(true);
      const { data } = await api.get('/api/user/export');
      await Share.share({
        title: `MotionMeet ${t('privacy.export_data', 'Veri Dışa Aktarımı')}`,
        message: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      });
    } catch (error) {
      Alert.alert(
        t('common.error', 'Hata'),
        error.response?.data?.message || t('privacy.export_failed', 'Veriler dışa aktarılamadı.')
      );
    } finally {
      setRequestPending(false);
    }
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
            <TouchableRipple borderless style={[styles.row, styles.rowBorder]} onPress={exportData} disabled={requestPending}>
              <Text style={styles.rowLabel}>{t('privacy.export_data', 'Verilerimi Dışa Aktar')}</Text>
              <Ionicons name="download-outline" size={18} color={theme.textMuted} />
            </TouchableRipple>
            <TouchableRipple borderless style={styles.row} onPress={handleDeleteAccount}>
              <Text style={[styles.rowLabel, { color: '#ef4444' }]}>{t('privacy.delete_account', 'Hesabı Sil')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ef4444" />
            </TouchableRipple>
          </Surface>
        </Surface>
      </ScrollView>

      <Portal>
        <Dialog visible={deleteDialogOpen} onDismiss={() => setDeleteDialogOpen(false)}>
          <Dialog.Title>{t('privacy.delete_account', 'Hesabı Sil')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('privacy.delete_confirm', 'Bu işlem geri alınamaz. Tüm verileriniz silinecek.')}</Text>
            <TextInput
              mode="outlined"
              secureTextEntry
              autoComplete="current-password"
              label={t('auth.password', 'Şifre')}
              value={deletePassword}
              onChangeText={setDeletePassword}
              style={styles.passwordInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogOpen(false)}>
              {t('common.cancel', 'İptal')}
            </Button>
            <Button
              textColor="#ef4444"
              loading={requestPending}
              disabled={!deletePassword || requestPending}
              onPress={confirmDeleteAccount}
            >
              {t('privacy.delete_btn', 'Sil')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  passwordInput: { marginTop: 16 },
});

export default PrivacyScreen;
