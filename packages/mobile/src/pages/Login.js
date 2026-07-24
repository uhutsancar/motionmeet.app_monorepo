import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Surface, Text, TextInput, TouchableRipple } from 'react-native-paper';
import { useAuthContext } from '../context/AuthProvider';
import { useTheme } from '../context/ThemeContext';

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

  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async () => {
    const required = isLogin
      ? [formData.email, formData.password]
      : [formData.email, formData.password, formData.username, formData.full_name];

    if (required.some((value) => !value.trim())) {
      Alert.alert('Missing details', isLogin
        ? 'Please enter your email and password.'
        : 'Please complete every field.');
      return;
    }

    setLoading(true);
    try {
      const result = isLogin
        ? await login(formData.email.trim(), formData.password)
        : await register({
          ...formData,
          email: formData.email.trim(),
          username: formData.username.trim(),
          full_name: formData.full_name.trim(),
        });

      if (!result.success) {
        Alert.alert('Authentication failed', result.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextIsLogin) => {
    setIsLogin(nextIsLogin);
    setPasswordVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.ambientTop} />
      <View pointerEvents="none" style={styles.ambientBottom} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoTile}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.brandName}>MotionMeet</Text>
              <Text style={styles.brandTag}>TRAIN · TRACK · CONNECT</Text>
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
                ? 'Your workouts, progress and community are waiting.'
                : 'Bring your training, progress and people into one place.'}
            </Text>
          </View>

          <Surface elevation={2} style={styles.formCard}>
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
                <Text style={styles.helper}>Use at least 8 characters.</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  ambientTop: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: -150,
    right: -100,
    backgroundColor: theme.primarySoft,
    opacity: 0.72,
  },
  ambientBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -160,
    left: -120,
    backgroundColor: theme.secondarySoft,
    opacity: 0.58,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 36,
  },
  logoTile: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: theme.primarySoft,
    borderWidth: 1,
    borderColor: theme.border,
  },
  logo: {
    width: 31,
    height: 31,
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
    marginBottom: 24,
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
    fontSize: 31,
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
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOpacity: theme.dark ? 0.24 : 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: theme.surfaceLight,
  },
  segmentButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  segmentButtonActive: {
    backgroundColor: theme.surface,
    shadowColor: theme.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
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
    borderRadius: 14,
  },
  helper: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: -6,
    marginLeft: 4,
  },
  submitButton: {
    borderRadius: 15,
    marginTop: 4,
    shadowColor: theme.primary,
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
