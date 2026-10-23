import React, { useState, useEffect } from 'react';
import { Linking, ScrollView, Share, StatusBar, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Button, Dialog, Portal, Surface, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import { useAuthContext } from '../context/AuthProvider';
import { API_ROUTES } from '@motionmeet/shared';
import api from '../api/client';
import { KeyboardResponsiveView } from '../components/KeyboardAwareScrollView';
import { getUserFacingError, logHandledError, showError } from '../utils/feedback';
import ScreenHeader from '../components/ScreenHeader';
import type { NavigationOnlyProps } from '../navigation/types';

type PrivacyPreferences = typeof DEFAULT_PREFS;
type PrivacyPreferenceKey = keyof PrivacyPreferences;

interface PrivacyResponse {
  privacy?: PrivacyPreferences;
}

interface SwitchRowProps {
  label: string;
  subtitle?: string;
  prefKey: PrivacyPreferenceKey;
  isLast?: boolean;
}

const DEFAULT_PREFS = {
  publicProfile: true,
  showWorkoutsOnFeed: true,
  allowFollowers: true,
  showInSearch: true,
  allowMessages: true,
};

const PrivacyScreen = ({ navigation }: NavigationOnlyProps) => {
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
    api.get<PrivacyResponse>(API_ROUTES.user.privacy)
      .then(({ data }) => {
        if (active && data?.privacy) setPrefs(data.privacy);
      })
      .catch((error) => {
        logHandledError('load-privacy', error);
        showError(
          t('common.error', 'Hata'),
          getUserFacingError(error, t('privacy.load_failed', 'Gizlilik ayarları yüklenemedi.')),
        );
      });
    return () => {
      active = false;
    };
  }, [t]);

  const toggle = async (key: PrivacyPreferenceKey) => {
    const previous = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      const { data } = await api.patch<PrivacyResponse>(API_ROUTES.user.privacy, {
        [key]: updated[key],
      });
      if (data?.privacy) setPrefs(data.privacy);
    } catch (error) {
      setPrefs(previous);
      logHandledError('save-privacy', error);
      showError(
        t('common.error', 'Hata'),
        getUserFacingError(error, t('privacy.save_failed', 'Gizlilik ayarı kaydedilemedi.')),
      );
    }
  };

  const handleDeleteAccount = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      setRequestPending(true);
      await api.delete(API_ROUTES.user.account, {
        data: { password: deletePassword },
      });
      setDeleteDialogOpen(false);
      setDeletePassword('');
      await signOut();
    } catch (error) {
      logHandledError('delete-account', error);
      showError(
        t('common.error', 'Hata'),
        getUserFacingError(error, t('privacy.delete_failed', 'Hesap silinemedi.')),
      );
    } finally {
      setRequestPending(false);
    }
  };

  const exportData = async () => {
    try {
      setRequestPending(true);
      const { data } = await api.get(API_ROUTES.user.export);
      await Share.share({
        title: `MotionMeet ${t('privacy.export_data', 'Veri Dışa Aktarımı')}`,
        message: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      });
    } catch (error) {
      logHandledError('export-account', error);
      showError(
        t('common.error', 'Hata'),
        getUserFacingError(error, t('privacy.export_failed', 'Veriler dışa aktarılamadı.')),
      );
    } finally {
      setRequestPending(false);
    }
  };

  const SwitchRow = ({ label, subtitle, prefKey, isLast = false }: SwitchRowProps) => (
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

      <ScreenHeader title={t('settings.privacy', 'Gizlilik')} onBack={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Visibility */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('privacy.profile_section', 'Profil görünürlüğü')}</Text>
          <Surface elevation={0} style={styles.card}>
            {/*
              This one switch decides who may see the account's posts, stories
              and open a chat, so it is spelled out as the two named choices
              rather than left as a generic toggle label.
            */}
            <Surface elevation={0} style={[styles.row, styles.rowBorder]}>
              <Surface elevation={0} style={styles.rowText}>
                <Text style={styles.rowLabel}>
                  {prefs.publicProfile
                    ? t('privacy.open_profile', 'Açık profil')
                    : t('privacy.closed_profile', 'Kapalı profil')}
                </Text>
                <Text style={styles.rowSub}>
                  {prefs.publicProfile
                    ? t('privacy.open_profile_sub', 'Herkes gönderilerini görebilir ve sana mesaj gönderebilir.')
                    : t('privacy.closed_profile_sub', 'Gönderilerini yalnızca onayladığın takipçiler görür. Mesaj için karşılıklı takip gerekir.')}
                </Text>
              </Surface>
              <Switch
                value={prefs.publicProfile}
                onValueChange={() => toggle('publicProfile')}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
                ios_backgroundColor={theme.border}
                accessibilityLabel={t('privacy.open_profile', 'Açık profil')}
              />
            </Surface>
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
          <Text style={styles.sectionLabel}>{t('privacy.workout_section', 'Antrenman')}</Text>
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
          <Text style={styles.sectionLabel}>{t('privacy.social_section', 'Sosyal')}</Text>
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
          <Text style={styles.sectionLabel}>{t('privacy.legal_section', 'Yasal')}</Text>
          <Surface elevation={0} style={styles.card}>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => Linking.openURL('https://motionmeet.app/privacy')}
            >
              <Text style={styles.rowLabel}>{t('privacy.privacy_policy', 'Gizlilik Politikası')}</Text>
              <Ionicons name="open-outline" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.row, styles.rowBorder]}
              onPress={() => Linking.openURL('https://motionmeet.app/terms')}
            >
              <Text style={styles.rowLabel}>{t('privacy.terms', 'Kullanım Koşulları')}</Text>
              <Ionicons name="open-outline" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={exportData} disabled={requestPending}>
              <Text style={styles.rowLabel}>{t('privacy.export_data', 'Verilerimi Dışa Aktar')}</Text>
              <Ionicons name="download-outline" size={18} color={theme.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
              <Text style={[styles.rowLabel, styles.dangerText]}>{t('privacy.delete_account', 'Hesabı Sil')}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ef4444" />
            </TouchableOpacity>
          </Surface>
        </Surface>
      </ScrollView>

      {deleteDialogOpen && <Portal>
        <KeyboardResponsiveView style={styles.dialogKeyboardView}>
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
        </KeyboardResponsiveView>
      </Portal>}
    </SafeAreaView>
  );
};

const getStyles = (theme: MotionTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 16.5,
    fontWeight: '700',
    color: theme.text,
  },
  section: { marginTop: 20 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: theme.textMuted,
    paddingHorizontal: 16, marginBottom: 2,
  },
  // Rows run the full width like the settings list they are opened from;
  // the rounded panels drew a box around every group of two switches.
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 11, minHeight: 52,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  rowText: { flex: 1, minWidth: 0, paddingRight: 12 },
  rowLabel: { flexShrink: 1, fontSize: 14.5, fontWeight: '400', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  passwordInput: { marginTop: 16 },
  dialogKeyboardView: { flex: 1, justifyContent: 'center' },
  headerRight: { width: 40 },
  scrollContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingBottom: 72,
  },
  dangerText: { color: '#ef4444' },
});

export default PrivacyScreen;
