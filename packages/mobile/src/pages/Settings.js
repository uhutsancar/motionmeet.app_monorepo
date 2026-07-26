import React from 'react';
import { ScrollView, StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Appbar,
  Button,
  Divider,
  List,
  Surface,
  Switch,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import { useAuthContext } from '../context/AuthProvider';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

const SettingsSection = ({ title, children, theme }) => (
  <View style={{ gap: 9 }}>
    <Text style={{
      color: theme.textMuted,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.2,
      marginLeft: 4,
    }}>
      {title}
    </Text>
    <Surface
      elevation={0}
      style={{
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
      }}
    >
      {children}
    </Surface>
  </View>
);

const SettingsRow = ({
  icon,
  iconColor,
  title,
  description,
  onPress,
  right,
  theme,
}) => (
  <TouchableRipple onPress={onPress} disabled={!onPress}>
    <View style={{
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 11,
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${iconColor}18`,
      }}>
        <List.Icon icon={icon} color={iconColor} style={{ margin: 0 }} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
          {title}
        </Text>
        {description ? (
          <Text style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2 }}>
            {description}
          </Text>
        ) : null}
      </View>
      {right || (onPress ? <List.Icon icon="chevron-right" color={theme.textMuted} style={{ margin: 0 }} /> : null)}
    </View>
  </TouchableRipple>
);

const Settings = ({ navigation }) => {
  const { signOut } = useAuthContext();
  const { t, i18n } = useTranslation();
  const { theme, isDark, toggleTheme } = useTheme();
  const isTr = i18n.language.startsWith('tr');

  const languageControl = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 3,
      borderRadius: 11,
      backgroundColor: theme.surfaceLight,
    }}>
      {['en', 'tr'].map((language) => {
        const active = language === (isTr ? 'tr' : 'en');
        return (
          <TouchableRipple
            key={language}
            borderless
            onPress={() => i18n.changeLanguage(language)}
            style={{
              minWidth: 38,
              height: 30,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.surface : 'transparent',
            }}
          >
            <Text style={{
              color: active ? theme.primary : theme.textMuted,
              fontSize: 11,
              fontWeight: '900',
            }}>
              {language.toUpperCase()}
            </Text>
          </TouchableRipple>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Appbar.Header statusBarHeight={0} style={{
        backgroundColor: theme.surface,
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}>
        <Appbar.Content
          title={t('settings.title', 'Settings')}
          titleStyle={{ color: theme.text, fontWeight: '800', fontSize: 23 }}
        />
      </Appbar.Header>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          padding: 16,
          paddingBottom: 32,
          gap: 20,
        }}
      >
        <View>
          <Text style={{ color: theme.text, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 }}>
            Make MotionMeet yours
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            Manage your account, privacy and app experience.
          </Text>
        </View>

        <SettingsSection title={t('settings.account', 'ACCOUNT').toUpperCase()} theme={theme}>
          <SettingsRow
            icon="account-outline"
            iconColor={theme.primary}
            title={t('settings.account', 'Account')}
            description={t('settings.account_sub', 'Profile and security')}
            onPress={() => navigation.navigate('ProfileEdit')}
            theme={theme}
          />
          <Divider />
          <SettingsRow
            icon="star-outline"
            iconColor={theme.warning}
            title={t('settings.plans', 'Plans & pricing')}
            description={t('settings.plans_sub', 'Upgrade your experience')}
            onPress={() => navigation.navigate('PricingScreen')}
            theme={theme}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.preferences', 'PREFERENCES').toUpperCase()} theme={theme}>
          <SettingsRow
            icon="bell-outline"
            iconColor={theme.warning}
            title={t('settings.notifications', 'Notifications')}
            description={t('settings.notifications_sub', 'Reminders and activity')}
            onPress={() => navigation.navigate('NotificationsScreen')}
            theme={theme}
          />
          <Divider />
          <SettingsRow
            icon="lock-outline"
            iconColor={theme.secondary}
            title={t('settings.privacy', 'Privacy')}
            description={t('settings.privacy_sub', 'Visibility and data')}
            onPress={() => navigation.navigate('PrivacyScreen')}
            theme={theme}
          />
          <Divider />
          <SettingsRow
            icon={isDark ? 'weather-night' : 'weather-sunny'}
            iconColor={theme.primary}
            title={t('settings.theme', 'Theme')}
            description={isDark ? t('settings.dark', 'Dark') : t('settings.light', 'Light')}
            right={<Switch value={isDark} onValueChange={toggleTheme} color={theme.primary} />}
            theme={theme}
          />
          <Divider />
          <SettingsRow
            icon="web"
            iconColor={theme.secondary}
            title={t('settings.language', 'Language')}
            right={languageControl}
            theme={theme}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.support', 'SUPPORT').toUpperCase()} theme={theme}>
          <SettingsRow
            icon="help-circle-outline"
            iconColor={theme.primary}
            title={t('settings.support', 'Help & support')}
            description="FAQs and contact"
            onPress={() => navigation.navigate('SupportScreen')}
            theme={theme}
          />
        </SettingsSection>

        <Button
          mode="outlined"
          icon="logout"
          textColor={theme.danger}
          onPress={() => signOut()}
          contentStyle={{ minHeight: 50 }}
          labelStyle={{ fontWeight: '900' }}
          style={{ borderRadius: 10, borderColor: `${theme.danger}55` }}
        >
          {t('settings.logout', 'Sign out')}
        </Button>

        <Text style={{ color: theme.textMuted, textAlign: 'center', fontSize: 10.5 }}>
          MotionMeet v1.0.0 · © 2026 MotionMeet Studios
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;
