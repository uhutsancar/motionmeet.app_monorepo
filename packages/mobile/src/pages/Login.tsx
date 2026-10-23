import React, { useMemo, useRef, useState } from 'react';
import {
  Linking,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import MotionLogo from '../components/MotionLogo';
import { WEB_URL } from '../config/environment';
import KeyboardAwareScrollView from '../components/KeyboardAwareScrollView';
import { showError } from '../utils/feedback';
import { AUTH_LIMITS, hasValidPasswordByteLength } from '@motionmeet/shared';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

interface LoginFormData {
  email: string;
  password: string;
  username: string;
  full_name: string;
}

const Login = () => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { login, register } = useAuthContext();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: '',
  });

  const styles = useMemo(() => createStyles(theme), [theme]);
  // Each field's return key moves to the next one and the last one submits,
  // so the form can be filled without reaching past the keyboard.
  const usernameRef = useRef<NativeTextInput>(null);
  const emailRef = useRef<NativeTextInput>(null);
  const passwordRef = useRef<NativeTextInput>(null);

  const updateField = (field: keyof LoginFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    const required = isLogin
      ? [formData.email, formData.password]
      : [formData.email, formData.password, formData.username, formData.full_name];

    if (required.some((value) => !value.trim())) {
      showError(
        t('auth.error_missing_title'),
        isLogin ? t('auth.error_missing_signin') : t('auth.error_missing_signup'),
      );
      return;
    }
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > AUTH_LIMITS.email) {
      showError(t('auth.error_email_title'), t('auth.error_email_body'));
      return;
    }
    if (!isLogin) {
      const normalizedUsername = formData.username.trim().toLowerCase();
      const normalizedName = formData.full_name.trim();
      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        showError(
          t('auth.error_username_title'),
          t('auth.error_username_body'),
        );
        return;
      }
      if (
        normalizedName.length < AUTH_LIMITS.fullNameMin ||
        normalizedName.length > AUTH_LIMITS.fullNameMax
      ) {
        showError(t('auth.error_name_title'), t('auth.error_name_body'));
        return;
      }
      if (!hasValidPasswordByteLength(formData.password)) {
        showError(t('auth.error_password_title'), t('auth.error_password_body'));
        return;
      }
    }

    setLoading(true);
    try {
      const result = isLogin
        ? await login(normalizedEmail, formData.password)
        : await register({
          ...formData,
          email: normalizedEmail,
          username: formData.username.trim().toLowerCase(),
          full_name: formData.full_name.trim(),
        });

      if (!result.success) {
        showError(t('auth.error_failed_title'), result.message || t('auth.error_failed_body'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextIsLogin: boolean) => {
    setIsLogin(nextIsLogin);
    setPasswordVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          extraScrollHeight={24}
        >
          <View style={styles.brandRow}>
            {/* The one lockup, so the sign-in screen and the app header show
                the logo at the same proportions rather than two near-misses. */}
            <MotionLogo size={44} />
          </View>
          <Text style={styles.brandTag}>{t('auth.tagline')}</Text>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>
              {isLogin ? t('auth.eyebrow_signin') : t('auth.eyebrow_signup')}
            </Text>
            <Text style={styles.title}>
              {isLogin ? t('auth.title_signin') : t('auth.title_signup')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? t('auth.subtitle_signin') : t('auth.subtitle_signup')}
            </Text>
          </View>

          <Surface elevation={0} style={styles.formCard}>
            <View style={styles.segment}>
              <TouchableRipple
                borderless
                onPress={() => switchMode(true)}
                style={[styles.segmentButton, isLogin && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, isLogin && styles.segmentTextActive]}>
                  {t('auth.sign_in')}
                </Text>
              </TouchableRipple>
              <TouchableRipple
                borderless
                onPress={() => switchMode(false)}
                style={[styles.segmentButton, !isLogin && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>
                  {t('auth.create_account')}
                </Text>
              </TouchableRipple>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <>
                  <TextInput
                    label={t('auth.full_name')}
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    value={formData.full_name}
                    onChangeText={(text) => updateField('full_name', text)}
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => usernameRef.current?.focus()}
                    left={<TextInput.Icon icon="account-outline" />}
                  />
                  <TextInput
                    ref={usernameRef}
                    label={t('auth.username')}
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    value={formData.username}
                    onChangeText={(text) => updateField('username', text)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    textContentType="username"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    left={<TextInput.Icon icon="at" />}
                  />
                </>
              )}
              <TextInput
                ref={emailRef}
                label={t('auth.email')}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                value={formData.email}
                onChangeText={(text) => updateField('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
                left={<TextInput.Icon icon="email-outline" />}
              />
              <TextInput
                ref={passwordRef}
                label={t('auth.password')}
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                value={formData.password}
                onChangeText={(text) => updateField('password', text)}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType={isLogin ? 'go' : 'done'}
                onSubmitEditing={() => { if (!loading) void handleSubmit(); }}
                textContentType={isLogin ? 'password' : 'newPassword'}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                left={<TextInput.Icon icon="lock-outline" />}
                right={(
                  <TextInput.Icon
                    icon={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                  />
                )}
              />
              {!isLogin && (
                <Text style={styles.helper}>{t('auth.password_helper')}</Text>
              )}
              {isLogin && (
                <Button
                  mode="text"
                  compact
                  onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}
                  style={{ alignSelf: 'flex-end' }}
                >
                  {t('auth.forgot_password')}
                </Button>
              )}
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={loading}
                disabled={loading}
                contentStyle={styles.submitContent}
                style={styles.submitButton}
                labelStyle={styles.submitLabel}
              >
                {isLogin ? t('auth.sign_in') : t('auth.create_account')}
              </Button>
            </View>

            <Text style={styles.legal}>{t('auth.legal')}</Text>
          </Surface>
        </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: MotionTheme) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandTag: {
    color: theme.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.05,
    marginBottom: 26,
  },
  intro: {
    marginBottom: 18,
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.25,
    marginBottom: 9,
  },
  title: {
    color: theme.text,
    fontSize: 29,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -1.1,
    marginBottom: 10,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 420,
  },
  formCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: theme.surfaceLight,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: theme.surface,
    boxShadow: theme.dark
      ? '0px 2px 6px rgba(0,0,0,0.20)'
      : '0px 2px 6px rgba(18,24,42,0.08)',
  },
  segmentText: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: theme.text,
  },
  form: {
    gap: 13,
  },
  input: {
    backgroundColor: theme.background,
  },
  inputOutline: {
    borderRadius: 10,
  },
  helper: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: -6,
    marginLeft: 4,
  },
  submitButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  submitContent: {
    minHeight: 52,
  },
  submitLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  legal: {
    color: theme.textMuted,
    fontSize: 10.5,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 10,
  },
});

export default Login;
