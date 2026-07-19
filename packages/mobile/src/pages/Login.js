import React, { useState } from 'react';
import { Image, ScrollView, View, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthContext } from "../context/AuthProvider";
import { useTheme } from '../context/ThemeContext';
import { Button, Text, Surface, TextInput, useTheme as usePaperTheme } from 'react-native-paper';

const Login = () => {
  const { theme } = useTheme();
  const paperTheme = usePaperTheme();
  const { login, register } = useAuthContext();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: ''
  });

  const handleSubmit = async () => {
    setLoading(true);
    let result;
    if (isLogin) {
      if (!formData.email || !formData.password) {
        Alert.alert('Error', 'Please enter email and password');
        setLoading(false);
        return;
      }
      result = await login(formData.email, formData.password);
    } else {
      if (!formData.email || !formData.password || !formData.username || !formData.full_name) {
        Alert.alert('Error', 'Please fill all fields');
        setLoading(false);
        return;
      }
      result = await register(formData);
    }

    if (!result.success) {
      Alert.alert('Authentication Failed', result.message || 'Something went wrong');
    }
    setLoading(false);
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 40, backgroundColor: 'transparent' },
    logo: { width: 120, height: 120 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 16, color: theme.textMuted, textAlign: 'center', marginBottom: 32 },
    form: { gap: 16 },
    input: { backgroundColor: theme.card },
    button: { marginTop: 8, paddingVertical: 6 },
    toggleText: { marginTop: 24, color: theme.primary, textAlign: 'center', fontSize: 16 }
  });

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scrollContent}>
        <Surface elevation={0} style={s.logoContainer}>
          <Image source={require('../../assets/icon.png')} style={s.logo} resizeMode="contain" />
        </Surface>

        <Text style={s.title}>{isLogin ? 'Welcome Back' : 'Join MotionMeet'}</Text>
        <Text style={s.subtitle}>
          {isLogin ? 'Sign in to continue' : 'Create an account to get started'}
        </Text>

        <View style={s.form}>
          {!isLogin && (
            <>
              <TextInput
                label="Full Name"
                mode="outlined"
                style={s.input}
                value={formData.full_name}
                onChangeText={(text) => setFormData({ ...formData, full_name: text })}
              />
              <TextInput
                label="Username"
                mode="outlined"
                style={s.input}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
              />
            </>
          )}
          <TextInput
            label="Email"
            mode="outlined"
            style={s.input}
            value={formData.email}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            label="Password"
            mode="outlined"
            style={s.input}
            value={formData.password}
            onChangeText={(text) => setFormData({ ...formData, password: text })}
            secureTextEntry
          />
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={s.button}
          >
            {isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </View>

        <Text onPress={() => setIsLogin(!isLogin)} style={s.toggleText}>
          {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Login;
