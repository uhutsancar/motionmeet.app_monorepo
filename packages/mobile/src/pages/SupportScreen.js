import React, { useState } from 'react';
import { ScrollView, StatusBar, Linking, LayoutAnimation, UIManager, Platform } from 'react-native';
import { Surface, TouchableRipple, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  { q: 'support.faq1_q', a: 'support.faq1_a', qFallback: 'Antrenman verilerim nerede saklanıyor?', aFallback: 'Tüm verileriniz güvenli bulut sunucularımızda şifrelenmiş olarak saklanır.' },
  { q: 'support.faq2_q', a: 'support.faq2_a', qFallback: 'Şifremi nasıl sıfırlarım?', aFallback: 'Şifre sıfırlama desteği için support@motionmeet.app adresinden bize ulaşabilirsiniz.' },
  { q: 'support.faq3_q', a: 'support.faq3_a', qFallback: 'Verilerimi dışa aktarabilir miyim?', aFallback: 'Evet. Ayarlar içindeki Gizlilik ve Veri bölümünden verilerinizi dışa aktarabilirsiniz.' },
  { q: 'support.faq4_q', a: 'support.faq4_a', qFallback: 'Uygulama hangi platformlarda çalışıyor?', aFallback: 'MotionMeet iOS, Android ve Web üzerinde kullanılabilir.' },
  { q: 'support.faq5_q', a: 'support.faq5_a', qFallback: 'Bildirimler gelmiyor, ne yapmalıyım?', aFallback: 'Ayarlar > Bildirimler bölümünden bildirimlerin açık olduğunu kontrol edin ve telefon bildirim izinlerini doğrulayın.' },
];

const FaqItem = ({ item, theme, styles }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  return (
    <TouchableRipple borderless style={styles.faqItem} onPress={handleToggle} activeOpacity={0.8}>
      <Surface elevation={0} style={styles.faqHeader}>
        <Text style={styles.faqQ}>{t(item.q, item.qFallback)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
      </Surface>
      {open && <Text style={styles.faqA}>{t(item.a, item.aFallback)}</Text>}
    </TouchableRipple>
  );
};

const SupportScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);

  const contactItems = [
    {
      icon: 'mail-outline', iconColor: '#3b82f6',
      label: t('support.email', 'E-posta Desteği'),
      subtitle: 'support@motionmeet.app',
      onPress: () => Linking.openURL('mailto:support@motionmeet.app'),
    },
    {
      icon: 'logo-twitter', iconColor: '#1da1f2',
      label: t('support.twitter', 'Twitter / X'),
      subtitle: '@motionmeetapp',
      onPress: () => Linking.openURL('https://twitter.com/motionmeetapp'),
    },
    {
      icon: 'globe-outline', iconColor: '#10b981',
      label: t('support.web', 'Web Sitesi'),
      subtitle: 'motionmeet.app',
      onPress: () => Linking.openURL('https://motionmeet.app'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Surface elevation={0} style={styles.header}>
        <TouchableRipple borderless style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableRipple>
        <Text style={styles.headerTitle}>{t('settings.support', 'Destek')}</Text>
        <Surface elevation={0} style={{ width: 40 }} />
      </Surface>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Contact */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('support.contact_section', 'İLETİŞİM')}</Text>
          <Surface elevation={0} style={styles.card}>
            {contactItems.map((item, i) => (
              <TouchableRipple borderless
                key={i}
                style={[styles.row, i !== contactItems.length - 1 && styles.rowBorder]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Surface elevation={0} style={styles.rowLeft}>
                  <Surface elevation={0} style={[styles.iconBox, { backgroundColor: theme.surfaceLight }]}>
                    <Ionicons name={item.icon} size={22} color={item.iconColor} />
                  </Surface>
                  <Surface elevation={0}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowSub}>{item.subtitle}</Text>
                  </Surface>
                </Surface>
                <Ionicons name="open-outline" size={16} color={theme.textMuted} />
              </TouchableRipple>
            ))}
          </Surface>
        </Surface>

        {/* FAQ */}
        <Surface elevation={0} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('support.faq_section', 'SIKÇA SORULAN SORULAR')}</Text>
          <Surface elevation={0} style={styles.card}>
            {FAQS.map((item, i) => (
              <Surface elevation={0} key={i} style={i !== FAQS.length - 1 && styles.rowBorder}>
                <FaqItem item={item} theme={theme} styles={styles} />
              </Surface>
            ))}
          </Surface>
        </Surface>

        {/* App version info */}
        <Surface elevation={0} style={styles.versionBox}>
          <Text style={styles.versionText}>MotionMeet v1.0.0</Text>
          <Text style={styles.versionSub}>© 2026 MotionMeet Studios</Text>
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: theme.text },
  rowSub: { fontSize: 12, color: theme.textMuted, marginTop: 1 },
  faqItem: { paddingHorizontal: 16, paddingVertical: 14 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  faqQ: { fontSize: 14, fontWeight: '600', color: theme.text, flex: 1 },
  faqA: { fontSize: 13, color: theme.textMuted, marginTop: 8, lineHeight: 20 },
  versionBox: { alignItems: 'center', marginTop: 32, gap: 4 },
  versionText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  versionSub: { fontSize: 12, color: theme.textMuted },
});

export default SupportScreen;
