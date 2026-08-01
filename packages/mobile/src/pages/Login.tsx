import React, { useMemo, useState } from 'react';
import {
  Linking,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme, type MotionTheme } from '../context/ThemeContext';
import MotionMark from '../components/MotionMark';
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

  const updateField = (field: keyof LoginFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    const required = isLogin
      ? [formData.email, formData.password]
      : [formData.email, formData.password, formData.username, formData.full_name];

    if (required.some((value) => !value.trim())) {
      showError('Missing details', isLogin
        ? 'Please enter your email and password.'
        : 'Please complete every field.');
      return;
    }
    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > AUTH_LIMITS.email) {
      showError('Invalid email', 'Enter a valid email address.');
      return;
    }
    if (!isLogin) {
      const normalizedUsername = formData.username.trim().toLowerCase();
      const normalizedName = formData.full_name.trim();
      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        showError(
          'Invalid username',
          'Use 3–30 lowercase letters, numbers, dots, underscores or hyphens.',
        );
        return;
      }
      if (
        normalizedName.length < AUTH_LIMITS.fullNameMin ||
        normalizedName.length > AUTH_LIMITS.fullNameMax
      ) {
        showError('Invalid name', 'Full name must be between 2 and 100 characters.');
        return;
      }
      if (!hasValidPasswordByteLength(formData.password)) {
        showError('Invalid password', 'Password must be between 10 and 72 UTF-8 bytes.');
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
        showError('Authentication failed', result.message || 'Please try again.');
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
            <MotionMark size={46} />
            <View>
              <Text style={styles.brandName}>MotionMeet</Text>
              <Text style={styles.brandTag}>MOVE WITH PURPOSE</Text>
            </View>
          </View>

          <View style={styles.intro}>
            <Text style={styles.eyebrow}>
              {isLogin ? 'WELCOME BACK' : 'YOUR NEXT CHAPTER'}
            </Text>
            <Text style={styles.title}>
              {isLogin ? 'Ready for your next move?' : 'Build momentum that lasts.'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Your sessions, progress and people are waiting.'
                : 'Bring the work and the people behind it into one place.'}
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
                  Sign in
                </Text>
              </TouchableRipple>
              <TouchableRipple
                borderless
                onPress={() => switchMode(false)}
                style={[styles.segmentButton, !isLogin && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentText, !isLogin && styles.segmentTextActive]}>
                  Create account
                </Text>
              </TouchableRipple>
            </View>

            <View style={styles.form}>
              {!isLogin && (
                <>
                  <TextInput
                    label="Full name"
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    value={formData.full_name}
                    onChangeText={(text) => updateField('full_name', text)}
                    autoComplete="name"
                    left={<TextInput.Icon icon="account-outline" />}
                  />
                  <TextInput
                    label="Username"
                    mode="outlined"
                    style={styles.input}
                    outlineStyle={styles.inputOutline}
                    value={formData.username}
                    onChangeText={(text) => updateField('username', text)}
                    autoCapitalize="none"
                    autoComplete="username"
                    left={<TextInput.Icon icon="at" />}
                  />
                </>
              )}
              <TextInput
                label="Email address"
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                value={formData.email}
                onChangeText={(text) => updateField('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                left={<TextInput.Icon icon="email-outline" />}
              />
              <TextInput
                label="Password"
                mode="outlined"
                style={styles.input}
                outlineStyle={styles.inputOutline}
                value={formData.password}
                onChangeText={(text) => updateField('password', text)}
                secureTextEntry={!passwordVisible}
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
                <Text style={styles.helper}>Use at least 10 characters.</Text>
              )}
              {isLogin && (
                <Button
                  mode="text"
                  compact
                  onPress={() => Linking.openURL(`${WEB_URL}/forgot-password`)}
                  style={{ alignSelf: 'flex-end' }}
                >
                  Forgot password?
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
                {isLogin ? 'Sign in' : 'Create account'}
              </Button>
            </View>

            <Text style={styles.legal}>
              By continuing, you agree to the MotionMeet Terms and Privacy Policy.
            </Text>
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
    gap: 11,
    marginBottom: 28,
  },
  brandName: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTag: {
    color: theme.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  intro: {
    marginBottom: 18,
  },
  eyebrow: {
    color: theme.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.25,
    marginBottom: 9,
  },
  title: {
    color: theme.text,
    fontSize: 29,
    fontWeight: '900',
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
    borderWidth: 1,
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
    fontWeight: '800',
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
    fontWeight: '900',
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
