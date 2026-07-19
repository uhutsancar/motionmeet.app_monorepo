import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Button, Divider, List, Switch, Text } from 'react-native-paper';
import { ScrollView } from 'react-native';
import { useAuthContext } from "../context/AuthProvider";
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const Settings = ({ navigation }) => {
  const { signOut } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();

  const isTr = i18n.language.startsWith('tr');
  const changeLanguage = (lng) => i18n.changeLanguage(lng);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <Appbar.Header style={{ backgroundColor: theme.surface, elevation: 0 }}>
        <Appbar.Content title={t('settings.title', 'Ayarlar')} titleStyle={{ color: theme.text, fontWeight: '800', fontSize: 26 }} />
      </Appbar.Header>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Account */}
        <List.Subheader style={{ color: theme.textMuted, letterSpacing: 0.8, fontWeight: '700' }}>
          {t('settings.account', 'HESAP').toUpperCase()}
        </List.Subheader>
        <Divider />
        <List.Item
          title={t('settings.account', 'Hesap')}
          description={t('settings.account_sub', 'Profil, Güvenlik')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          descriptionStyle={{ color: theme.textMuted }}
          left={(props) => <List.Icon {...props} icon="account-outline" color="#3b82f6" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          onPress={() => navigation.navigate('Profile')}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />
        <List.Item
          title={t('settings.plans', 'Plans & Pricing')}
          description={t('settings.plans_sub', 'Upgrade your experience')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          descriptionStyle={{ color: theme.textMuted }}
          left={(props) => <List.Icon {...props} icon="star-outline" color="#f43f5e" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          onPress={() => navigation.navigate('PricingScreen')}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />
        <List.Item
          title={t('settings.notifications', 'Bildirimler')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          left={(props) => <List.Icon {...props} icon="bell-outline" color="#f59e0b" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          onPress={() => navigation.navigate('NotificationsScreen')}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />
        <List.Item
          title={t('settings.privacy', 'Gizlilik')}
          description={t('settings.privacy_sub', 'E-posta, Anlık')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          descriptionStyle={{ color: theme.textMuted }}
          left={(props) => <List.Icon {...props} icon="lock-outline" color="#10b981" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          onPress={() => navigation.navigate('PrivacyScreen')}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />
        <List.Item
          title={t('settings.support', 'Destek')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          left={(props) => <List.Icon {...props} icon="help-circle-outline" color="#8b5cf6" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" color={theme.textMuted} />}
          onPress={() => navigation.navigate('SupportScreen')}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />

        {/* Appearance */}
        <List.Subheader style={{ color: theme.textMuted, letterSpacing: 0.8, fontWeight: '700', marginTop: 8 }}>
          {t('settings.appearance', 'GÖRÜNÜM').toUpperCase()}
        </List.Subheader>
        <Divider />
        <List.Item
          title={t('settings.theme', 'Tema')}
          description={isDark ? t('settings.dark', 'Koyu') : t('settings.light', 'Açık')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          descriptionStyle={{ color: theme.textMuted }}
          left={(props) => <List.Icon {...props} icon={isDark ? 'weather-night' : 'weather-sunny'} color={theme.primary} />}
          right={() => <Switch value={isDark} onValueChange={toggleTheme} color={theme.primary} style={{ alignSelf: 'center' }} />}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />
        <List.Item
          title={t('settings.language', 'Dil')}
          titleStyle={{ color: theme.text, fontWeight: '600' }}
          left={(props) => <List.Icon {...props} icon="web" color={theme.primary} />}
          right={() => (
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'center', marginRight: 4 }}>
              <Text
                onPress={() => changeLanguage('en')}
                style={{
                  color: !isTr ? theme.primary : theme.textMuted,
                  fontWeight: !isTr ? '800' : '500',
                  fontSize: 13,
                }}
              >
                EN
              </Text>
              <Text style={{ color: theme.border }}>|</Text>
              <Text
                onPress={() => changeLanguage('tr')}
                style={{
                  color: isTr ? theme.primary : theme.textMuted,
                  fontWeight: isTr ? '800' : '500',
                  fontSize: 13,
                }}
              >
                TR
              </Text>
            </View>
          )}
          style={{ backgroundColor: theme.surface }}
        />
        <Divider />

        {/* Sign out */}
        <View style={{ marginHorizontal: 16, marginTop: 32 }}>
          <Button
            mode="contained"
            onPress={() => signOut()}
            buttonColor="#ef4444"
            contentStyle={{ paddingVertical: 6 }}
            labelStyle={{ fontWeight: '800', fontSize: 16 }}
            style={{ borderRadius: 60 }}
          >
            {t('settings.logout', 'Çıkış Yap')}
          </Button>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;
